import "dotenv/config";
import { PhoneType, PrismaClient, SieLinkStatus } from "@prisma/client";
import { AssociatesApiClient } from "../modules/afiliaciones/associates-integration/Clients/AssociatesApiClient";
import { getAssociatesApiConfig } from "../modules/afiliaciones/associates-integration/Config/AssociatesApiConfig";
import { mapSieDocumentType } from "../modules/afiliaciones/associates-integration/Mappers/SieAssociateListMapper";
import { buildDryRunReport, buildPlan, type ExistingPerson, type GeoResolution, type MigrationPlan } from "../modules/afiliaciones/associates-integration/Services/SieHistoricalMigrationService";
import type { SanitizedSieAssociate } from "../modules/afiliaciones/associates-integration/Models/SieAssociateList";
import { assertExecutionTarget } from "./sie-execution-guard";

/**
 * Migración histórica SIE → QA optimizada (lecturas y escrituras por lotes).
 * Reutiliza `buildPlan`/`buildDryRunReport` de `SieHistoricalMigrationService`,
 * por lo que la clasificación es idéntica a `sie-historical-migrate.ts`.
 * Las escrituras son por lotes (createMany + skipDuplicates), manteniendo la
 * idempotencia por claves naturales y sin sobrescribir datos existentes.
 */

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
  for (const c of countries) countryByName.set(norm(c.name), c.id);
  const departmentByName = new Map<string, number>();
  for (const d of departments) departmentByName.set(`${d.countryId}|${norm(d.name)}`, d.id);
  const provinceByName = new Map<string, number>();
  for (const p of provinces) provinceByName.set(`${p.departmentId}|${norm(p.name)}`, p.id);
  const districtByName = new Map<string, number>();
  for (const d of districts) districtByName.set(`${d.provinceId}|${norm(d.name)}`, d.id);
  return { peruCountryId: peru?.id ?? 0, countryByName, departmentByName, provinceByName, districtByName };
}

function resolveGeo(record: SanitizedSieAssociate, cat: Catalogs): GeoResolution {
  const countryId = record.paisNombre ? (cat.countryByName.get(norm(record.paisNombre)) ?? null) : null;
  const departmentId = countryId && record.departamentoNombre ? (cat.departmentByName.get(`${countryId}|${norm(record.departamentoNombre)}`) ?? null) : null;
  const provinceId = departmentId && record.provinciaNombre ? (cat.provinceByName.get(`${departmentId}|${norm(record.provinciaNombre)}`) ?? null) : null;
  const districtId = provinceId && record.distritoNombre ? (cat.districtByName.get(`${provinceId}|${norm(record.distritoNombre)}`) ?? null) : null;
  return { countryId, countryIsPeru: countryId === cat.peruCountryId && cat.peruCountryId !== 0, departmentId, provinceId, districtId };
}

async function main(): Promise<void> {
  const mode = process.argv[2] === "execute" ? "execute" : "dry-run";
  assertExecutionTarget(process.argv);
  const prisma = new PrismaClient();
  const result: Record<string, unknown> = { r69_5_status: "FAIL", mode, error: null };

  try {
    // 1) SIE histórico.
    const client = new AssociatesApiClient(getAssociatesApiConfig());
    const firstPage = await client.listAssociates({ pagina: 1, tamanioPagina: PAGE_SIZE });
    const pages = [firstPage];
    for (let page = 2; page <= (firstPage.totalPaginas || 1); page += 1) pages.push(await client.listAssociates({ pagina: page, tamanioPagina: PAGE_SIZE }));
    const records = pages.flatMap((p) => p.associates).filter((r) => HISTORICAL.includes(r.sourceType));

    // 2) Catálogos + categorías + tipo de dirección + personas existentes (lote).
    const [catalogs, categories, addressType, existingPersons] = await Promise.all([
      loadCatalogs(prisma),
      prisma.membershipCategory.findMany({ select: { id: true, code: true } }),
      prisma.addressType.findFirst({ where: { isActive: true }, select: { id: true } }),
      prisma.person.findMany({
        select: { id: true, documentType: true, documentNumber: true, firstName: true, paternalLastName: true, maternalLastName: true, contacts: { select: { email: true, phoneNumber: true, isPrimary: true } }, addresses: { select: { street: true, isPrimary: true } } },
      }),
    ]);
    const categoryByCode = new Map(categories.map((c) => [c.code, c.id]));
    const personByDoc = new Map<string, ExistingPerson>();
    for (const p of existingPersons) {
      personByDoc.set(`${p.documentType}|${p.documentNumber}`, {
        id: p.id,
        firstName: p.firstName,
        paternalLastName: p.paternalLastName,
        maternalLastName: p.maternalLastName,
        email: p.contacts.find((c) => c.isPrimary)?.email ?? null,
        phone: p.contacts.find((c) => c.isPrimary)?.phoneNumber ?? null,
        street: p.addresses.find((a) => a.isPrimary)?.street ?? null,
      });
    }

    // 3) Planes (clasificación idéntica vía buildPlan).
    const plans: Array<{ record: SanitizedSieAssociate; plan: MigrationPlan }> = records.map((record) => ({
      record,
      plan: buildPlan(record, personByDoc.get(`${mapSieDocumentType(record.documentType)}|${record.documentNumber}`) ?? null, resolveGeo(record, catalogs)),
    }));

    if (mode === "dry-run") {
      result.r69_5_status = "PASS";
      result.target_records = records.length;
      Object.assign(result, buildDryRunReport(plans.map((p) => p.plan)));
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    // 4) Escritura por lotes.
    const before = {
      persons: await prisma.person.count(),
      contacts: await prisma.personContact.count(),
      addresses: await prisma.address.count(),
      sieRecords: await prisma.sieAssociateRecord.count(),
    };

    // 4a) Crear personas nuevas.
    const createPlans = plans.filter((p) => p.plan.person.kind === "CREATE");
    const createdPersons = await prisma.person.createManyAndReturn({
      data: createPlans.map(({ record }) => ({
        documentType: mapSieDocumentType(record.documentType)!,
        documentNumber: record.documentNumber,
        firstName: record.nombres as string,
        paternalLastName: record.apellidoPaterno as string,
        maternalLastName: record.apellidoMaterno ?? null,
        birthDate: parseBirthDate(record.fechaNacimiento),
      })),
      skipDuplicates: true,
      select: { id: true, documentType: true, documentNumber: true },
    });
    const idByDoc = new Map<string, number>();
    for (const p of createdPersons) idByDoc.set(`${p.documentType}|${p.documentNumber}`, p.id);

    // 4b) Resolver personId final por registro.
    const personIdByPlan = new Map<MigrationPlan, number>();
    const docByPlan = new Map<MigrationPlan, string>();
    for (const { record, plan } of plans) {
      if (plan.person.kind === "CREATE") {
        const key = `${mapSieDocumentType(record.documentType)}|${record.documentNumber}`;
        const id = idByDoc.get(key) ?? personByDoc.get(key)?.id ?? null;
        if (id) personIdByPlan.set(plan, id);
        docByPlan.set(plan, key);
      } else if (plan.person.kind === "LINK" || plan.person.kind === "CONFLICT") {
        personIdByPlan.set(plan, plan.person.personId);
      }
    }

    // 4c) Contactos (precargar existentes para idempotencia).
    const contactKeys = new Set<string>();
    for (const { record, plan } of plans) {
      const personId = personIdByPlan.get(plan);
      if (!plan.hasContact || !personId) continue;
      const email = record.correo ? record.correo.trim().toLowerCase() : null;
      const phone = record.telefono ? record.telefono.trim() : "";
      if (email) contactKeys.add(`${personId}|e|${email}`);
      else if (phone) contactKeys.add(`${personId}|p|${phone}`);
    }
    const existingContacts = await prisma.personContact.findMany({
      where: { OR: [...contactKeys].map((k) => { const [pid, kind, v] = k.split("|"); return kind === "e" ? { personId: Number(pid), email: { equals: v, mode: "insensitive" as const } } : { personId: Number(pid), phoneNumber: v }; }) },
      select: { personId: true, email: true, phoneNumber: true },
    });
    const existingContactKeys = new Set(existingContacts.map((c) => `${c.personId}|${c.email ? "e|" + c.email.toLowerCase() : "p|" + (c.phoneNumber ?? "")}`));

    const contactRows: Array<{ personId: number; email: string | null; phoneNumber: string; phoneType: PhoneType; isPrimary: boolean }> = [];
    const contactKeySet = new Set<string>();
    for (const { record, plan } of plans) {
      const personId = personIdByPlan.get(plan);
      if (!plan.hasContact || !personId) continue;
      const email = record.correo ? record.correo.trim().toLowerCase() : null;
      const phone = record.telefono ? record.telefono.trim() : "";
      const key = email ? `${personId}|e|${email}` : `${personId}|p|${phone}`;
      if (existingContactKeys.has(key) || contactKeySet.has(key)) continue;
      contactKeySet.add(key);
      contactRows.push({ personId, email, phoneNumber: phone, phoneType: PhoneType.MOBILE, isPrimary: true });
    }
    if (contactRows.length) await prisma.personContact.createMany({ data: contactRows });

    // 4d) Registros SIE (lote, idempotente por clave natural).
    const sieRows = plans.map(({ record, plan }) => {
      const personId = personIdByPlan.get(plan) ?? null;
      const linkStatus: SieLinkStatus = plan.linkStatus === "LINKED" ? "LINKED" : plan.linkStatus === "CONFLICT" ? "CONFLICT" : "UNLINKED";
      return {
        provider: "SIE",
        externalCode: record.externalCode,
        sourceDocumentType: record.documentType || null,
        documentNumber: record.documentNumber || null,
        sourceType: record.sourceType,
        sourceDescription: record.sourceDescription ?? null,
        personId,
        categoryId: categoryByCode.get(record.sourceType) ?? null,
        linkStatus,
        lastSyncedAt: new Date(),
      };
    });
    if (sieRows.length) await prisma.sieAssociateRecord.createMany({ data: sieRows, skipDuplicates: true });

    // 4e) Direcciones para personas creadas con ubicación resuelta.
    const createPersonIds = new Set<number>();
    for (const { plan } of createPlans) {
      const id = personIdByPlan.get(plan);
      if (id) createPersonIds.add(id);
    }
    const existingAddresses = await prisma.address.findMany({ where: { personId: { in: [...createPersonIds] }, isPrimary: true }, select: { personId: true } });
    const existingAddrSet = new Set(existingAddresses.map((a) => a.personId));

    const addressRows: Array<{ personId: number; countryId: number; districtId?: number; addressTypeId: number; street: string; foreignRegion?: string | null; foreignCity?: string | null; isPrimary: boolean }> = [];
    for (const { record, plan } of createPlans) {
      const personId = personIdByPlan.get(plan);
      if (!personId || existingAddrSet.has(personId) || !addressType?.id) continue;
      if (plan.address.kind === "RESOLVED_LOCAL") {
        addressRows.push({ personId, countryId: plan.address.countryId, districtId: plan.address.districtId, addressTypeId: addressType.id, street: record.direccion ?? "", isPrimary: true });
      } else if (plan.address.kind === "FOREIGN") {
        addressRows.push({ personId, countryId: plan.address.countryId, addressTypeId: addressType.id, street: record.direccion ?? "", foreignRegion: record.departamentoNombre ?? null, foreignCity: record.provinciaNombre ?? null, isPrimary: true });
      }
    }
    if (addressRows.length) await prisma.address.createMany({ data: addressRows as never });

    const after = {
      persons: await prisma.person.count(),
      contacts: await prisma.personContact.count(),
      addresses: await prisma.address.count(),
      sieRecords: await prisma.sieAssociateRecord.count(),
    };

    result.r69_5_status = "PASS";
    result.target_records = records.length;
    result.persons_created = after.persons - before.persons;
    result.contacts_created = after.contacts - before.contacts;
    result.addresses_created = after.addresses - before.addresses;
    result.sie_records_created = after.sieRecords - before.sieRecords;
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
