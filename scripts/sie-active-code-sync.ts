import "dotenv/config";
import { PrismaClient, SieLinkStatus, type DocumentType } from "@prisma/client";
import { AssociatesApiClient } from "../modules/afiliaciones/associates-integration/Clients/AssociatesApiClient";
import { getAssociatesApiConfig } from "../modules/afiliaciones/associates-integration/Config/AssociatesApiConfig";
import { mapSieDocumentType } from "../modules/afiliaciones/associates-integration/Mappers/SieAssociateListMapper";
import {
  classifyActiveCodeSync,
  detectDuplicateCodes,
  maskDocument,
  type ActiveCodeDecision,
  type SyncPerson,
  type SyncRecord,
} from "../modules/afiliaciones/associates-integration/Services/SieActiveCodeSyncService";
import type { SanitizedSieAssociate } from "../modules/afiliaciones/associates-integration/Models/SieAssociateList";

const PAGE_SIZE = 500;
const ACTIVE_CATEGORIES = new Set(["A", "E"]);
const MAX_APPLY_RECORDS = 1000;

type Decision = { record: SanitizedSieAssociate; decision: ActiveCodeDecision | "SKIP_DUPLICATE_CODE" };

function toSyncRecord(record: SanitizedSieAssociate): SyncRecord {
  return {
    documentType: record.documentType,
    documentNumber: record.documentNumber,
    externalCode: record.externalCode,
    nombres: record.nombres,
    apellidoPaterno: record.apellidoPaterno,
    apellidoMaterno: record.apellidoMaterno,
  };
}

async function fetchActiveRecords(client: AssociatesApiClient): Promise<SanitizedSieAssociate[]> {
  const firstPage = await client.listAssociates({ pagina: 1, tamanioPagina: PAGE_SIZE });
  const totalPaginas = firstPage.totalPaginas || 1;
  const pages = [firstPage];
  for (let page = 2; page <= totalPaginas; page += 1) {
    pages.push(await client.listAssociates({ pagina: page, tamanioPagina: PAGE_SIZE }));
  }
  return pages.flatMap((page) => page.associates).filter((record) => ACTIVE_CATEGORIES.has(record.sourceType));
}

function summarize(decisions: Decision[], duplicateCodes: number): Record<string, unknown> {
  const summary: Record<string, number> = {
    total: decisions.length,
    duplicateCodes,
    link: 0,
    unchanged: 0,
    skipEmptyCode: 0,
    skipNotLocal: 0,
    skipDuplicateCode: 0,
    conflictNames: 0,
    conflictCodeOwnedByOther: 0,
    conflictPersonAlreadyLinked: 0,
  };
  for (const { decision } of decisions) {
    if (decision === "SKIP_DUPLICATE_CODE") {
      summary.skipDuplicateCode += 1;
      continue;
    }
    switch (decision.kind) {
      case "LINK": summary.link += 1; break;
      case "UNCHANGED": summary.unchanged += 1; break;
      case "SKIP_EMPTY_CODE": summary.skipEmptyCode += 1; break;
      case "SKIP_NOT_LOCAL": summary.skipNotLocal += 1; break;
      case "CONFLICT_NAMES": summary.conflictNames += 1; break;
      case "CONFLICT_CODE_OWNED_BY_OTHER": summary.conflictCodeOwnedByOther += 1; break;
      case "CONFLICT_PERSON_ALREADY_LINKED": summary.conflictPersonAlreadyLinked += 1; break;
    }
  }
  return summary;
}

async function writeLink(
  prisma: PrismaClient,
  record: SanitizedSieAssociate,
  decision: Extract<ActiveCodeDecision, { kind: "LINK" }>,
  categoryId: number | null,
): Promise<void> {
  await prisma.sieAssociateRecord.upsert({
    where: { provider_externalCode: { provider: "SIE", externalCode: decision.externalCode } },
    create: {
      provider: "SIE",
      externalCode: decision.externalCode,
      sourceDocumentType: record.documentType || null,
      documentNumber: record.documentNumber || null,
      sourceType: record.sourceType,
      sourceDescription: record.sourceDescription ?? null,
      personId: decision.personId,
      categoryId,
      linkStatus: SieLinkStatus.LINKED,
      lastSyncedAt: new Date(),
    },
    update: {
      sourceDocumentType: record.documentType || null,
      documentNumber: record.documentNumber || null,
      sourceType: record.sourceType,
      sourceDescription: record.sourceDescription ?? null,
      personId: decision.personId,
      categoryId,
      linkStatus: SieLinkStatus.LINKED,
      lastSyncedAt: new Date(),
    },
  });
}

async function main(): Promise<void> {
  const modeArg = process.argv[2] ?? "dry-run";
  const mode = modeArg === "pilot" ? "pilot" : modeArg === "apply" ? "apply" : "dry-run";
  const pilotDocument = process.argv[3] ?? null;
  const pilotDocumentType = process.argv[4] ?? null;
  const applyConfirm = process.argv[3] ?? null;
  const prisma = new PrismaClient();

  try {
    const config = getAssociatesApiConfig();
    const client = new AssociatesApiClient(config);
    const allRecords = await fetchActiveRecords(client);
    const records = allRecords.filter((record) => mapSieDocumentType(record.documentType) !== null);
    const duplicateCodes = detectDuplicateCodes(records.map((r) => ({ externalCode: r.externalCode, documentNumber: r.documentNumber })));

    const categories = await prisma.membershipCategory.findMany({ select: { id: true, code: true } });
    const categoryByCode = new Map(categories.map((c) => [c.code, c.id]));

    const docPairs = records
      .filter((r) => !duplicateCodes.has(r.externalCode?.trim() ?? ""))
      .map((r) => ({ documentType: mapSieDocumentType(r.documentType) as DocumentType, documentNumber: r.documentNumber }));

    const persons = await prisma.person.findMany({
      where: { OR: docPairs.map((p) => ({ documentType: p.documentType, documentNumber: p.documentNumber })) },
      select: { id: true, documentType: true, documentNumber: true, firstName: true, paternalLastName: true, maternalLastName: true },
    });
    const personByDoc = new Map(persons.map((p) => [`${p.documentType}|${p.documentNumber}`, p]));

    const codes = records.map((r) => r.externalCode?.trim() ?? "").filter(Boolean);
    const existingByCode = await prisma.sieAssociateRecord.findMany({
      where: { provider: "SIE", externalCode: { in: codes } },
      select: { externalCode: true, personId: true, linkStatus: true },
    });
    const recordByCode = new Map(existingByCode.map((r) => [r.externalCode, r]));

    const personIds = [...new Set(persons.map((p) => p.id))];
    const linkedByPersonRows = await prisma.sieAssociateRecord.findMany({
      where: { personId: { in: personIds }, linkStatus: SieLinkStatus.LINKED },
      select: { externalCode: true, personId: true, linkStatus: true },
    });
    const linkedByPerson = new Map(linkedByPersonRows.map((r) => [r.personId as number, r]));

    const decisions: Decision[] = [];
    for (const record of records) {
      const code = record.externalCode?.trim() ?? "";
      if (duplicateCodes.has(code)) {
        decisions.push({ record, decision: "SKIP_DUPLICATE_CODE" });
        continue;
      }
      const documentType = mapSieDocumentType(record.documentType);
      const person = documentType ? (personByDoc.get(`${documentType}|${record.documentNumber}`) ?? null) : null;
      const byCode = code ? (recordByCode.get(code) ?? null) : null;
      const byPerson = person ? (linkedByPerson.get(person.id) ?? null) : null;
      const personSync: SyncPerson | null = person
        ? { id: person.id, firstName: person.firstName, paternalLastName: person.paternalLastName, maternalLastName: person.maternalLastName }
        : null;
      decisions.push({ record, decision: classifyActiveCodeSync(toSyncRecord(record), personSync, byCode, byPerson) });
    }

    if (mode === "dry-run") {
      console.log(JSON.stringify({ mode: "dry-run", ...summarize(decisions, duplicateCodes.size) }, null, 2));
      return;
    }

    if (mode === "pilot") {
      if (!pilotDocument) {
        console.log(JSON.stringify({ mode: "pilot", error: "Se requiere número de documento (argumento 3)." }));
        return;
      }
      const matches = decisions.filter(
        ({ record }) => record.documentNumber === pilotDocument && (!pilotDocumentType || record.documentType === pilotDocumentType),
      );
      if (matches.length === 0) {
        console.log(JSON.stringify({ mode: "pilot", document: maskDocument(pilotDocument), error: "No se encontró el documento en los registros A/E de SIE." }));
        return;
      }
      if (matches.length > 1) {
        console.log(JSON.stringify({ mode: "pilot", document: maskDocument(pilotDocument), error: "El documento coincide con múltiples tipos; especifique el tipo de documento (argumento 4)." }));
        return;
      }
      const { record, decision } = matches[0];
      const masked = maskDocument(record.documentNumber);
      if (decision === "SKIP_DUPLICATE_CODE") {
        console.log(JSON.stringify({ mode: "pilot", document: masked, decision: "SKIP_DUPLICATE_CODE" }));
        return;
      }
      if (decision.kind === "LINK") {
        await writeLink(prisma, record, decision, categoryByCode.get(record.sourceType) ?? null);
        console.log(JSON.stringify({ mode: "pilot", document: masked, decision: "LINK", externalCode: decision.externalCode, personId: decision.personId, categoryCode: record.sourceType }));
      } else {
        console.log(JSON.stringify({ mode: "pilot", document: masked, decision: decision.kind, ...("personId" in decision ? { personId: decision.personId } : {}) }));
      }
      return;
    }

    // apply — requiere confirmación explícita para evitar escrituras accidentales.
    // La protección ante concurrencia se apoya en el `upsert` atómico sobre la
    // restricción única (provider, externalCode): reejecuciones concurrentes no
    // crean duplicados.
    if (applyConfirm !== "confirm") {
      console.log(JSON.stringify({ mode: "apply", error: "El modo apply requiere confirmación explícita: 'apply confirm'." }));
      return;
    }
    const links = decisions.filter((d): d is { record: SanitizedSieAssociate; decision: Extract<ActiveCodeDecision, { kind: "LINK" }> } => d.decision !== "SKIP_DUPLICATE_CODE" && d.decision.kind === "LINK");
    if (links.length > MAX_APPLY_RECORDS) {
      console.log(JSON.stringify({ mode: "apply", error: `Demasiados registros a vincular (${links.length} > ${MAX_APPLY_RECORDS}). Ajuste el lote.` }));
      return;
    }
    let applied = 0;
    for (const { record, decision } of links) {
      await writeLink(prisma, record, decision, categoryByCode.get(record.sourceType) ?? null);
      applied += 1;
    }
    console.log(JSON.stringify({ mode: "apply", applied, ...summarize(decisions, duplicateCodes.size) }, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main();
