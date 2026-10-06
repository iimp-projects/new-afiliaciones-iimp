import "dotenv/config";
import { DocumentType, Prisma, PrismaClient, SieLinkStatus } from "@prisma/client";
import { AssociatesApiClient } from "../modules/afiliaciones/associates-integration/Clients/AssociatesApiClient";
import { getAssociatesApiConfig } from "../modules/afiliaciones/associates-integration/Config/AssociatesApiConfig";
import { mapSieDocumentType } from "../modules/afiliaciones/associates-integration/Mappers/SieAssociateListMapper";
import { buildDryRunReport, buildPlan } from "../modules/afiliaciones/associates-integration/Services/SieHistoricalMigrationService";
import type { ExistingPerson, GeoResolution, MigrationPlan } from "../modules/afiliaciones/associates-integration/Services/SieHistoricalMigrationService";
import type { SanitizedSieAssociate } from "../modules/afiliaciones/associates-integration/Models/SieAssociateList";

const PAGE_SIZE = 500;
const HISTORICAL = ["T", "V", "H", "F", "R", "X", "U"];

function norm(value: string | null | undefined): string {
  if (!value) return "";
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function parseBirthDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(trimmed);
  if (iso) {
    const date = new Date(Date.UTC(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3])));
    if (!Number.isNaN(date.getTime())) return date;
  }
  const dmy = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/.exec(trimmed);
  if (dmy) {
    const date = new Date(Date.UTC(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1])));
    if (!Number.isNaN(date.getTime())) return date;
  }
  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

type Catalogs = {
  peruCountryId: number;
  countryByName: Map<string, number>;
  departmentByName: Map<string, number>;
  provinceByName: Map<string, number>;
  districtByName: Map<string, number>;
};

async function loadCatalogs(prisma: PrismaClient): Promise<Catalogs> {
  const [peru, countries, departments, provinces, districts] = await Promise.all([
    prisma.country.findFirst({ where: { isoCode: "PER" }, select: { id: true } }),
    prisma.country.findMany({ select: { id: true, name: true } }),
    prisma.department.findMany({ select: { id: true, name: true, countryId: true } }),
    prisma.province.findMany({ select: { id: true, name: true, departmentId: true } }),
    prisma.district.findMany({ select: { id: true, name: true, provinceId: true } }),
  ]);

  const countryByName = new Map<string, number>();
  for (const country of countries) countryByName.set(norm(country.name), country.id);

  const departmentByName = new Map<string, number>();
  for (const department of departments) departmentByName.set(`${department.countryId}|${norm(department.name)}`, department.id);

  const provinceByName = new Map<string, number>();
  for (const province of provinces) provinceByName.set(`${province.departmentId}|${norm(province.name)}`, province.id);

  const districtByName = new Map<string, number>();
  for (const district of districts) districtByName.set(`${district.provinceId}|${norm(district.name)}`, district.id);

  return { peruCountryId: peru?.id ?? 0, countryByName, departmentByName, provinceByName, districtByName };
}

function resolveGeo(record: SanitizedSieAssociate, cat: Catalogs): GeoResolution {
  const countryId = record.paisNombre ? cat.countryByName.get(norm(record.paisNombre)) ?? null : null;
  const departmentId = countryId && record.departamentoNombre ? cat.departmentByName.get(`${countryId}|${norm(record.departamentoNombre)}`) ?? null : null;
  const provinceId = departmentId && record.provinciaNombre ? cat.provinceByName.get(`${departmentId}|${norm(record.provinciaNombre)}`) ?? null : null;
  const districtId = provinceId && record.distritoNombre ? cat.districtByName.get(`${provinceId}|${norm(record.distritoNombre)}`) ?? null : null;
  return { countryId, countryIsPeru: countryId === cat.peruCountryId && cat.peruCountryId !== 0, departmentId, provinceId, districtId };
}

async function resolveExistingPerson(prisma: PrismaClient, record: SanitizedSieAssociate): Promise<ExistingPerson | null> {
  const documentType = mapSieDocumentType(record.documentType);
  if (!documentType || !record.documentNumber) return null;
  const person = await prisma.person.findUnique({
    where: { documentType_documentNumber: { documentType, documentNumber: record.documentNumber } },
    select: {
      id: true,
      firstName: true,
      paternalLastName: true,
      maternalLastName: true,
      contacts: { where: { isPrimary: true }, take: 1, select: { email: true, phoneNumber: true } },
      addresses: { where: { isPrimary: true }, take: 1, select: { street: true } },
    },
  });
  if (!person) return null;
  return {
    id: person.id,
    firstName: person.firstName,
    paternalLastName: person.paternalLastName,
    maternalLastName: person.maternalLastName,
    email: person.contacts[0]?.email ?? null,
    phone: person.contacts[0]?.phoneNumber ?? null,
    street: person.addresses[0]?.street ?? null,
  };
}

async function executeRecord(tx: Prisma.TransactionClient, record: SanitizedSieAssociate, plan: MigrationPlan, categoryId: number | null, defaultAddressTypeId: number | null): Promise<void> {
  let personId: number | null = null;
  if (plan.person.kind === "CREATE") {
    const documentType = mapSieDocumentType(record.documentType) as DocumentType;
    const person = await tx.person.upsert({
      where: { documentType_documentNumber: { documentType, documentNumber: record.documentNumber } },
      create: {
        documentType,
        documentNumber: record.documentNumber,
        firstName: record.nombres as string,
        paternalLastName: record.apellidoPaterno as string,
        maternalLastName: record.apellidoMaterno ?? null,
        birthDate: parseBirthDate(record.fechaNacimiento),
      },
      update: {},
    });
    personId = person.id;
  } else if (plan.person.kind === "LINK" || plan.person.kind === "CONFLICT") {
    personId = plan.person.personId;
  }

  if (plan.hasContact && personId) {
    const email = record.correo ? record.correo.trim().toLowerCase() : null;
    const phone = record.telefono ? record.telefono.trim() : "";
    if (email) {
      const existing = await tx.personContact.findFirst({ where: { personId, email: { equals: email, mode: "insensitive" } }, select: { id: true } });
      if (!existing) {
        await tx.personContact.create({ data: { personId, email, phoneNumber: phone, phoneType: "MOBILE", isPrimary: true } });
      }
    } else if (phone) {
      const existing = await tx.personContact.findFirst({ where: { personId, phoneNumber: phone }, select: { id: true } });
      if (!existing) {
        await tx.personContact.create({ data: { personId, email: null, phoneNumber: phone, phoneType: "MOBILE", isPrimary: true } });
      }
    }
  }

  const linkStatus: SieLinkStatus = plan.linkStatus === "LINKED" ? "LINKED" : plan.linkStatus === "CONFLICT" ? "CONFLICT" : "UNLINKED";
  await tx.sieAssociateRecord.upsert({
    where: { provider_externalCode: { provider: "SIE", externalCode: record.externalCode } },
    create: {
      provider: "SIE",
      externalCode: record.externalCode,
      sourceDocumentType: record.documentType || null,
      documentNumber: record.documentNumber || null,
      sourceType: record.sourceType,
      sourceDescription: record.sourceDescription ?? null,
      personId,
      categoryId,
      linkStatus,
      lastSyncedAt: new Date(),
    },
    update: { sourceDocumentType: record.documentType || null, documentNumber: record.documentNumber || null, sourceType: record.sourceType, sourceDescription: record.sourceDescription ?? null, personId, categoryId, linkStatus, lastSyncedAt: new Date() },
  });

  if (personId && plan.person.kind === "CREATE" && defaultAddressTypeId) {
    const existingAddress = await tx.address.findFirst({ where: { personId, isPrimary: true }, select: { id: true } });
    if (!existingAddress) {
      if (plan.address.kind === "RESOLVED_LOCAL") {
        await tx.address.create({
          data: { personId, countryId: plan.address.countryId, districtId: plan.address.districtId, addressTypeId: defaultAddressTypeId, street: record.direccion ?? "", isPrimary: true },
        });
      } else if (plan.address.kind === "FOREIGN") {
        await tx.address.create({
          data: { personId, countryId: plan.address.countryId, addressTypeId: defaultAddressTypeId, street: record.direccion ?? "", foreignRegion: record.departamentoNombre ?? null, foreignCity: record.provinciaNombre ?? null, isPrimary: true },
        });
      }
    }
  }
}

async function main(): Promise<void> {
  const mode = process.argv[2] === "execute" ? "execute" : "dry-run";
  const prisma = new PrismaClient();
  const result: Record<string, unknown> = { r69_5_status: "FAIL", mode, error: null };
  try {
    const config = getAssociatesApiConfig();
    const client = new AssociatesApiClient(config);
    const firstPage = await client.listAssociates({ pagina: 1, tamanioPagina: PAGE_SIZE });
    const totalPaginas = firstPage.totalPaginas || 1;
    const pages = [firstPage];
    for (let page = 2; page <= totalPaginas; page += 1) pages.push(await client.listAssociates({ pagina: page, tamanioPagina: PAGE_SIZE }));
    const records = pages.flatMap((page) => page.associates).filter((record) => HISTORICAL.includes(record.sourceType));

    const catalogs = await loadCatalogs(prisma);
    const categories = await prisma.membershipCategory.findMany({ select: { id: true, code: true } });
    const categoryByCode = new Map(categories.map((c) => [c.code, c.id]));
    const addressType = await prisma.addressType.findFirst({ where: { isActive: true }, select: { id: true } });

    const plans: Array<{ record: SanitizedSieAssociate; plan: MigrationPlan }> = [];
    for (const record of records) {
      const existing = await resolveExistingPerson(prisma, record);
      const geo = resolveGeo(record, catalogs);
      plans.push({ record, plan: buildPlan(record, existing, geo) });
    }

    if (mode === "dry-run") {
      result.r69_5_status = "PASS";
      result.target_records = records.length;
      Object.assign(result, buildDryRunReport(plans.map((p) => p.plan)));
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    let personsCreated = 0;
    let contactsCreated = 0;
    let addressesCreated = 0;
    let sieRecordsCreated = 0;
    const before = {
      persons: await prisma.person.count(),
      contacts: await prisma.personContact.count(),
      addresses: await prisma.address.count(),
      sieRecords: await prisma.sieAssociateRecord.count(),
    };
    for (const { record, plan } of plans) {
      await prisma.$transaction(async (tx) => {
        const categoryId = categoryByCode.get(record.sourceType) ?? null;
        await executeRecord(tx, record, plan, categoryId, addressType?.id ?? null);
      });
    }
    const after = {
      persons: await prisma.person.count(),
      contacts: await prisma.personContact.count(),
      addresses: await prisma.address.count(),
      sieRecords: await prisma.sieAssociateRecord.count(),
    };
    personsCreated = after.persons - before.persons;
    contactsCreated = after.contacts - before.contacts;
    addressesCreated = after.addresses - before.addresses;
    sieRecordsCreated = after.sieRecords - before.sieRecords;

    result.r69_5_status = "PASS";
    result.target_records = records.length;
    result.persons_created = personsCreated;
    result.contacts_created = contactsCreated;
    result.addresses_created = addressesCreated;
    result.sie_records_created = sieRecordsCreated;
    result.auth_users_created = 0;
    result.auth_credentials_created = 0;
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    result.error = error instanceof Error ? error.message : String(error);
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main();
