import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { AssociatesApiClient } from "../modules/afiliaciones/associates-integration/Clients/AssociatesApiClient";
import { getAssociatesApiConfig } from "../modules/afiliaciones/associates-integration/Config/AssociatesApiConfig";
import { mapSieDocumentType } from "../modules/afiliaciones/associates-integration/Mappers/SieAssociateListMapper";
import type { SanitizedSieAssociate } from "../modules/afiliaciones/associates-integration/Models/SieAssociateList";

/**
 * Dry-run combinado (solo lectura) para SIE → QA, optimizado contra el
 * problema N+1: carga TODA la data local en pocas consultas y clasifica en
 * memoria, SIN cambiar reglas de negocio ni criterios de clasificación de
 * `sie-account-reconciliation.ts` ni `sie-historical-dry-run.ts`.
 */

const PAGE_SIZE = 500;
const HISTORICAL = ["T", "V", "H", "F", "R", "X", "U"];

function norm(value: string | null | undefined): string {
  if (!value) return "";
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

type PersonRow = {
  id: number;
  documentType: string;
  documentNumber: string;
  firstName: string;
  paternalLastName: string;
  maternalLastName: string | null;
  birthDate: Date | null;
  contacts: Array<{ email: string | null; phoneNumber: string | null; isPrimary: boolean; createdAt: Date }>;
  addresses: Array<{ street: string | null; countryId: number | null; districtId: number | null; isPrimary: boolean }>;
  applications: Array<{ email: string | null; affiliateType: string | null; createdAt: Date }>;
  user: { id: number; type: string; status: string; roleSlug: string | null; activePasswordCount: number } | null;
};

function primaryContactEmail(p: PersonRow): string | null {
  const withEmail = p.contacts.filter((c) => c.email).sort((a, b) => (Number(b.isPrimary) - Number(a.isPrimary)) || (a.createdAt.getTime() - b.createdAt.getTime()));
  return withEmail[0]?.email ?? null;
}

function primaryContactPhone(p: PersonRow): string | null {
  const primaries = p.contacts.filter((c) => c.isPrimary);
  return primaries[0]?.phoneNumber ?? null;
}

function primaryAddress(p: PersonRow): { street: string | null; countryId: number | null; districtId: number | null } {
  const primaries = p.addresses.filter((a) => a.isPrimary);
  return primaries[0] ?? { street: null, countryId: null, districtId: null };
}

function latestApplication(p: PersonRow): { email: string | null; affiliateType: string | null } {
  const sorted = [...p.applications].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  return sorted[0] ?? { email: null, affiliateType: null };
}

async function main(): Promise<void> {
  const prisma = new PrismaClient();
  const result: Record<string, unknown> = { status: "FAIL", error: null };
  try {
    // 1) SIE completo (todas las páginas).
    const client = new AssociatesApiClient(getAssociatesApiConfig());
    const first = await client.listAssociates({ pagina: 1, tamanioPagina: PAGE_SIZE });
    const pages = [first];
    for (let page = 2; page <= (first.totalPaginas || 1); page += 1) {
      pages.push(await client.listAssociates({ pagina: page, tamanioPagina: PAGE_SIZE }));
    }
    const records: SanitizedSieAssociate[] = pages.flatMap((p) => p.associates);

    // 2) Carga masiva local (pocas consultas).
    const [persons, users, sieCodes, countries, departments, provinces, districts] = await Promise.all([
      prisma.person.findMany({
        select: {
          id: true,
          documentType: true,
          documentNumber: true,
          firstName: true,
          paternalLastName: true,
          maternalLastName: true,
          birthDate: true,
          contacts: { select: { email: true, phoneNumber: true, isPrimary: true, createdAt: true } },
          addresses: { select: { street: true, countryId: true, districtId: true, isPrimary: true } },
          applications: { select: { email: true, affiliateType: true, createdAt: true } },
          user: { select: { id: true, type: true, status: true, role: { select: { slug: true } }, credentials: { where: { type: "PASSWORD", isActive: true }, select: { id: true } } } },
        },
      }),
      prisma.user.findMany({ select: { email: true, personId: true } }),
      prisma.sieAssociateRecord.findMany({ select: { externalCode: true } }),
      prisma.country.findMany({ select: { id: true, name: true } }),
      prisma.department.findMany({ select: { id: true, name: true } }),
      prisma.province.findMany({ select: { id: true, name: true } }),
      prisma.district.findMany({ select: { id: true, name: true, province: { select: { name: true, department: { select: { name: true, country: { select: { id: true, name: true } } } } } } } }),
    ]);

    const personByDoc = new Map<string, PersonRow>();
    for (const p of persons) {
      personByDoc.set(`${p.documentType}|${p.documentNumber}`, {
        ...p,
        user: p.user ? { id: p.user.id, type: p.user.type, status: p.user.status, roleSlug: p.user.role?.slug ?? null, activePasswordCount: p.user.credentials.length } : null,
      });
    }
    const userOwnerByEmail = new Map<string, number>();
    for (const u of users) {
      const e = u.email?.trim().toLowerCase();
      if (e && !userOwnerByEmail.has(e)) userOwnerByEmail.set(e, u.personId ?? -1);
    }
    const storedCodes = new Set(sieCodes.map((s) => s.externalCode));

    const countryByName = new Map<string, number>();
    for (const c of countries) countryByName.set(norm(c.name), c.id);
    const departmentByName = new Map<string, number>();
    for (const d of departments) departmentByName.set(norm(d.name), d.id);
    const provinceByName = new Map<string, number>();
    for (const p of provinces) provinceByName.set(norm(p.name), p.id);
    const districtByName = new Map<string, { id: number; countryName: string; departmentName: string; provinceName: string }>();
    for (const d of districts) {
      districtByName.set(norm(d.name), { id: d.id, countryName: d.province.department.country.name, departmentName: d.province.department.name, provinceName: d.province.name });
    }

    // 3) Clasificación en memoria — A/E (reconciliación de cuentas).
    const ae = records.filter((r) => r.sourceType === "A" || r.sourceType === "E");
    const activeRecords = ae.filter((r) => r.sourceType === "A");
    const studentRecords = ae.filter((r) => r.sourceType === "E");

    let totalMatched = 0, totalNotFound = 0, documentTypeUnmapped = 0;
    let emailAvailable = 0, emailMissing = 0, emailConflicts = 0;
    let categoryMatch = 0, categoryMismatch = 0, categoryLocalMissing = 0;
    let sieCodeAlreadyStored = 0, sieCodeToCreate = 0;
    let userAlreadyExists = 0, usersWithOneActivePassword = 0, usersWithMultipleActivePasswords = 0;
    let activeReady = 0, studentReady = 0;
    const groupCounts = { READY_CREATE_USER_AND_CREDENTIAL: 0, PRESERVE_EXISTING_ACCOUNT: 0, MANUAL_REVIEW: 0, SKIP: 0 };

    for (const record of ae) {
      const isActive = record.sourceType === "A";
      const expectedAffiliate = isActive ? "ACTIVE" : "STUDENT";
      const docType = mapSieDocumentType(record.documentType);
      const ctx: { status: string; email: string | null; emailConflict: boolean; localAffiliateType: string | null; user: PersonRow["user"] } = { status: "DOCUMENT_TYPE_UNMAPPED", email: null, emailConflict: false, localAffiliateType: null, user: null };

      if (!docType || !record.documentNumber) {
        documentTypeUnmapped += 1;
      } else {
        const person = personByDoc.get(`${docType}|${record.documentNumber}`);
        if (!person) {
          ctx.status = "NOT_FOUND";
          totalNotFound += 1;
        } else {
          ctx.status = "MATCHED";
          totalMatched += 1;
          const app = latestApplication(person);
          ctx.email = primaryContactEmail(person) ?? app.email ?? null;
          ctx.localAffiliateType = app.affiliateType ?? null;
          ctx.user = person.user;
          if (ctx.email) {
            const owner = userOwnerByEmail.get(ctx.email.trim().toLowerCase());
            if (owner !== undefined && owner !== person.id) ctx.emailConflict = true;
          }
        }
      }

      if (ctx.status === "MATCHED") {
        if (ctx.email && !ctx.emailConflict) emailAvailable += 1;
        else if (!ctx.email) emailMissing += 1;
        else emailConflicts += 1;

        if (ctx.localAffiliateType === null) categoryLocalMissing += 1;
        else if (ctx.localAffiliateType !== expectedAffiliate) categoryMismatch += 1;
        else categoryMatch += 1;

        if (ctx.user) {
          userAlreadyExists += 1;
          if (ctx.user.activePasswordCount === 1) usersWithOneActivePassword += 1;
          else if (ctx.user.activePasswordCount > 1) usersWithMultipleActivePasswords += 1;
        }
      }

      if (storedCodes.has(record.externalCode)) sieCodeAlreadyStored += 1;
      else sieCodeToCreate += 1;

      let group: string;
      if (ctx.status === "DOCUMENT_TYPE_UNMAPPED" || ctx.status === "NOT_FOUND") group = "MANUAL_REVIEW";
      else if (ctx.user && ctx.user.activePasswordCount === 1) group = "PRESERVE_EXISTING_ACCOUNT";
      else if (ctx.user && (ctx.user.activePasswordCount === 0 || ctx.user.activePasswordCount > 1)) group = "MANUAL_REVIEW";
      else if (ctx.emailConflict || !ctx.email) group = "MANUAL_REVIEW";
      else if (ctx.localAffiliateType !== null && ctx.localAffiliateType !== expectedAffiliate) group = "MANUAL_REVIEW";
      else if (!record.passwordPresent) group = "SKIP";
      else group = "READY_CREATE_USER_AND_CREDENTIAL";

      (groupCounts as Record<string, number>)[group] += 1;
      if (group === "READY_CREATE_USER_AND_CREDENTIAL") {
        if (isActive) activeReady += 1; else studentReady += 1;
      }
    }

    // 4) Clasificación en memoria — históricos (migración de personas).
    const activeExcluded = records.filter((r) => r.sourceType === "A").length;
    const studentExcluded = records.filter((r) => r.sourceType === "E").length;
    const historical = records.filter((r) => HISTORICAL.includes(r.sourceType));

    const missingFieldCounts: Record<string, number> = {};
    const ubigeoCounts = { UBIGEO_EXACT_MATCH: 0, UBIGEO_NAME_MATCH: 0, UBIGEO_PARTIAL: 0, UBIGEO_NOT_FOUND: 0, UBIGEO_NULL: 0 };
    let personAlreadyExists = 0, wouldCreatePerson = 0, wouldCreateContact = 0, wouldCreateAddress = 0;
    let wouldLinkExistingPerson = 0, wouldCreateAndLinkPerson = 0, wouldLeaveUnlinked = 0, wouldMarkConflict = 0;
    let personDataConflicts = 0, documentConflicts = 0;

    for (const record of historical) {
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
      for (const f of missing) missingFieldCounts[f] = (missingFieldCounts[f] ?? 0) + 1;

      const hasGeo = record.paisNombre || record.departamentoNombre || record.provinciaNombre || record.distritoNombre || record.pais || record.departamento || record.provincia || record.distrito;
      let ubigeo = "UBIGEO_NULL";
      if (hasGeo) {
        const district = record.distritoNombre ? districtByName.get(norm(record.distritoNombre)) : undefined;
        if (district) {
          const chainConsistent = (!record.departamentoNombre || norm(district.departmentName) === norm(record.departamentoNombre)) && (!record.provinciaNombre || norm(district.provinceName) === norm(record.provinciaNombre)) && (!record.paisNombre || norm(district.countryName) === norm(record.paisNombre));
          ubigeo = chainConsistent ? "UBIGEO_EXACT_MATCH" : "UBIGEO_NAME_MATCH";
        } else if ((record.paisNombre && countryByName.has(norm(record.paisNombre))) || (record.departamentoNombre && departmentByName.has(norm(record.departamentoNombre))) || (record.provinciaNombre && provinceByName.has(norm(record.provinciaNombre)))) {
          ubigeo = "UBIGEO_PARTIAL";
        } else {
          ubigeo = "UBIGEO_NOT_FOUND";
        }
      }
      (ubigeoCounts as Record<string, number>)[ubigeo] += 1;

      if (record.telefono || record.correo) wouldCreateContact += 1;
      if (record.direccion || record.paisNombre || record.departamentoNombre || record.provinciaNombre || record.distritoNombre) wouldCreateAddress += 1;

      const docType = mapSieDocumentType(record.documentType);
      if (!docType || !record.documentNumber) {
        documentConflicts += 1;
        continue;
      }
      const person = personByDoc.get(`${docType}|${record.documentNumber}`);
      if (person) {
        personAlreadyExists += 1;
        let conflict = false;
        if (record.nombres && person.firstName && norm(record.nombres) !== norm(person.firstName)) conflict = true;
        if (record.apellidoPaterno && person.paternalLastName && norm(record.apellidoPaterno) !== norm(person.paternalLastName)) conflict = true;
        if (record.apellidoMaterno && person.maternalLastName && norm(record.apellidoMaterno) !== norm(person.maternalLastName)) conflict = true;
        if (record.correo && primaryContactEmail(person) && norm(record.correo) !== norm(primaryContactEmail(person))) conflict = true;
        if (record.telefono && primaryContactPhone(person) && norm(record.telefono) !== norm(primaryContactPhone(person))) conflict = true;
        const addr = primaryAddress(person);
        if (record.direccion && addr.street && norm(record.direccion) !== norm(addr.street)) conflict = true;
        if (conflict) { wouldMarkConflict += 1; personDataConflicts += 1; }
        else wouldLinkExistingPerson += 1;
      } else {
        if (record.nombres && record.apellidoPaterno) { wouldCreatePerson += 1; wouldCreateAndLinkPerson += 1; }
        else wouldLeaveUnlinked += 1;
      }
    }

    result.status = "PASS";
    result.sie_total = records.length;
    result.sie_active = activeRecords.length;
    result.sie_student = studentRecords.length;
    result.ae_total = ae.length;
    result.historical_total = historical.length;
    result.account_reconciliation = {
      total_matched: totalMatched,
      total_not_found: totalNotFound,
      document_type_unmapped: documentTypeUnmapped,
      email_available: emailAvailable,
      email_missing: emailMissing,
      email_conflicts: emailConflicts,
      category_match: categoryMatch,
      category_mismatch: categoryMismatch,
      category_local_missing: categoryLocalMissing,
      user_already_exists: userAlreadyExists,
      users_with_one_active_password: usersWithOneActivePassword,
      users_with_multiple_active_passwords: usersWithMultipleActivePasswords,
      sie_code_already_stored: sieCodeAlreadyStored,
      sie_code_to_create: sieCodeToCreate,
      ready_create_user_and_credential: groupCounts.READY_CREATE_USER_AND_CREDENTIAL,
      preserve_existing_account: groupCounts.PRESERVE_EXISTING_ACCOUNT,
      manual_review: groupCounts.MANUAL_REVIEW,
      skip: groupCounts.SKIP,
      active_ready: activeReady,
      student_ready: studentReady,
    };
    result.historical_migration = {
      person_already_exists: personAlreadyExists,
      would_create_person: wouldCreatePerson,
      would_create_contact: wouldCreateContact,
      would_create_address: wouldCreateAddress,
      would_link_existing_person: wouldLinkExistingPerson,
      would_create_and_link_person: wouldCreateAndLinkPerson,
      would_leave_unlinked: wouldLeaveUnlinked,
      would_mark_conflict: wouldMarkConflict,
      person_data_conflicts: personDataConflicts,
      document_conflicts: documentConflicts,
      null_personal_data: missingFieldCounts,
      ubigeo: ubigeoCounts,
    };

    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    result.error = error instanceof Error ? error.message : String(error);
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main();
