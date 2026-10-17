import "dotenv/config";
import { PhoneType, PrismaClient } from "@prisma/client";
import { AssociatesApiClient } from "../modules/afiliaciones/associates-integration/Clients/AssociatesApiClient";
import { getAssociatesApiConfig } from "../modules/afiliaciones/associates-integration/Config/AssociatesApiConfig";
import { mapSieDocumentType } from "../modules/afiliaciones/associates-integration/Mappers/SieAssociateListMapper";
import type { SanitizedSieAssociate } from "../modules/afiliaciones/associates-integration/Models/SieAssociateList";
import { assertExecutionTarget } from "./sie-execution-guard";

/**
 * Migración de PERSONAS A/E faltantes en QA (por lotes).
 *
 * Crea únicamente personas A/E cuyo documento no existe aún localmente, y su
 * contacto primario (correo/teléfono) para habilitar el aprovisionamiento
 * posterior. NO crea registros SIE (eso lo hace `sie-active-code-sync.ts` con
 * su detección de conflictos de nombre/código). NO crea usuarios ni credenciales.
 */

const PAGE_SIZE = 500;
const AE_TYPES = new Set(["A", "E"]);

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

async function main(): Promise<void> {
  const mode = process.argv[2] === "execute" ? "execute" : "dry-run";
  assertExecutionTarget(process.argv);
  const prisma = new PrismaClient();
  const result: Record<string, unknown> = { status: "FAIL", mode, error: null };

  try {
    const client = new AssociatesApiClient(getAssociatesApiConfig());
    const first = await client.listAssociates({ pagina: 1, tamanioPagina: PAGE_SIZE });
    const pages = [first];
    for (let page = 2; page <= (first.totalPaginas || 1); page += 1) pages.push(await client.listAssociates({ pagina: page, tamanioPagina: PAGE_SIZE }));
    const records = pages.flatMap((p) => p.associates).filter((r) => AE_TYPES.has(r.sourceType));

    // Personas existentes (lote).
    const existingPersons = await prisma.person.findMany({ select: { documentType: true, documentNumber: true } });
    const existingDoc = new Set(existingPersons.map((p) => `${p.documentType}|${p.documentNumber}`));

    // Clasificación en memoria.
    let createSafe = 0;
    let missingData = 0;
    let documentUnmapped = 0;
    let alreadyExists = 0;

    const createRows: SanitizedSieAssociate[] = [];
    const seenDoc = new Set<string>();

    for (const record of records) {
      const docType = mapSieDocumentType(record.documentType);
      if (!docType || !record.documentNumber) { documentUnmapped += 1; continue; }
      const key = `${docType}|${record.documentNumber}`;
      if (existingDoc.has(key)) { alreadyExists += 1; continue; }
      if (!record.nombres || !record.apellidoPaterno) { missingData += 1; continue; }
      if (seenDoc.has(key)) continue; // evita duplicados dentro del propio lote SIE
      seenDoc.add(key);
      createSafe += 1;
      createRows.push(record);
    }

    result.ae_total = records.length;
    result.ae_already_exists = alreadyExists;
    result.ae_create_safe = createSafe;
    result.ae_missing_data = missingData;
    result.ae_document_unmapped = documentUnmapped;

    if (mode === "dry-run") {
      result.status = "PASS";
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    // Ejecución por lotes.
    const before = { persons: await prisma.person.count(), contacts: await prisma.personContact.count() };

    const created = await prisma.person.createManyAndReturn({
      data: createRows.map((r) => ({
        documentType: mapSieDocumentType(r.documentType)!,
        documentNumber: r.documentNumber,
        firstName: r.nombres as string,
        paternalLastName: r.apellidoPaterno as string,
        maternalLastName: r.apellidoMaterno ?? null,
        birthDate: parseBirthDate(r.fechaNacimiento),
      })),
      skipDuplicates: true,
      select: { id: true, documentType: true, documentNumber: true },
    });
    const idByDoc = new Map<string, number>();
    for (const p of created) idByDoc.set(`${p.documentType}|${p.documentNumber}`, p.id);

    const contactRows: Array<{ personId: number; email: string | null; phoneNumber: string; phoneType: PhoneType; isPrimary: boolean }> = [];
    const seenContactKey = new Set<string>();
    for (const r of createRows) {
      const key = `${mapSieDocumentType(r.documentType)}|${r.documentNumber}`;
      const personId = idByDoc.get(key);
      if (!personId) continue;
      const email = r.correo ? r.correo.trim().toLowerCase() : null;
      const phone = r.telefono ? r.telefono.trim() : "";
      if (!email && !phone) continue;
      const ck = email ? `${personId}|e|${email}` : `${personId}|p|${phone}`;
      if (seenContactKey.has(ck)) continue;
      seenContactKey.add(ck);
      contactRows.push({ personId, email, phoneNumber: phone, phoneType: PhoneType.MOBILE, isPrimary: true });
    }
    if (contactRows.length) await prisma.personContact.createMany({ data: contactRows });

    const after = { persons: await prisma.person.count(), contacts: await prisma.personContact.count() };
    result.status = "PASS";
    result.persons_created = after.persons - before.persons;
    result.contacts_created = after.contacts - before.contacts;
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
