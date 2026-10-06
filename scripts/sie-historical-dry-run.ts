import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { AssociatesApiClient } from "../modules/afiliaciones/associates-integration/Clients/AssociatesApiClient";
import { getAssociatesApiConfig } from "../modules/afiliaciones/associates-integration/Config/AssociatesApiConfig";
import { mapSieDocumentType } from "../modules/afiliaciones/associates-integration/Mappers/SieAssociateListMapper";
import type { SanitizedSieAssociate } from "../modules/afiliaciones/associates-integration/Models/SieAssociateList";

const PAGE_SIZE = 500;
const HISTORICAL = ["T", "V", "H", "F", "R", "X", "U"];

type PersonSnapshot = {
  id: number;
  firstName: string;
  paternalLastName: string;
  maternalLastName: string | null;
  birthDate: Date | null;
  email: string | null;
  phone: string | null;
  street: string | null;
  countryId: number | null;
  districtId: number | null;
};

type DistrictRef = {
  id: number;
  countryId: number;
  countryName: string;
  departmentName: string;
  provinceName: string;
  districtName: string;
};

type UbigeoClass = "UBIGEO_EXACT_MATCH" | "UBIGEO_NAME_MATCH" | "UBIGEO_PARTIAL" | "UBIGEO_NOT_FOUND" | "UBIGEO_NULL";

function norm(value: string | null | undefined): string {
  if (!value) return "";
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function missingFields(record: SanitizedSieAssociate): string[] {
  const missing: string[] = [];
  if (!record.nombres) missing.push("NAMES");
  if (!record.apellidoPaterno) missing.push("PATERNAL_LASTNAME");
  if (!record.apellidoMaterno) missing.push("MATERNAL_LASTNAME");
  if (!record.fechaNacimiento) missing.push("BIRTHDATE");
  if (!record.telefono) missing.push("PHONE");
  if (!record.correo) missing.push("EMAIL");
  if (!record.direccion) missing.push("ADDRESS");
  if (!record.pais && !record.paisNombre) missing.push("COUNTRY");
  if (!record.departamento && !record.departamentoNombre) missing.push("DEPARTMENT");
  if (!record.provincia && !record.provinciaNombre) missing.push("PROVINCE");
  if (!record.distrito && !record.distritoNombre) missing.push("DISTRICT");
  return missing;
}

function hasPersonDataConflict(record: SanitizedSieAssociate, person: PersonSnapshot): boolean {
  if (record.nombres && person.firstName && norm(record.nombres) !== norm(person.firstName)) return true;
  if (record.apellidoPaterno && person.paternalLastName && norm(record.apellidoPaterno) !== norm(person.paternalLastName)) return true;
  if (record.apellidoMaterno && person.maternalLastName && norm(record.apellidoMaterno) !== norm(person.maternalLastName)) return true;
  if (record.correo && person.email && norm(record.correo) !== norm(person.email)) return true;
  if (record.telefono && person.phone && norm(record.telefono) !== norm(person.phone)) return true;
  if (record.direccion && person.street && norm(record.direccion) !== norm(person.street)) return true;
  return false;
}

async function resolvePerson(prisma: PrismaClient, record: SanitizedSieAssociate): Promise<{ status: string; person: PersonSnapshot | null }> {
  const documentType = mapSieDocumentType(record.documentType);
  if (!documentType) return { status: "DOCUMENT_TYPE_UNMAPPED", person: null };
  if (!record.documentNumber) return { status: "INVALID_RECORD", person: null };

  const person = await prisma.person.findUnique({
    where: { documentType_documentNumber: { documentType, documentNumber: record.documentNumber } },
    select: {
      id: true,
      firstName: true,
      paternalLastName: true,
      maternalLastName: true,
      birthDate: true,
      contacts: { where: { isPrimary: true }, take: 1, select: { email: true, phoneNumber: true } },
      addresses: { where: { isPrimary: true }, take: 1, select: { street: true, countryId: true, districtId: true } },
    },
  });

  if (!person) return { status: "PERSON_NOT_FOUND", person: null };
  return {
    status: "PERSON_ALREADY_EXISTS",
    person: {
      id: person.id,
      firstName: person.firstName,
      paternalLastName: person.paternalLastName,
      maternalLastName: person.maternalLastName,
      birthDate: person.birthDate,
      email: person.contacts[0]?.email ?? null,
      phone: person.contacts[0]?.phoneNumber ?? null,
      street: person.addresses[0]?.street ?? null,
      countryId: person.addresses[0]?.countryId ?? null,
      districtId: person.addresses[0]?.districtId ?? null,
    },
  };
}

async function loadCatalogs(prisma: PrismaClient): Promise<{ countryByName: Map<string, number>; departmentByName: Map<string, number>; provinceByName: Map<string, number>; districtByName: Map<string, DistrictRef> }> {
  const [countries, departments, provinces, districts] = await Promise.all([
    prisma.country.findMany({ select: { id: true, name: true } }),
    prisma.department.findMany({ select: { id: true, name: true } }),
    prisma.province.findMany({ select: { id: true, name: true } }),
    prisma.district.findMany({ select: { id: true, name: true, province: { select: { name: true, department: { select: { name: true, country: { select: { id: true, name: true } } } } } } } }),
  ]);

  const countryByName = new Map<string, number>();
  for (const country of countries) countryByName.set(norm(country.name), country.id);

  const departmentByName = new Map<string, number>();
  for (const department of departments) departmentByName.set(norm(department.name), department.id);

  const provinceByName = new Map<string, number>();
  for (const province of provinces) provinceByName.set(norm(province.name), province.id);

  const districtByName = new Map<string, DistrictRef>();
  for (const district of districts) {
    districtByName.set(norm(district.name), {
      id: district.id,
      countryId: district.province.department.country.id,
      countryName: district.province.department.country.name,
      departmentName: district.province.department.name,
      provinceName: district.province.name,
      districtName: district.name,
    });
  }

  return { countryByName, departmentByName, provinceByName, districtByName };
}

function classifyUbigeo(record: SanitizedSieAssociate, catalogs: Awaited<ReturnType<typeof loadCatalogs>>): UbigeoClass {
  const hasGeo = record.paisNombre || record.departamentoNombre || record.provinciaNombre || record.distritoNombre || record.pais || record.departamento || record.provincia || record.distrito;
  if (!hasGeo) return "UBIGEO_NULL";

  const district = record.distritoNombre ? catalogs.districtByName.get(norm(record.distritoNombre)) : undefined;
  if (district) {
    const chainConsistent =
      (!record.departamentoNombre || norm(district.departmentName) === norm(record.departamentoNombre)) &&
      (!record.provinciaNombre || norm(district.provinceName) === norm(record.provinciaNombre)) &&
      (!record.paisNombre || norm(district.countryName) === norm(record.paisNombre));
    return chainConsistent ? "UBIGEO_EXACT_MATCH" : "UBIGEO_NAME_MATCH";
  }

  const countryMatch = record.paisNombre && catalogs.countryByName.has(norm(record.paisNombre));
  const departmentMatch = record.departamentoNombre && catalogs.departmentByName.has(norm(record.departamentoNombre));
  const provinceMatch = record.provinciaNombre && catalogs.provinceByName.has(norm(record.provinciaNombre));
  if (countryMatch || departmentMatch || provinceMatch) return "UBIGEO_PARTIAL";
  return "UBIGEO_NOT_FOUND";
}

async function main(): Promise<void> {
  const prisma = new PrismaClient();
  const result: Record<string, unknown> = { r69_4_final_status: "FAIL", error: null };
  try {
    const config = getAssociatesApiConfig();
    const client = new AssociatesApiClient(config);
    const firstPage = await client.listAssociates({ pagina: 1, tamanioPagina: PAGE_SIZE });
    const totalPaginas = firstPage.totalPaginas || 1;
    const pages = [firstPage];
    for (let page = 2; page <= totalPaginas; page += 1) {
      pages.push(await client.listAssociates({ pagina: page, tamanioPagina: PAGE_SIZE }));
    }
    const records = pages.flatMap((page) => page.associates);

    const activeExcluded = records.filter((record) => record.sourceType === "A").length;
    const studentExcluded = records.filter((record) => record.sourceType === "E").length;
    const historical = records.filter((record) => HISTORICAL.includes(record.sourceType));

    const catalogs = await loadCatalogs(prisma);

    const byCategory: Record<string, Record<string, number>> = {};
    const missingFieldCounts: Record<string, number> = {};
    const ubigeoCounts: Record<UbigeoClass, number> = { UBIGEO_EXACT_MATCH: 0, UBIGEO_NAME_MATCH: 0, UBIGEO_PARTIAL: 0, UBIGEO_NOT_FOUND: 0, UBIGEO_NULL: 0 };

    let personAlreadyExists = 0;
    let wouldCreatePerson = 0;
    let wouldCreateContact = 0;
    let wouldCreateAddress = 0;
    let wouldLinkExistingPerson = 0;
    let wouldCreateAndLinkPerson = 0;
    let wouldLeaveUnlinked = 0;
    let wouldMarkConflict = 0;
    let personDataConflicts = 0;
    let documentConflicts = 0;

    for (const record of historical) {
      const category = record.sourceType;
      const bucket = byCategory[category] ?? {};
      byCategory[category] = bucket;
      bucket.total = (bucket.total ?? 0) + 1;

      for (const field of missingFields(record)) {
        missingFieldCounts[field] = (missingFieldCounts[field] ?? 0) + 1;
      }

      const ubigeo = classifyUbigeo(record, catalogs);
      ubigeoCounts[ubigeo] += 1;
      bucket[ubigeo] = (bucket[ubigeo] ?? 0) + 1;

      if (record.telefono || record.correo) { wouldCreateContact += 1; bucket.createContact = (bucket.createContact ?? 0) + 1; }
      if (record.direccion || record.paisNombre || record.departamentoNombre || record.provinciaNombre || record.distritoNombre) { wouldCreateAddress += 1; bucket.createAddress = (bucket.createAddress ?? 0) + 1; }

      const reconciliation = await resolvePerson(prisma, record);
      if (reconciliation.status === "PERSON_ALREADY_EXISTS" && reconciliation.person) {
        personAlreadyExists += 1;
        bucket.exists = (bucket.exists ?? 0) + 1;
        if (hasPersonDataConflict(record, reconciliation.person)) {
          wouldMarkConflict += 1;
          personDataConflicts += 1;
          bucket.conflict = (bucket.conflict ?? 0) + 1;
        } else {
          wouldLinkExistingPerson += 1;
          bucket.linkExisting = (bucket.linkExisting ?? 0) + 1;
        }
      } else if (reconciliation.status === "PERSON_NOT_FOUND") {
        const canCreate = Boolean(record.nombres && record.apellidoPaterno);
        if (canCreate) {
          wouldCreatePerson += 1;
          wouldCreateAndLinkPerson += 1;
          bucket.createAndLink = (bucket.createAndLink ?? 0) + 1;
        } else {
          wouldLeaveUnlinked += 1;
          bucket.leaveUnlinked = (bucket.leaveUnlinked ?? 0) + 1;
        }
      } else if (reconciliation.status === "DOCUMENT_TYPE_UNMAPPED") {
        documentConflicts += 1;
        bucket.docUnmapped = (bucket.docUnmapped ?? 0) + 1;
      }
    }

    result.r69_4_final_status = "PASS";
    result.total_sie_records = records.length;
    result.active_excluded = activeExcluded;
    result.student_excluded = studentExcluded;
    result.target_historical_total = historical.length;
    result.target_counts = Object.fromEntries(HISTORICAL.map((type) => [type, historical.filter((record) => record.sourceType === type).length]));
    result.person_already_exists = personAlreadyExists;
    result.would_create_person = wouldCreatePerson;
    result.would_create_contact = wouldCreateContact;
    result.would_create_address = wouldCreateAddress;
    result.would_create_sie_record = historical.length;
    result.would_link_existing_person = wouldLinkExistingPerson;
    result.would_create_and_link_person = wouldCreateAndLinkPerson;
    result.would_leave_unlinked = wouldLeaveUnlinked;
    result.would_mark_conflict = wouldMarkConflict;
    result.person_data_conflicts = personDataConflicts;
    result.document_conflicts = documentConflicts;
    result.category_conflicts = 0;
    result.null_personal_data = missingFieldCounts;
    result.ubigeo_exact_match = ubigeoCounts.UBIGEO_EXACT_MATCH;
    result.ubigeo_name_match = ubigeoCounts.UBIGEO_NAME_MATCH;
    result.ubigeo_partial = ubigeoCounts.UBIGEO_PARTIAL;
    result.ubigeo_not_found = ubigeoCounts.UBIGEO_NOT_FOUND;
    result.ubigeo_null = ubigeoCounts.UBIGEO_NULL;
    result.by_category = byCategory;

    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    result.error = error instanceof Error ? error.message : String(error);
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main();
