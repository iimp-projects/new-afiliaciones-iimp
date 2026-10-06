import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient, UserType, UserStatus } from "@prisma/client";
import { AssociatesApiClient } from "../modules/afiliaciones/associates-integration/Clients/AssociatesApiClient";
import { getAssociatesApiConfig } from "../modules/afiliaciones/associates-integration/Config/AssociatesApiConfig";
import { mapSieDocumentType } from "../modules/afiliaciones/associates-integration/Mappers/SieAssociateListMapper";
import { loginService } from "../modules/auth/login/service";
import type { SanitizedSieAssociate } from "../modules/afiliaciones/associates-integration/Models/SieAssociateList";

const PAGE_SIZE = 500;
const BCRYPT_COST = 12;

type PersonContext = {
  status: "MATCHED" | "NOT_FOUND" | "DOCUMENT_TYPE_UNMAPPED";
  personId: number | null;
  email: string | null;
  localAffiliateType: "ACTIVE" | "STUDENT" | null;
  hasUser: boolean;
};

async function resolvePerson(prisma: PrismaClient, record: SanitizedSieAssociate): Promise<PersonContext> {
  const documentType = mapSieDocumentType(record.documentType);
  if (!documentType || !record.documentNumber) return { status: "DOCUMENT_TYPE_UNMAPPED", personId: null, email: null, localAffiliateType: null, hasUser: false };
  const person = await prisma.person.findUnique({
    where: { documentType_documentNumber: { documentType, documentNumber: record.documentNumber } },
    select: {
      id: true,
      contacts: { where: { email: { not: null } }, orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }], take: 1, select: { email: true } },
      applications: { orderBy: { createdAt: "desc" }, take: 1, select: { email: true, affiliateType: true } },
      user: { select: { id: true } },
    },
  });
  if (!person) return { status: "NOT_FOUND", personId: null, email: null, localAffiliateType: null, hasUser: false };
  return {
    status: "MATCHED",
    personId: person.id,
    email: person.contacts[0]?.email ?? person.applications[0]?.email ?? null,
    localAffiliateType: person.applications[0]?.affiliateType ?? null,
    hasUser: person.user !== null,
  };
}

function isReady(record: SanitizedSieAssociate, ctx: PersonContext): boolean {
  if (ctx.status !== "MATCHED") return false;
  if (!record.passwordPresent) return false;
  if (!ctx.email) return false;
  if (ctx.hasUser) return false;
  const expectedAffiliate = record.sourceType === "A" ? "ACTIVE" : "STUDENT";
  if (ctx.localAffiliateType !== null && ctx.localAffiliateType !== expectedAffiliate) return false;
  return Boolean(record.externalCode);
}

type Candidate = {
  personId: number;
  email: string;
  sourceType: "A" | "E";
  records: Array<{ externalCode: string; sourceType: string; sourceDescription: string | null; documentType: string; documentNumber: string; clave: string | null }>;
};

async function main(): Promise<void> {
  const mode = process.argv[2] === "execute" ? "execute" : "dry-run";
  const prisma = new PrismaClient();
  const result: Record<string, unknown> = { r69_7_status: "FAIL", mode, error: null };
  try {
    const before = {
      authUsers: await prisma.user.count(),
      authCredentials: await prisma.credential.count(),
      sieRecords: await prisma.sieAssociateRecord.count(),
    };

    const roleActive = await prisma.role.findUnique({ where: { slug: "ASOCIADO_ACTIVO" }, select: { id: true } });
    const roleStudent = await prisma.role.findUnique({ where: { slug: "ASOCIADO_ESTUDIANTE" }, select: { id: true } });
    if (!roleActive || !roleStudent) throw new Error("Roles ASOCIADO_ACTIVO/ASOCIADO_ESTUDIANTE no existen.");
    const categoryActive = await prisma.membershipCategory.findUnique({ where: { code: "A" }, select: { id: true } });
    const categoryStudent = await prisma.membershipCategory.findUnique({ where: { code: "E" }, select: { id: true } });

    const client = new AssociatesApiClient(getAssociatesApiConfig());
    const firstPage = await client.listAssociatesWithClave({ pagina: 1, tamanioPagina: PAGE_SIZE });
    const totalPaginas = firstPage.totalPaginas || 1;
    const pages = [firstPage];
    for (let page = 2; page <= totalPaginas; page += 1) pages.push(await client.listAssociatesWithClave({ pagina: page, tamanioPagina: PAGE_SIZE }));
    const ae = pages.flatMap((page) => page.associates).filter((item) => item.record.sourceType === "A" || item.record.sourceType === "E");

    const readyRecords: Array<{ record: SanitizedSieAssociate; clave: string | null; personId: number; email: string; sourceType: "A" | "E" }> = [];
    let manualReviewExcluded = 0;
    let emailConflictsWithAuthUsers = 0;

    for (const item of ae) {
      const ctx = await resolvePerson(prisma, item.record);
      if (!isReady(item.record, ctx)) { manualReviewExcluded += 1; continue; }
      if (ctx.hasUser) { manualReviewExcluded += 1; continue; }
      readyRecords.push({ record: item.record, clave: item.clave, personId: ctx.personId as number, email: (ctx.email as string).trim().toLowerCase(), sourceType: item.record.sourceType as "A" | "E" });
    }

    const byPerson = new Map<number, Candidate>();
    for (const ready of readyRecords) {
      const existing = byPerson.get(ready.personId);
      if (existing) {
        existing.records.push({ externalCode: ready.record.externalCode, sourceType: ready.record.sourceType, sourceDescription: ready.record.sourceDescription ?? null, documentType: ready.record.documentType, documentNumber: ready.record.documentNumber, clave: ready.clave });
      } else {
        byPerson.set(ready.personId, { personId: ready.personId, email: ready.email, sourceType: ready.sourceType, records: [{ externalCode: ready.record.externalCode, sourceType: ready.record.sourceType, sourceDescription: ready.record.sourceDescription ?? null, documentType: ready.record.documentType, documentNumber: ready.record.documentNumber, clave: ready.clave }] });
      }
    }

    let categoryConflicts = 0;
    const emailToPersons = new Map<string, number[]>();
    for (const candidate of byPerson.values()) {
      const categories = new Set(candidate.records.map((r) => r.sourceType));
      if (categories.size > 1) {
        byPerson.delete(candidate.personId);
        categoryConflicts += 1;
        continue;
      }
      const list = emailToPersons.get(candidate.email) ?? [];
      list.push(candidate.personId);
      emailToPersons.set(candidate.email, list);
    }

    const duplicateEmails = new Set<string>();
    for (const [email, personIds] of emailToPersons) {
      if (personIds.length > 1) duplicateEmails.add(email);
    }
    for (const email of duplicateEmails) {
      for (const personId of emailToPersons.get(email) ?? []) byPerson.delete(personId);
    }

    const readyEmails = [...new Set([...byPerson.values()].map((c) => c.email))];
    const existingUsersByEmail = new Map<string, number>();
    for (let i = 0; i < readyEmails.length; i += 500) {
      const chunk = readyEmails.slice(i, i + 500);
      const users = await prisma.user.findMany({ where: { email: { in: chunk, mode: "insensitive" } }, select: { email: true, personId: true } });
      for (const user of users) existingUsersByEmail.set(user.email.toLowerCase(), user.personId ?? -1);
    }
    for (const candidate of [...byPerson.values()]) {
      if (existingUsersByEmail.has(candidate.email)) {
        byPerson.delete(candidate.personId);
        emailConflictsWithAuthUsers += 1;
      }
    }

    const candidates = [...byPerson.values()];
    const activeUsers = candidates.filter((c) => c.sourceType === "A");
    const studentUsers = candidates.filter((c) => c.sourceType === "E");

    result.r69_7_status = "PASS";
    result.ready_set_initial = readyRecords.length;
    result.ready_set_executed = candidates.length;
    result.active_users_to_create = activeUsers.length;
    result.student_users_to_create = studentUsers.length;
    result.users_to_create = candidates.length;
    result.credentials_to_create = candidates.length;
    result.sie_identities_to_create = candidates.reduce((sum, c) => sum + c.records.length, 0);
    result.manual_review_excluded = manualReviewExcluded;
    result.category_conflicts = categoryConflicts;
    result.duplicate_emails_within_ready = duplicateEmails.size;
    result.email_conflicts_with_auth_users = emailConflictsWithAuthUsers;

    if (mode === "dry-run") {
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    let usersCreated = 0;
    let credentialsCreated = 0;
    let sieIdentitiesCreated = 0;
    let bcryptComparePass = 0;
    let bcryptCompareFail = 0;
    const loginCases: Array<{ email: string; clave: string; role: "ACTIVE" | "STUDENT" }> = [];
    let hasActiveCase = false;
    let hasStudentCase = false;

    for (const candidate of candidates) {
      const roleId = candidate.sourceType === "A" ? roleActive.id : roleStudent.id;
      const categoryId = candidate.sourceType === "A" ? categoryActive?.id ?? null : categoryStudent?.id ?? null;
      const clave = candidate.records.find((r) => r.clave)?.clave ?? null;
      if (!clave) continue;
      const hash = await bcrypt.hash(clave, BCRYPT_COST);
      const compareOk = await bcrypt.compare(clave, hash);
      if (compareOk) bcryptComparePass += 1;
      else bcryptCompareFail += 1;

      await prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: { email: candidate.email, personId: candidate.personId, roleId, type: UserType.AFFILIATE, status: UserStatus.ACTIVE, emailVerified: new Date() },
        });
        await tx.credential.create({ data: { userId: user.id, type: "PASSWORD", secret: hash, isActive: true } });
        for (const record of candidate.records) {
          await tx.sieAssociateRecord.upsert({
            where: { provider_externalCode: { provider: "SIE", externalCode: record.externalCode } },
            create: { provider: "SIE", externalCode: record.externalCode, sourceDocumentType: record.documentType || null, documentNumber: record.documentNumber || null, sourceType: record.sourceType, sourceDescription: record.sourceDescription, personId: candidate.personId, categoryId, linkStatus: "LINKED", lastSyncedAt: new Date() },
            update: { personId: candidate.personId, sourceType: record.sourceType, sourceDescription: record.sourceDescription, linkStatus: "LINKED", lastSyncedAt: new Date() },
          });
        }
      });
      usersCreated += 1;
      credentialsCreated += 1;
      sieIdentitiesCreated += candidate.records.length;

      if (!hasActiveCase && candidate.sourceType === "A") {
        hasActiveCase = true;
        loginCases.push({ email: candidate.email, clave, role: "ACTIVE" });
      } else if (!hasStudentCase && candidate.sourceType === "E") {
        hasStudentCase = true;
        loginCases.push({ email: candidate.email, clave, role: "STUDENT" });
      }
    }

    const after = {
      authUsers: await prisma.user.count(),
      authCredentials: await prisma.credential.count(),
      sieRecords: await prisma.sieAssociateRecord.count(),
    };

    const loginResults: Array<{ role: string; result: string }> = [];
    for (const testCase of loginCases) {
      try {
        await loginService.authenticate({ email: testCase.email, password: testCase.clave }, { ipAddress: "127.0.0.1" });
        loginResults.push({ role: testCase.role, result: "PASS" });
      } catch {
        loginResults.push({ role: testCase.role, result: "FAIL" });
      }
    }

    result.users_created = usersCreated;
    result.credentials_created = credentialsCreated;
    result.sie_identities_created = sieIdentitiesCreated;
    result.bcrypt_compare_pass = bcryptComparePass;
    result.bcrypt_compare_fail = bcryptCompareFail;
    result.auth_users_before = before.authUsers;
    result.auth_users_after = after.authUsers;
    result.auth_credentials_before = before.authCredentials;
    result.auth_credentials_after = after.authCredentials;
    result.sie_records_before = before.sieRecords;
    result.sie_records_after = after.sieRecords;
    result.login_results = loginResults;

    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    result.error = error instanceof Error ? error.message : String(error);
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main();
