import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { AssociatesApiClient } from "../modules/afiliaciones/associates-integration/Clients/AssociatesApiClient";
import { getAssociatesApiConfig } from "../modules/afiliaciones/associates-integration/Config/AssociatesApiConfig";
import { assertExecutionTarget } from "./sie-execution-guard";

/**
 * Análisis de habilitación de cuentas históricas SIE (solo lectura).
 *
 * Cruza el listado SIE A/E (con Clave, en memoria, sin persistir) con la base
 * QA (vínculos SIE, usuarios PENDING y correos) para producir los conteos de
 * elegibilidad para el flujo SIE → Person → User → Credential → Login.
 *
 * NO importa Clave, NO escribe, NO activa, NO envía correos.
 */

const PAGE_SIZE = 500;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_CLAVE_LENGTH = 8;

function validEmail(value: string | null | undefined): boolean {
  return !!value && EMAIL_RE.test(value.trim());
}

async function main(): Promise<void> {
  assertExecutionTarget(process.argv);
  const prisma = new PrismaClient();
  const result: Record<string, unknown> = { status: "FAIL", error: null };
  try {
    // 1) SIE A/E con Clave (en memoria; nunca se imprime la Clave).
    const client = new AssociatesApiClient(getAssociatesApiConfig());
    const first = await client.listAssociatesWithClave({ pagina: 1, tamanioPagina: PAGE_SIZE });
    const pages = [first];
    for (let page = 2; page <= (first.totalPaginas || 1); page += 1) {
      pages.push(await client.listAssociatesWithClave({ pagina: page, tamanioPagina: PAGE_SIZE }));
    }
    const sieByCode = new Map<string, { sourceType: string; clavePresent: boolean; claveLength: number }>();
    for (const page of pages) {
      for (const item of page.associates) {
        const r = item.record;
        if (r.sourceType !== "A" && r.sourceType !== "E") continue;
        if (r.externalCode) {
          sieByCode.set(r.externalCode, {
            sourceType: r.sourceType,
            clavePresent: r.passwordPresent,
            claveLength: (item.clave ?? "").trim().length,
          });
        }
      }
    }
    const aeTotal = sieByCode.size;

    // 2) Base QA: vínculos A/E + usuarios PENDING + correos.
    const [linkedRows, pendingUsers, contacts] = await Promise.all([
      prisma.sieAssociateRecord.findMany({
        where: { provider: "SIE", sourceType: { in: ["A", "E"] }, linkStatus: "LINKED" },
        select: { externalCode: true, personId: true },
      }),
      prisma.user.findMany({
        where: { type: "AFFILIATE", status: "PENDING", deletedAt: null },
        select: { personId: true, email: true },
      }),
      prisma.personContact.findMany({
        where: { email: { not: null } },
        select: { personId: true, email: true, isPrimary: true },
      }),
    ]);

    const personByCode = new Map<string, number>();
    for (const l of linkedRows) if (l.personId) personByCode.set(l.externalCode, l.personId);

    const emailByPerson = new Map<number, string>();
    const primaryByPerson = new Map<number, string>();
    for (const c of contacts) {
      const e = (c.email ?? "").trim().toLowerCase();
      if (!e) continue;
      if (!emailByPerson.has(c.personId)) emailByPerson.set(c.personId, e);
      if (c.isPrimary && !primaryByPerson.has(c.personId)) primaryByPerson.set(c.personId, e);
    }
    const userByPerson = new Map<number, string>();
    for (const u of pendingUsers) if (u.personId) userByPerson.set(u.personId, (u.email ?? "").trim().toLowerCase());

    // 3) Cruce.
    let linkedPerson = 0;
    let pendingUser = 0;
    let validEmailCount = 0;
    let clavePresent = 0;
    let claveValid = 0;
    let eligibleActive = 0;
    let eligibleButWeakClave = 0;
    let eligibleButInvalidEmail = 0;

    for (const [code, sie] of sieByCode) {
      const personId = personByCode.get(code);
      if (!personId) continue;
      linkedPerson += 1;

      const userId = userByPerson.get(personId);
      if (!userId) continue;
      pendingUser += 1;

      const email = userId || emailByPerson.get(personId) || primaryByPerson.get(personId) || "";
      const emailOk = validEmail(email);
      if (emailOk) validEmailCount += 1;

      if (sie.clavePresent) clavePresent += 1;
      if (sie.clavePresent && sie.claveLength >= MIN_CLAVE_LENGTH) claveValid += 1;

      const claveOk = sie.clavePresent && sie.claveLength >= MIN_CLAVE_LENGTH;
      if (emailOk && claveOk) eligibleActive += 1;
      else if (claveOk && !emailOk) eligibleButInvalidEmail += 1;
      else if (emailOk && !claveOk) eligibleButWeakClave += 1;
    }

    result.status = "PASS";
    result.ae_total = aeTotal;
    result.ae_with_linked_person = linkedPerson;
    result.ae_with_pending_user = pendingUser;
    result.ae_with_valid_email = validEmailCount;
    result.ae_with_clave_present = clavePresent;
    result.ae_with_clave_valid_length = claveValid;
    result.ae_eligible_for_active = eligibleActive;
    result.eligible_but_weak_clave = eligibleButWeakClave;
    result.eligible_but_invalid_email = eligibleButInvalidEmail;
    result.pending_resolution = aeTotal - eligibleActive;

    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    result.error = error instanceof Error ? error.message : String(error);
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main();
