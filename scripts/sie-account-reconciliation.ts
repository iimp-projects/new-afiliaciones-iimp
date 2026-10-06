import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { AssociatesApiClient } from "../modules/afiliaciones/associates-integration/Clients/AssociatesApiClient";
import { getAssociatesApiConfig } from "../modules/afiliaciones/associates-integration/Config/AssociatesApiConfig";
import { mapSieDocumentType } from "../modules/afiliaciones/associates-integration/Mappers/SieAssociateListMapper";
import type { SanitizedSieAssociate } from "../modules/afiliaciones/associates-integration/Models/SieAssociateList";

const PAGE_SIZE = 500;

function norm(value: string | null | undefined): string {
  if (!value) return "";
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

type Group = "READY_CREATE_USER_AND_CREDENTIAL" | "PRESERVE_EXISTING_ACCOUNT" | "MANUAL_REVIEW" | "SKIP";

type PersonContext = {
  status: "MATCHED" | "NOT_FOUND" | "DOCUMENT_TYPE_UNMAPPED" | "AMBIGUOUS";
  personId: number | null;
  email: string | null;
  emailConflict: boolean;
  localAffiliateType: "ACTIVE" | "STUDENT" | null;
  user: { id: number; type: string; status: string; roleSlug: string | null } | null;
  activePasswordCount: number;
};

async function resolveContext(prisma: PrismaClient, record: SanitizedSieAssociate): Promise<PersonContext> {
  const documentType = mapSieDocumentType(record.documentType);
  if (!documentType) return { status: "DOCUMENT_TYPE_UNMAPPED", personId: null, email: null, emailConflict: false, localAffiliateType: null, user: null, activePasswordCount: 0 };
  if (!record.documentNumber) return { status: "DOCUMENT_TYPE_UNMAPPED", personId: null, email: null, emailConflict: false, localAffiliateType: null, user: null, activePasswordCount: 0 };

  const person = await prisma.person.findUnique({
    where: { documentType_documentNumber: { documentType, documentNumber: record.documentNumber } },
    select: {
      id: true,
      contacts: { where: { email: { not: null } }, orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }], take: 1, select: { email: true } },
      applications: { orderBy: { createdAt: "desc" }, take: 1, select: { email: true, affiliateType: true } },
      user: { select: { id: true, type: true, status: true, role: { select: { slug: true } }, credentials: { where: { type: "PASSWORD", isActive: true }, select: { id: true } } } },
    },
  });
  if (!person) return { status: "NOT_FOUND", personId: null, email: null, emailConflict: false, localAffiliateType: null, user: null, activePasswordCount: 0 };

  const email = person.contacts[0]?.email ?? person.applications[0]?.email ?? null;
  let emailConflict = false;
  if (email) {
    const owner = await prisma.user.findFirst({ where: { email: { equals: email, mode: "insensitive" } }, select: { personId: true } });
    if (owner && owner.personId !== person.id) emailConflict = true;
  }

  return {
    status: "MATCHED",
    personId: person.id,
    email,
    emailConflict,
    localAffiliateType: person.applications[0]?.affiliateType ?? null,
    user: person.user ? { id: person.user.id, type: person.user.type, status: person.user.status, roleSlug: person.user.role?.slug ?? null } : null,
    activePasswordCount: person.user?.credentials.length ?? 0,
  };
}

async function main(): Promise<void> {
  const prisma = new PrismaClient();
  const result: Record<string, unknown> = { r69_6_status: "FAIL", error: null };
  try {
    const before = {
      persons: await prisma.person.count(),
      authUsers: await prisma.user.count(),
      authCredentials: await prisma.credential.count(),
      sieAssociateRecords: await prisma.sieAssociateRecord.count(),
      membershipCategories: await prisma.membershipCategory.count(),
      authRoles: await prisma.role.count(),
    };

    const roles = await prisma.role.findMany({ where: { slug: { in: ["ASOCIADO_ACTIVO", "ASOCIADO_ESTUDIANTE"] } }, select: { slug: true } });
    const roleActiveExists = roles.some((r) => r.slug === "ASOCIADO_ACTIVO");
    const roleStudentExists = roles.some((r) => r.slug === "ASOCIADO_ESTUDIANTE");

    const client = new AssociatesApiClient(getAssociatesApiConfig());
    const firstPage = await client.listAssociates({ pagina: 1, tamanioPagina: PAGE_SIZE });
    const totalPaginas = firstPage.totalPaginas || 1;
    const pages = [firstPage];
    for (let page = 2; page <= totalPaginas; page += 1) pages.push(await client.listAssociates({ pagina: page, tamanioPagina: PAGE_SIZE }));
    const ae = pages.flatMap((page) => page.associates).filter((record) => record.sourceType === "A" || record.sourceType === "E");

    const activeRecords = ae.filter((r) => r.sourceType === "A");
    const studentRecords = ae.filter((r) => r.sourceType === "E");

    const storedCodes = new Set((await prisma.sieAssociateRecord.findMany({ select: { externalCode: true } })).map((r) => r.externalCode));

    let activeMatched = 0;
    let activeNotFound = 0;
    let activeEmailMissing = 0;
    let activeCategoryMismatch = 0;
    let activeReady = 0;
    let studentMatched = 0;
    let studentNotFound = 0;
    let studentEmailMissing = 0;
    let studentCategoryMismatch = 0;
    let studentReady = 0;

    let totalMatched = 0;
    let totalNotFound = 0;
    let documentTypeUnmapped = 0;
    let emailAvailable = 0;
    let emailMissing = 0;
    let emailConflicts = 0;
    let categoryMatch = 0;
    let categoryMismatch = 0;
    let categoryLocalMissing = 0;
    let sieCodeAlreadyStored = 0;
    let sieCodeToCreate = 0;
    let userAlreadyExists = 0;
    let usersWithOneActivePassword = 0;
    let usersWithMultipleActivePasswords = 0;

    const groupCounts: Record<Group, number> = { READY_CREATE_USER_AND_CREDENTIAL: 0, PRESERVE_EXISTING_ACCOUNT: 0, MANUAL_REVIEW: 0, SKIP: 0 };
    const mismatchMatrix: Record<string, number> = {};

    for (const record of ae) {
      const isActive = record.sourceType === "A";
      const expectedAffiliate = isActive ? "ACTIVE" : "STUDENT";
      const expectedRole = isActive ? "ASOCIADO_ACTIVO" : "ASOCIADO_ESTUDIANTE";

      const ctx = await resolveContext(prisma, record);

      if (ctx.status === "MATCHED") {
        totalMatched += 1;
        if (isActive) activeMatched += 1;
        else studentMatched += 1;
      } else if (ctx.status === "NOT_FOUND") {
        totalNotFound += 1;
        if (isActive) activeNotFound += 1;
        else studentNotFound += 1;
      } else {
        documentTypeUnmapped += 1;
      }

      if (ctx.status === "MATCHED") {
        if (ctx.email && !ctx.emailConflict) emailAvailable += 1;
        else if (!ctx.email) { emailMissing += 1; if (isActive) activeEmailMissing += 1; else studentEmailMissing += 1; }
        else emailConflicts += 1;

        const localKey = ctx.localAffiliateType ?? "NONE";
        mismatchMatrix[`${record.sourceType}->${localKey}`] = (mismatchMatrix[`${record.sourceType}->${localKey}`] ?? 0) + 1;
        if (ctx.localAffiliateType === null) categoryLocalMissing += 1;
        else if (ctx.localAffiliateType !== expectedAffiliate) { categoryMismatch += 1; if (isActive) activeCategoryMismatch += 1; else studentCategoryMismatch += 1; }
        else categoryMatch += 1;

        if (ctx.user) {
          userAlreadyExists += 1;
          if (ctx.activePasswordCount === 1) usersWithOneActivePassword += 1;
          else if (ctx.activePasswordCount > 1) usersWithMultipleActivePasswords += 1;
        }
      }

      if (storedCodes.has(record.externalCode)) sieCodeAlreadyStored += 1;
      else sieCodeToCreate += 1;

      let group: Group;
      if (ctx.status === "DOCUMENT_TYPE_UNMAPPED") group = "MANUAL_REVIEW";
      else if (ctx.status === "NOT_FOUND") group = "MANUAL_REVIEW";
      else if (ctx.user && ctx.activePasswordCount === 1) group = "PRESERVE_EXISTING_ACCOUNT";
      else if (ctx.user && (ctx.activePasswordCount === 0 || ctx.activePasswordCount > 1)) group = "MANUAL_REVIEW";
      else if (ctx.emailConflict || !ctx.email) group = "MANUAL_REVIEW";
      else if (ctx.localAffiliateType !== null && ctx.localAffiliateType !== expectedAffiliate) group = "MANUAL_REVIEW";
      else if (!record.passwordPresent) group = "SKIP";
      else group = "READY_CREATE_USER_AND_CREDENTIAL";

      groupCounts[group] += 1;
      if (group === "READY_CREATE_USER_AND_CREDENTIAL") {
        if (isActive) activeReady += 1;
        else studentReady += 1;
      }
    }

    const totalReady = groupCounts.READY_CREATE_USER_AND_CREDENTIAL;
    const unaccounted = ae.length - totalReady - groupCounts.PRESERVE_EXISTING_ACCOUNT - groupCounts.MANUAL_REVIEW - groupCounts.SKIP;

    result.r69_6_status = unaccounted === 0 ? "PASS" : "FAIL";
    result.before = before;
    result.role_active_exists = roleActiveExists;
    result.role_student_exists = roleStudentExists;
    result.active_total = activeRecords.length;
    result.student_total = studentRecords.length;
    result.ae_total = ae.length;
    result.person_matched_before_r69_5 = 3512;
    result.person_matched_after_r69_5 = totalMatched;
    result.new_matches_due_to_r69_5 = totalMatched - 3512;
    result.person_not_found = totalNotFound;
    result.document_type_unmapped = documentTypeUnmapped;
    result.active_matched = activeMatched;
    result.active_not_found = activeNotFound;
    result.active_email_missing = activeEmailMissing;
    result.active_category_mismatch = activeCategoryMismatch;
    result.active_ready = activeReady;
    result.student_matched = studentMatched;
    result.student_not_found = studentNotFound;
    result.student_email_missing = studentEmailMissing;
    result.student_category_mismatch = studentCategoryMismatch;
    result.student_ready = studentReady;
    result.email_available = emailAvailable;
    result.email_missing = emailMissing;
    result.email_conflicts = emailConflicts;
    result.category_match = categoryMatch;
    result.category_mismatch = categoryMismatch;
    result.category_local_missing = categoryLocalMissing;
    result.mismatch_matrix = mismatchMatrix;
    result.sie_code_already_stored = sieCodeAlreadyStored;
    result.sie_code_to_create = sieCodeToCreate;
    result.user_already_exists = userAlreadyExists;
    result.users_with_one_active_password = usersWithOneActivePassword;
    result.users_with_multiple_active_passwords = usersWithMultipleActivePasswords;
    result.total_ready_create_user_and_credential = totalReady;
    result.total_preserve_existing_account = groupCounts.PRESERVE_EXISTING_ACCOUNT;
    result.total_manual_review = groupCounts.MANUAL_REVIEW;
    result.total_skip = groupCounts.SKIP;
    result.unaccounted = unaccounted;
    result.would_create_users = totalReady;
    result.would_create_credentials = totalReady;
    result.would_assign_active_role = activeReady;
    result.would_assign_student_role = studentReady;
    result.would_create_sie_identities = sieCodeToCreate;
    result.would_link_existing_sie_identities = sieCodeAlreadyStored;
    result.would_preserve_existing_passwords = usersWithOneActivePassword;

    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    result.error = error instanceof Error ? error.message : String(error);
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main();
