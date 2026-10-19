import "dotenv/config";
import { execSync } from "child_process";
import { randomUUID } from "crypto";
import * as ExcelJS from "exceljs";
import { PrismaClient, PhoneType, type Prisma } from "@prisma/client";
import { areNameMultisetsEqual } from "../modules/afiliaciones/associates-integration/Services/SieNameReconciliation";
import type { SanitizedSieAssociate } from "../modules/afiliaciones/associates-integration/Models/SieAssociateList";

const prisma = new PrismaClient();
const AWS_ACCOUNT = "564914947461";
const AWS_REGION = "us-east-2";
const PAGE_SIZE = 500;
const HOME_ADDRESS_TYPE_ID = 1;
const MAX_STREET_LENGTH = 255;
const MAX_PHONE_LENGTH = 50;

// SIE PaisNombre (en mayúsculas, sin tildes) → iso_code canónico V2 cuando el
// nombre SIE no coincide directamente con el nombre del catálogo.
const SIE_COUNTRY_OVERRIDE: Record<string, string> = {
  "USA - ESTADOS UNIDOS": "USA",
  "UNITED KINGDOM": "GBR",
  "KOREA": "KOR",
};

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function padCode(value: string | null | undefined, length: number): string | null {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return null;
  return trimmed.padStart(length, "0");
}

function parseBirthDate(value: string | null | undefined): Date | null {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(trimmed);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 1900 || year > 2010 || month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return date;
}

function detectPhoneType(phone: string): PhoneType {
  const digits = phone.replace(/\D/g, "");
  return digits.length === 9 && digits.startsWith("9") ? PhoneType.MOBILE : PhoneType.LANDLINE;
}

function assertExecutionTarget(argv: string[], mode: string): void {
  const envIdx = argv.indexOf("--environment");
  const environment = envIdx !== -1 ? argv[envIdx + 1] : "local";
  if (environment === "prod" || environment === "qa") {
    if (mode !== "execute") throw new Error(`${environment.toUpperCase()} requiere --execute explícito.`);
    if (!argv.includes("--confirm")) throw new Error(`${environment.toUpperCase()} requiere --confirm explícito.`);
    const env = { ...process.env };
    delete env.AWS_ACCESS_KEY_ID;
    delete env.AWS_SECRET_ACCESS_KEY;
    delete env.AWS_SESSION_TOKEN;
    env.AWS_PROFILE = "sara-aws-cli";
    env.AWS_DEFAULT_REGION = AWS_REGION;
    const account = execSync("aws sts get-caller-identity --query Account --output text", { encoding: "utf8", env }).trim();
    if (account !== AWS_ACCOUNT) throw new Error(`REFUSE_WRONG_AWS_ACCOUNT: ${account}. Se espera ${AWS_ACCOUNT}.`);
    return;
  }
  const url = process.env.DATABASE_URL ?? "";
  let hostname = "";
  try { hostname = new URL(url).hostname; } catch { throw new Error("DATABASE_URL inválida."); }
  const local = ["localhost", "127.0.0.1", "::1"].includes(hostname.toLowerCase());
  if (!local) throw new Error(`REFUSE_NON_LOCAL_TARGET: host ${hostname}. Para PROD usa --environment prod --execute --confirm.`);
}

function parseArgs(argv: string[]): { mode: "dry-run" | "execute"; limit: number; batchSize: number } {
  let mode: "dry-run" | "execute" = "dry-run";
  let limit = Infinity;
  let batchSize = 100;
  for (let i = 2; i < argv.length; i += 1) {
    if (argv[i] === "--execute" || argv[i] === "execute") mode = "execute";
    else if (argv[i] === "--dry-run" || argv[i] === "dry-run") mode = "dry-run";
    else if (argv[i] === "--limit") { limit = Number(argv[++i]); }
    else if (argv[i] === "--batch-size") { batchSize = Number(argv[++i]); }
  }
  if (!Number.isFinite(limit) || limit < 1) limit = Infinity;
  if (!Number.isInteger(batchSize) || batchSize < 1) batchSize = 100;
  return { mode, limit, batchSize };
}

async function q<T = any>(sql: string, ...params: unknown[]): Promise<T[]> {
  return prisma.$queryRawUnsafe(sql, ...params) as Promise<T[]>;
}

async function loadSieMap(): Promise<Map<string, SanitizedSieAssociate>> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(process.env.SIE_EXCEL_PATH ?? "C:/Users/maxic/Downloads/ASOCIADOS.xlsx");
  const ws = wb.worksheets[0];
  const map = new Map<string, SanitizedSieAssociate>();
  ws.eachRow((row, n) => {
    if (n === 1) return;
    const cell = (col: number) => {
      const c = row.getCell(col);
      const v = c.text ?? c.value;
      return typeof v === "string" ? v.trim() : v == null ? "" : String(v).trim();
    };
    const externalCode = cell(3);
    if (!externalCode) return;
    // NOTA: la columna 4 (Clave) se omite deliberadamente; no se procesa.
    map.set(externalCode, {
      documentType: cell(1),
      documentNumber: cell(2),
      externalCode,
      sourceType: cell(5),
      sourceDescription: cell(6),
      passwordPresent: false,
      nombres: cell(7) || null,
      apellidoPaterno: cell(8) || null,
      apellidoMaterno: cell(9) || null,
      fechaNacimiento: cell(10) || null,
      telefono: cell(11) || null,
      correo: cell(12) || null,
      direccion: cell(13) || null,
      pais: cell(14) || null,
      paisNombre: cell(15) || null,
      departamento: cell(16) || null,
      departamentoNombre: cell(17) || null,
      provincia: cell(18) || null,
      provinciaNombre: cell(19) || null,
      distrito: cell(20) || null,
      distritoNombre: cell(21) || null,
    });
  });
  return map;
}

interface GeoCatalog {
  countryByIso: Map<string, number>;
  countryByNormalizedName: Map<string, number>;
  departmentByUbigeo: Map<string, number>;
  provinceByUbigeo: Map<string, number>;
  districtByUbigeo: Map<string, number>;
  districtByLegacyCode: Map<string, number>;
}

async function loadGeoCatalog(): Promise<GeoCatalog> {
  const countries = await q<{ id: number; iso_code: string; name: string }>(`SELECT id, iso_code, name FROM catalog_countries`);
  const departments = await q<{ id: number; ubigeo_code: string }>(`SELECT id, ubigeo_code FROM catalog_departments WHERE country_id=1`);
  const provinces = await q<{ id: number; ubigeo_code: string }>(`SELECT id, ubigeo_code FROM catalog_provinces`);
  const districts = await q<{ id: number; ubigeo_code: string; code: string | null }>(`SELECT id, ubigeo_code, code FROM catalog_districts`);

  const countryByIso = new Map<string, number>();
  const countryByNormalizedName = new Map<string, number>();
  for (const c of countries) {
    if (!countryByIso.has(c.iso_code)) countryByIso.set(c.iso_code, c.id);
    const key = normalize(c.name);
    if (!countryByNormalizedName.has(key)) countryByNormalizedName.set(key, c.id);
  }
  const departmentByUbigeo = new Map<string, number>();
  for (const d of departments) if (!departmentByUbigeo.has(d.ubigeo_code)) departmentByUbigeo.set(d.ubigeo_code, d.id);
  const provinceByUbigeo = new Map<string, number>();
  for (const p of provinces) if (!provinceByUbigeo.has(p.ubigeo_code)) provinceByUbigeo.set(p.ubigeo_code, p.id);
  const districtByUbigeo = new Map<string, number>();
  const districtByLegacyCode = new Map<string, number>();
  for (const d of districts) {
    if (!districtByUbigeo.has(d.ubigeo_code)) districtByUbigeo.set(d.ubigeo_code, d.id);
    if (d.code && d.code.startsWith("LEG-75:")) {
      if (!districtByLegacyCode.has(d.code)) districtByLegacyCode.set(d.code, d.id);
    }
  }

  return { countryByIso, countryByNormalizedName, departmentByUbigeo, provinceByUbigeo, districtByUbigeo, districtByLegacyCode };
}

function resolveCountry(geo: GeoCatalog, record: SanitizedSieAssociate): { countryId: number | null; unmapped: boolean } {
  const rawName = (record.paisNombre ?? "").trim();
  if (!rawName) return { countryId: null, unmapped: false };
  const upper = rawName.toUpperCase();
  if (SIE_COUNTRY_OVERRIDE[upper]) {
    const iso = SIE_COUNTRY_OVERRIDE[upper];
    const id = geo.countryByIso.get(iso);
    return id ? { countryId: id, unmapped: false } : { countryId: null, unmapped: true };
  }
  const key = normalize(rawName);
  const id = geo.countryByNormalizedName.get(key);
  return id ? { countryId: id, unmapped: false } : { countryId: null, unmapped: true };
}

function resolveDistrict(geo: GeoCatalog, record: SanitizedSieAssociate): number | null {
  if ((record.paisNombre ?? "").trim().toUpperCase() !== "PERU") return null;
  const dept = padCode(record.departamento, 2);
  const prov = padCode(record.provincia, 2);
  const dist = padCode(record.distrito, 2);
  if (!dept || !prov || !dist) return null;
  const districtUbigeo = dept + prov + dist;
  const byUbigeo = geo.districtByUbigeo.get(districtUbigeo);
  if (byUbigeo) return byUbigeo;
  const rawDept = (record.departamento ?? "").trim();
  const rawProv = (record.provincia ?? "").trim();
  const rawDist = (record.distrito ?? "").trim();
  return geo.districtByLegacyCode.get(`LEG-75:${rawDept}:${rawProv}:${rawDist}`) ?? null;
}

interface HistoricalRow {
  person_id: number;
  document_type: string;
  document_number: string;
  first_name: string;
  paternal_last_name: string;
  maternal_last_name: string | null;
  external_codes: string[];
  has_birth: boolean;
  has_nationality: boolean;
  has_phone: boolean;
  has_address: boolean;
}

async function loadHistoricalPersons(): Promise<HistoricalRow[]> {
  const persons = await q<{ person_id: number; document_type: string; document_number: string; first_name: string; paternal_last_name: string; maternal_last_name: string | null }>(`
    SELECT DISTINCT pe.id AS person_id, pe.document_type, pe.document_number, pe.first_name, pe.paternal_last_name, pe.maternal_last_name
    FROM sie_associate_records s
    JOIN persons pe ON pe.id = s.person_id AND pe.deleted_at IS NULL
    WHERE s.provider='SIE' AND s.link_status='LINKED' AND s.person_id IS NOT NULL
    ORDER BY pe.id
  `);
  const codes = await q<{ person_id: number; external_code: string }>(`
    SELECT s.person_id, s.external_code FROM sie_associate_records s
    JOIN persons pe ON pe.id = s.person_id AND pe.deleted_at IS NULL
    WHERE s.provider='SIE' AND s.link_status='LINKED' AND s.person_id IS NOT NULL
    ORDER BY s.person_id, s.external_code
  `);
  const codeByPerson = new Map<number, string[]>();
  for (const c of codes) {
    if (!codeByPerson.has(c.person_id)) codeByPerson.set(c.person_id, []);
    codeByPerson.get(c.person_id)!.push(c.external_code);
  }
  const withBirth = await q<{ id: number }>(`SELECT id FROM persons WHERE birth_date IS NOT NULL`);
  const withNat = await q<{ id: number }>(`SELECT id FROM persons WHERE nationality_id IS NOT NULL`);
  const withPhone = await q<{ person_id: number }>(`SELECT DISTINCT person_id FROM person_contacts WHERE phone_number IS NOT NULL AND phone_number <> ''`);
  const withAddress = await q<{ person_id: number }>(`SELECT DISTINCT person_id FROM person_addresses`);
  const birthSet = new Set(withBirth.map((r) => r.id));
  const natSet = new Set(withNat.map((r) => r.id));
  const phoneSet = new Set(withPhone.map((r) => r.person_id));
  const addressSet = new Set(withAddress.map((r) => r.person_id));

  return persons.map((p) => ({
    person_id: p.person_id,
    document_type: p.document_type,
    document_number: p.document_number,
    first_name: p.first_name,
    paternal_last_name: p.paternal_last_name,
    maternal_last_name: p.maternal_last_name,
    external_codes: codeByPerson.get(p.person_id) ?? [],
    has_birth: birthSet.has(p.person_id),
    has_nationality: natSet.has(p.person_id),
    has_phone: phoneSet.has(p.person_id),
    has_address: addressSet.has(p.person_id),
  }));
}

interface EnrichmentPlan {
  person: HistoricalRow;
  record: SanitizedSieAssociate;
  birthDate: Date | null;
  countryId: number | null;
  districtId: number | null;
  phone: string | null;
  street: string | null;
  identityConflict: boolean;
  countryUnmapped: boolean;
}

function buildPlan(geo: GeoCatalog, person: HistoricalRow, records: SanitizedSieAssociate[]): EnrichmentPlan | null {
  if (records.length === 0) return null;
  const merged = mergeRecords(records);
  const identityOk = records.some((record) =>
    areNameMultisetsEqual(
      { nombres: record.nombres ?? null, apellidoPaterno: record.apellidoPaterno ?? null, apellidoMaterno: record.apellidoMaterno ?? null },
      { firstName: person.first_name, paternalLastName: person.paternal_last_name, maternalLastName: person.maternal_last_name },
    ),
  );
  const docOk = records.some((record) => record.documentNumber === person.document_number);
  const identityConflict = !identityOk || !docOk;

  const birthDate = !person.has_birth ? parseBirthDate(merged.fechaNacimiento) : null;
  const { countryId, unmapped: countryUnmapped } = !person.has_nationality ? resolveCountry(geo, merged) : { countryId: null, unmapped: false };
  const districtId = !person.has_address ? resolveDistrict(geo, merged) : null;
  const phone = !person.has_phone ? normalizePhone(merged.telefono) : null;
  const street = !person.has_address ? normalizeStreet(merged.direccion) : null;

  return { person, record: merged, birthDate, countryId, districtId, phone, street, identityConflict, countryUnmapped };
}

function mergeRecords(records: SanitizedSieAssociate[]): SanitizedSieAssociate {
  const base: SanitizedSieAssociate = { ...records[0] };
  const mergeField = (field: keyof SanitizedSieAssociate) => {
    if (!base[field]) {
      for (const r of records) {
        if (r[field]) { (base as Record<string, unknown>)[field] = r[field]; break; }
      }
    }
  };
  (["fechaNacimiento", "telefono", "direccion", "pais", "paisNombre", "departamento", "departamentoNombre", "provincia", "provinciaNombre", "distrito", "distritoNombre", "nombres", "apellidoPaterno", "apellidoMaterno", "documentNumber", "documentType"] as const).forEach(mergeField);
  return base;
}

function normalizePhone(value: string | null | undefined): string | null {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return null;
  return trimmed.slice(0, MAX_PHONE_LENGTH);
}

function normalizeStreet(value: string | null | undefined): string | null {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return null;
  return trimmed.slice(0, MAX_STREET_LENGTH);
}

async function enrichPerson(runId: string, plan: EnrichmentPlan): Promise<{ updated: boolean; fields: string[] }> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`sie-profile-enrich:${plan.person.person_id}`}))`;
    const fields: string[] = [];

    if (plan.birthDate) {
      const current = await tx.person.findUnique({ where: { id: plan.person.person_id }, select: { birthDate: true } });
      if (!current?.birthDate) {
        await tx.person.update({ where: { id: plan.person.person_id }, data: { birthDate: plan.birthDate } });
        fields.push("birthDate");
      }
    }
    if (plan.countryId) {
      const current = await tx.person.findUnique({ where: { id: plan.person.person_id }, select: { nationalityId: true } });
      if (!current?.nationalityId) {
        await tx.person.update({ where: { id: plan.person.person_id }, data: { nationalityId: plan.countryId } });
        fields.push("nationality");
      }
    }
    if (plan.phone) {
      const existing = await tx.personContact.findFirst({ where: { personId: plan.person.person_id } });
      if (existing) {
        if (!existing.phoneNumber) {
          await tx.personContact.update({ where: { id: existing.id }, data: { phoneNumber: plan.phone, phoneType: detectPhoneType(plan.phone) } });
          fields.push("phone");
        }
      } else {
        await tx.personContact.create({ data: { personId: plan.person.person_id, phoneNumber: plan.phone, phoneType: detectPhoneType(plan.phone), isPrimary: true } });
        fields.push("phone");
      }
    }
    if (plan.street) {
      const existing = await tx.address.findFirst({ where: { personId: plan.person.person_id } });
      if (!existing) {
        await tx.address.create({
          data: {
            personId: plan.person.person_id,
            countryId: plan.countryId ?? null,
            districtId: plan.districtId,
            addressTypeId: HOME_ADDRESS_TYPE_ID,
            street: plan.street,
            isPrimary: true,
          },
        });
        fields.push("address");
      }
    }

    if (fields.length > 0) {
      await tx.auditLog.create({
        data: {
          action: "SIE_HISTORICAL_PROFILE_ENRICHMENT",
          entity: "persons",
          entityId: String(plan.person.person_id),
          newValues: { recoveryRunId: runId, personId: plan.person.person_id, externalCode: plan.record.externalCode, filledFields: fields },
        },
      });
    }
    return { updated: fields.length > 0, fields };
  }, { maxWait: 60000, timeout: 60000 });
}

async function enrichWithRetry(runId: string, plan: EnrichmentPlan): Promise<{ updated: boolean; fields: string[] }> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try { return await enrichPerson(runId, plan); } catch (error) { lastError = error; await new Promise((r) => setTimeout(r, 1500 * attempt)); }
  }
  throw new Error(`ANOMALÍA persona ${plan.person.person_id}: ${lastError instanceof Error ? lastError.message : String(lastError)}`);
}

async function main() {
  const { mode, limit, batchSize } = parseArgs(process.argv);
  assertExecutionTarget(process.argv, mode);

  const [sieMap, geo, persons] = await Promise.all([loadSieMap(), loadGeoCatalog(), loadHistoricalPersons()]);

  const counts = {
    HISTORICAL_PERSONS_ANALYZED: persons.length,
    PROFILES_WITH_MISSING_DATA: 0,
    ELIGIBLE: 0,
    IDENTITY_CONFLICTS: 0,
    COUNTRY_UNMAPPED: 0,
    BIRTHDATES_COMPLETED: 0,
    NATIONALITIES_COMPLETED: 0,
    PHONES_COMPLETED: 0,
    ADDRESSES_COMPLETED: 0,
    COUNTRIES_MAPPED: new Set<string>(),
    DEPARTMENTS_MAPPED: new Set<string>(),
    PROVINCES_MAPPED: new Set<string>(),
    DISTRICTS_MAPPED: new Set<string>(),
  };

  const plans: EnrichmentPlan[] = [];
  for (const person of persons) {
    const records = person.external_codes.map((code) => sieMap.get(code)).filter((r): r is SanitizedSieAssociate => Boolean(r));
    const plan = buildPlan(geo, person, records);
    if (!plan) continue;
    if (plan.identityConflict) { counts.IDENTITY_CONFLICTS += 1; continue; }
    if (plan.countryUnmapped) { counts.COUNTRY_UNMAPPED += 1; }
    const hasWork = Boolean(plan.birthDate || plan.countryId || plan.phone || plan.street);
    if (!hasWork) continue;
    counts.PROFILES_WITH_MISSING_DATA += 1;
    if (plan.birthDate) counts.BIRTHDATES_COMPLETED += 1;
    if (plan.countryId) counts.NATIONALITIES_COMPLETED += 1;
    if (plan.phone) counts.PHONES_COMPLETED += 1;
    if (plan.street) counts.ADDRESSES_COMPLETED += 1;
    if (plan.countryId) counts.COUNTRIES_MAPPED.add(plan.record.paisNombre ?? "");
    if (plan.districtId) {
      const dept = padCode(plan.record.departamento, 2);
      const prov = padCode(plan.record.provincia, 2);
      const dist = padCode(plan.record.distrito, 2);
      if (dept) counts.DEPARTMENTS_MAPPED.add(dept);
      if (dept && prov) counts.PROVINCES_MAPPED.add(dept + prov);
      if (dept && prov && dist) counts.DISTRICTS_MAPPED.add(dept + prov + dist);
    }
    plans.push(plan);
  }
  counts.ELIGIBLE = plans.length;

  console.log(JSON.stringify({
    ...counts,
    COUNTRIES_MAPPED: counts.COUNTRIES_MAPPED.size,
    DEPARTMENTS_MAPPED: counts.DEPARTMENTS_MAPPED.size,
    PROVINCES_MAPPED: counts.PROVINCES_MAPPED.size,
    DISTRICTS_MAPPED: counts.DISTRICTS_MAPPED.size,
    mode,
    limit: Number.isFinite(limit) ? limit : null,
    batchSize,
  }, null, 2));

  if (mode === "dry-run") { console.log("DRY-RUN: sin escrituras."); return; }
  if (!process.argv.includes("--confirm")) { console.log("MODO EXECUTE requiere confirmación explícita: --execute --confirm"); return; }

  const runId = `sie-profile-enrich-${randomUUID()}`;
  const work = plans.slice(0, limit);
  let updated = 0;
  const fieldsCount: Record<string, number> = {};
  for (let i = 0; i < work.length; i += batchSize) {
    const batch = work.slice(i, i + batchSize);
    for (const plan of batch) {
      const r = await enrichWithRetry(runId, plan);
      if (r.updated) {
        updated += 1;
        for (const f of r.fields) fieldsCount[f] = (fieldsCount[f] ?? 0) + 1;
      }
    }
    console.log(`LOTE acumulado: updated=${updated}`);
  }
  console.log(JSON.stringify({ runId, updated, fieldsCount }, null, 2));
}

main().catch((e) => { console.error("FATAL:", e instanceof Error ? e.message : String(e)); process.exit(1); }).finally(() => prisma.$disconnect());
