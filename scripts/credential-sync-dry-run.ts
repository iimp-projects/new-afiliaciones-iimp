import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { AssociatesApiClient } from "../modules/afiliaciones/associates-integration/Clients/AssociatesApiClient";
import { getAssociatesApiConfig } from "../modules/afiliaciones/associates-integration/Config/AssociatesApiConfig";
import { mapSieDocumentType } from "../modules/afiliaciones/associates-integration/Mappers/SieAssociateListMapper";
import { buildReport, classifyAll } from "../modules/afiliaciones/associates-integration/Services/SieIdentityDryRunService";
import { buildPopulationBreakdown } from "../modules/afiliaciones/associates-integration/Services/SiePopulationForensics";
import type { RecordContext, SieDryRunInput } from "../modules/afiliaciones/associates-integration/Services/SieIdentityDryRunService";
import type { SanitizedSieAssociate } from "../modules/afiliaciones/associates-integration/Models/SieAssociateList";

const PAGE_SIZE = 500;

function emptyContext(): RecordContext {
  return { person: null, ambiguous: false, user: null, activePasswordCount: 0, candidateEmail: null, emailConflict: false, localAffiliateType: null };
}

async function resolveContext(prisma: PrismaClient, record: SanitizedSieAssociate): Promise<RecordContext> {
  const documentType = mapSieDocumentType(record.documentType);
  if (!documentType || !record.documentNumber) return emptyContext();

  const person = await prisma.person.findUnique({
    where: { documentType_documentNumber: { documentType, documentNumber: record.documentNumber } },
    select: {
      id: true,
      documentType: true,
      documentNumber: true,
      contacts: { where: { email: { not: null } }, orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }], select: { email: true, isPrimary: true } },
      applications: { orderBy: { createdAt: "desc" }, take: 1, select: { email: true, affiliateType: true } },
      user: { select: { id: true, type: true, status: true, role: { select: { slug: true } }, credentials: { where: { type: "PASSWORD", isActive: true }, select: { id: true } } } },
    },
  });
  if (!person) return emptyContext();

  const primaryContact = person.contacts.find((contact) => contact.isPrimary) ?? person.contacts[0];
  const candidateEmail = primaryContact?.email ?? person.applications[0]?.email ?? null;

  let emailConflict = false;
  if (candidateEmail) {
    const owner = await prisma.user.findFirst({ where: { email: { equals: candidateEmail, mode: "insensitive" } }, select: { personId: true } });
    if (owner && owner.personId !== person.id) emailConflict = true;
  }

  return {
    person: { id: person.id, documentType: person.documentType, documentNumber: person.documentNumber },
    ambiguous: false,
    user: person.user ? { id: person.user.id, type: person.user.type, status: person.user.status, roleSlug: person.user.role?.slug ?? null } : null,
    activePasswordCount: person.user?.credentials.length ?? 0,
    candidateEmail,
    emailConflict,
    localAffiliateType: person.applications[0]?.affiliateType ?? null,
  };
}

async function classifyPersonNotFound(prisma: PrismaClient, record: SanitizedSieAssociate): Promise<string> {
  const sameNumber = await prisma.person.findFirst({ where: { documentNumber: record.documentNumber }, select: { id: true } });
  if (sameNumber) return "DOCUMENT_TYPE_DIFFERENCE";
  if (record.documentType === "1" && /^0+\d+$/.test(record.documentNumber)) {
    const normalized = record.documentNumber.replace(/^0+/, "");
    if (normalized && normalized !== record.documentNumber) {
      const match = await prisma.person.findFirst({ where: { documentNumber: normalized }, select: { id: true } });
      if (match) return "DOCUMENT_FORMAT_DIFFERENCE";
    }
  }
  return "NOT_PRESENT_IN_NEW_SYSTEM";
}

async function main(): Promise<void> {
  const prisma = new PrismaClient();
  const result: Record<string, unknown> = {
    r69_2_final_status: "FAIL",
    sie_api_consumed: false,
    sie_environment: "",
    sie_list_endpoint: "POST /ventas/asociados/lista",
    error: null,
  };
  try {
    const config = getAssociatesApiConfig();
    result.sie_environment = config.baseUrl;
    const client = new AssociatesApiClient(config);
    const firstPage = await client.listAssociates({ pagina: 1, tamanioPagina: PAGE_SIZE });
    result.sie_api_consumed = true;
    const totalPaginas = firstPage.totalPaginas || 1;
    const pages = [firstPage];
    for (let page = 2; page <= totalPaginas; page += 1) {
      pages.push(await client.listAssociates({ pagina: page, tamanioPagina: PAGE_SIZE }));
    }
    const records = pages.flatMap((page) => page.associates);
    const inputs: SieDryRunInput[] = [];
    for (const record of records) {
      inputs.push({ record, context: await resolveContext(prisma, record) });
    }
    const entries = classifyAll(inputs);
    const counts = buildReport(entries);
    const breakdown = buildPopulationBreakdown(entries);

    const personNotFoundCauses: Record<string, number> = {};
    const personNotFoundCausesByType: Record<string, Record<string, number>> = {};
    for (const entry of entries) {
      if (entry.classification.identity !== "PERSON_NOT_FOUND") continue;
      const type = entry.record.sourceType || "(sin tipo)";
      const cause = await classifyPersonNotFound(prisma, entry.record);
      personNotFoundCauses[cause] = (personNotFoundCauses[cause] ?? 0) + 1;
      const byType = personNotFoundCausesByType[type] ?? {};
      byType[cause] = (byType[cause] ?? 0) + 1;
      personNotFoundCausesByType[type] = byType;
    }

    result.r69_2_final_status = "PASS";
    result.total_sie_records_reported = firstPage.totalRegistros;
    result.total_sie_records_processed = counts.totalSieRecords;
    Object.assign(result, counts);
    result.population_breakdown = breakdown;
    result.person_not_found_causes = personNotFoundCauses;
    result.person_not_found_causes_by_type = personNotFoundCausesByType;
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    result.error = error instanceof Error ? error.message : String(error);
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main();
