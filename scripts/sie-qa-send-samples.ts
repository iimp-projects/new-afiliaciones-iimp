import "dotenv/config";
import { AffiliateType, ApplicationStatus, DocumentType, PrismaClient } from "@prisma/client";
import { AssociatesApiClient } from "../modules/afiliaciones/associates-integration/Clients/AssociatesApiClient";
import { getAssociatesApiConfig } from "../modules/afiliaciones/associates-integration/Config/AssociatesApiConfig";
import { AssociatesPayloadMapper, toSieDocumentType } from "../modules/afiliaciones/associates-integration/Mappers/AssociatesPayloadMapper";
import type { AssociateRequestPayloadSnapshot } from "../modules/afiliaciones/associates-integration/Models/AssociateIntegration";
import {
  AssociateIntegrationSnapshotBuilder,
  type AssociateSnapshotSource,
} from "../modules/afiliaciones/associates-integration/Services/AssociateIntegrationSnapshotBuilder";
import { PaymentAmountResolver } from "../modules/afiliaciones/payments/Services/PaymentAmountResolver";

/**
 * QA-only smoke test for the SIE associate integration.
 *
 * - Never sends email: it does not import any email/notification service.
 * - Never writes to the database: only reads candidates and, with --send, POSTs
 *   to the external SIE QA endpoint.
 * - Refuses to POST unless ASSOCIATES_API_BASE_URL is a QA/test endpoint.
 *
 * Usage:
 *   npx tsx scripts/sie-qa-send-samples.ts                 # dry-run (GET estado only)
 *   npx tsx scripts/sie-qa-send-samples.ts --send          # real POST to SIE QA
 *   npx tsx scripts/sie-qa-send-samples.ts --active=3 --student=2 --max-check=60
 *   npx tsx scripts/sie-qa-send-samples.ts --active=1 --student=1 --skip-apps=3,5162 --send
 *   npx tsx scripts/sie-qa-send-samples.ts --renewal-app=932 --anno=2027 --send
 */

const SUPPORTED_DOCUMENTS: DocumentType[] = [DocumentType.DNI, DocumentType.CE, DocumentType.PASSPORT];
const SEND = process.argv.includes("--send");

function argNumber(name: string, fallback: number): number {
  const raw = process.argv.find((arg) => arg.startsWith(`--${name}=`));
  if (!raw) return fallback;
  const value = Number(raw.split("=")[1]);
  return Number.isSafeInteger(value) && value >= 0 ? value : fallback;
}

const ACTIVE_COUNT = argNumber("active", 3);
const STUDENT_COUNT = argNumber("student", 2);
const MAX_CHECK = argNumber("max-check", 60);
const RENEWAL_APP = argNumber("renewal-app", 0);
const RENEWAL_ANNO = argNumber("anno", 0);

const SKIP_APPS = new Set(
  (process.argv.find((arg) => arg.startsWith("--skip-apps="))?.split("=")[1] ?? "")
    .split(/[\s,]+/)
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isSafeInteger(value) && value > 0),
);

type Candidate = {
  applicationId: number;
  documentType: DocumentType;
  documentNumber: string;
  email: string;
  phone: string;
  person: {
    firstName: string;
    paternalLastName: string;
    maternalLastName: string | null;
    gender: string | null;
    addresses: { street: string; isPrimary: boolean }[];
  };
};

type Prepared = {
  kind: "ACTIVE" | "STUDENT";
  applicationId: number;
  payload: AssociateRequestPayloadSnapshot;
};

const maskDocument = (value: string) => (value.length <= 4 ? "••••" : `${value.slice(0, 2)}***${value.slice(-2)}`);
const maskEmail = (value: string) => {
  const [local, domain] = value.split("@");
  return domain ? `${local.slice(0, 2)}***@${domain}` : "••••";
};
const maskPhone = (value: string) => (value.length <= 4 ? "••••" : `${value.slice(0, 2)}***${value.slice(-2)}`);

function assertQaTarget(baseUrl: string): void {
  const isQa = /(pruebas|staging|sandbox|qa|test)/i.test(baseUrl);
  if (!isQa) {
    throw new Error(
      `Destino SIE no es QA/test (${baseUrl}). Este script solo permite entornos de prueba.`,
    );
  }
}

function isComplete(candidate: Candidate): boolean {
  const person = candidate.person;
  if (!person.firstName?.trim() || !person.paternalLastName?.trim() || !person.maternalLastName?.trim()) return false;
  if (!candidate.email?.trim() || !candidate.phone?.trim()) return false;
  const address = person.addresses.find((item) => item.isPrimary)?.street ?? person.addresses[0]?.street;
  return Boolean(address?.trim());
}

async function loadCandidates(prisma: PrismaClient, affiliateType: AffiliateType): Promise<Candidate[]> {
  const rows = await prisma.membershipApplication.findMany({
    where: {
      status: ApplicationStatus.COMPLETED,
      affiliateType,
      deletedAt: null,
      documentType: { in: SUPPORTED_DOCUMENTS },
      personId: { not: null },
    },
    orderBy: { updatedAt: "desc" },
    take: 600,
    select: {
      id: true,
      documentType: true,
      documentNumber: true,
      email: true,
      phone: true,
      person: {
        select: {
          firstName: true,
          paternalLastName: true,
          maternalLastName: true,
          gender: true,
          addresses: { select: { street: true, isPrimary: true } },
        },
      },
    },
  });

  const seen = new Set<string>();
  const candidates: Candidate[] = [];
  for (const row of rows) {
    if (!row.person) continue;
    const key = `${row.documentType}|${row.documentNumber}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const candidate: Candidate = {
      applicationId: row.id,
      documentType: row.documentType,
      documentNumber: row.documentNumber,
      email: row.email,
      phone: row.phone,
      person: row.person,
    };
    if (!isComplete(candidate)) continue;
    candidates.push(candidate);
  }
  return candidates;
}

async function loadByApp(prisma: PrismaClient, applicationId: number): Promise<{ candidate: Candidate; affiliateType: AffiliateType } | null> {
  const row = await prisma.membershipApplication.findUnique({
    where: { id: applicationId },
    select: {
      id: true,
      affiliateType: true,
      documentType: true,
      documentNumber: true,
      email: true,
      phone: true,
      person: {
        select: {
          firstName: true,
          paternalLastName: true,
          maternalLastName: true,
          gender: true,
          addresses: { select: { street: true, isPrimary: true } },
        },
      },
    },
  });
  if (!row?.person) return null;
  const candidate: Candidate = {
    applicationId: row.id,
    documentType: row.documentType,
    documentNumber: row.documentNumber,
    email: row.email,
    phone: row.phone,
    person: row.person,
  };
  return isComplete(candidate) ? { candidate, affiliateType: row.affiliateType } : null;
}

function toSource(candidate: Candidate, withBilling: boolean): AssociateSnapshotSource {
  const person = candidate.person;
  const address =
    person.addresses.find((item) => item.isPrimary)?.street ?? person.addresses[0]?.street ?? "";
  const fullName = [person.firstName, person.paternalLastName, person.maternalLastName]
    .filter(Boolean)
    .join(" ")
    .trim();
  return {
    documentType: candidate.documentType,
    documentNumber: candidate.documentNumber,
    email: candidate.email,
    phone: candidate.phone,
    person: {
      firstName: person.firstName,
      paternalLastName: person.paternalLastName,
      maternalLastName: person.maternalLastName,
      gender: person.gender,
      addresses: person.addresses.map((item) => ({ street: item.street, isPrimary: item.isPrimary })),
    },
    billing: withBilling
      ? {
          taxId: candidate.documentNumber,
          businessName: fullName,
          billingAddress: address,
          billingEmail: candidate.email,
          documentType: candidate.documentType,
          receiptType: "BOLETA",
          billingContact: fullName,
        }
      : null,
  };
}

async function selectAbsent(
  client: AssociatesApiClient,
  candidates: Candidate[],
  needed: number,
  label: string,
): Promise<Candidate[]> {
  const selected: Candidate[] = [];
  let checked = 0;
  for (const candidate of candidates) {
    if (selected.length >= needed || checked >= MAX_CHECK) break;
    checked += 1;
    try {
      const state = await client.getAssociateState({
        tipoDocumento: toSieDocumentType(candidate.documentType),
        numDocumento: candidate.documentNumber,
      });
      if (state.status) {
        console.log(`  [${label}] presente en SIE, se omite: app=${candidate.applicationId} doc=${maskDocument(candidate.documentNumber)}`);
        continue;
      }
      selected.push(candidate);
      console.log(`  [${label}] ausente en SIE, seleccionado: app=${candidate.applicationId} doc=${maskDocument(candidate.documentNumber)}`);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      console.log(`  [${label}] GET estado falló, se omite: app=${candidate.applicationId} doc=${maskDocument(candidate.documentNumber)} (${detail})`);
    }
  }
  return selected;
}

function describe(prepared: Prepared): Record<string, unknown> {
  const payload = prepared.payload;
  return {
    kind: prepared.kind,
    applicationId: prepared.applicationId,
    tipoDocumento: payload.TipoDocumento,
    documento: maskDocument(payload.NumDocumento),
    nombre: [payload.Nombres, payload.ApellidoPaterno, payload.ApellidoMaterno].filter(Boolean).join(" "),
    email: maskEmail(payload.Email),
    telefono: maskPhone(payload.Telefono),
    facturacion: {
      tipo: payload.TipoFacturacion,
      docTipo: payload.TipDocFacturacion,
      documento: maskDocument(payload.NumDocFacturacion),
      razonSocial: payload.RazonSocial ?? null,
    },
    servicios: payload.servicios,
  };
}

async function main(): Promise<void> {
  const prisma = new PrismaClient();
  const baseUrl = process.env.ASSOCIATES_API_BASE_URL?.trim() ?? "";
  try {
    assertQaTarget(baseUrl);
    console.log(`SIE destino: ${baseUrl}`);
    console.log(`Modo: ${SEND ? "SEND (POST real a SIE QA)" : "DRY-RUN (solo GET estado)"}`);
    console.log(`ASSOCIATES_WRITES_ENABLED=${process.env.ASSOCIATES_WRITES_ENABLED ?? "(no definido)"} (este script no lo consulta; el gate es el flag --send + URL QA)`);
    console.log(`Objetivo: ${ACTIVE_COUNT} activos + ${STUDENT_COUNT} estudiantes\n`);

    const client = new AssociatesApiClient(getAssociatesApiConfig());
    const amounts = await new PaymentAmountResolver().resolve();
    console.log(`Montos simulados (config vigente): inscripción=${amounts.registrationAmount} cuota=${amounts.membershipFeeAmount} total=${amounts.totalAmount} ${amounts.currency}\n`);

    const activeCandidates = (await loadCandidates(prisma, AffiliateType.ACTIVE)).filter(
      (candidate) => !SKIP_APPS.has(candidate.applicationId),
    );
    const studentCandidates = (await loadCandidates(prisma, AffiliateType.STUDENT)).filter(
      (candidate) => !SKIP_APPS.has(candidate.applicationId),
    );
    console.log(`Candidatos con datos completos: active=${activeCandidates.length} student=${studentCandidates.length}`);

    const builder = new AssociateIntegrationSnapshotBuilder();
    const mapper = new AssociatesPayloadMapper();
    const effectiveAt = new Date();

    if (RENEWAL_APP > 0) {
      const loaded = await loadByApp(prisma, RENEWAL_APP);
      if (!loaded) throw new Error(`App ${RENEWAL_APP} no existe o no tiene datos completos.`);
      if (loaded.affiliateType !== AffiliateType.ACTIVE) throw new Error(`App ${RENEWAL_APP} no es un asociado activo; no aplica renovación.`);
      if (!Number.isSafeInteger(RENEWAL_ANNO) || RENEWAL_ANNO < 2000 || RENEWAL_ANNO > 9999) {
        throw new Error("Indica el año de la renovación con --anno=<year>, p. ej. --anno=2027.");
      }

      const candidate = loaded.candidate;
      const initial = builder.activeFrom(toSource(candidate, true), effectiveAt, {
        registration: amounts.registrationAmount,
        monthlyFee: amounts.membershipFeeAmount,
        total: amounts.totalAmount,
      });
      const renewal = mapper.map(builder.renewalFromInitialActiveSnapshot(initial, RENEWAL_ANNO));

      console.log(`\n=== Renovación app=${RENEWAL_APP} anno=${RENEWAL_ANNO} ===`);
      try {
        const state = await client.getAssociateState({
          tipoDocumento: toSieDocumentType(candidate.documentType),
          numDocumento: candidate.documentNumber,
        });
        if (state.status) {
          console.log(
            "Estado actual SIE: " +
              state.cuotas
                .map((quota) => `${quota.concepto} anno=${quota.anno} ${quota.fechaInicio}->${quota.fechaFin} ${quota.estadoContable}`)
                .join(" | "),
          );
        } else {
          console.log(`Estado actual SIE: no existe como asociado (${state.message}).`);
        }
      } catch (error) {
        console.log("No se pudo leer el estado actual:", error instanceof Error ? error.message : String(error));
      }

      console.log(JSON.stringify(describe({ kind: "ACTIVE", applicationId: candidate.applicationId, payload: renewal }), null, 2));

      if (!SEND) {
        console.log("\nDRY-RUN: no se envió la renovación. Ejecuta con --send.");
        return;
      }

      const renewalResult = await client.createAssociate(renewal);
      console.log("\n=== Resultado ===");
      console.log(
        JSON.stringify(
          {
            ok: true,
            httpStatus: renewalResult.httpStatus,
            codigoAsociado: renewalResult.externalAssociateCode,
            mensaje: renewalResult.externalMessage,
            comprobante: renewalResult.receipt ?? null,
          },
          null,
          2,
        ),
      );
      return;
    }

    const buildPayload = (candidate: Candidate, kind: "ACTIVE" | "STUDENT"): AssociateRequestPayloadSnapshot => {
      const source = toSource(candidate, kind === "ACTIVE");
      return mapper.map(
        kind === "ACTIVE"
          ? builder.activeFrom(source, effectiveAt, {
              registration: amounts.registrationAmount,
              monthlyFee: amounts.membershipFeeAmount,
              total: amounts.totalAmount,
            })
          : builder.studentFrom(source, effectiveAt),
      );
    };

    if (!SEND) {
      console.log("\nBuscando activos ausentes en SIE...");
      const activeSelected = await selectAbsent(client, activeCandidates, ACTIVE_COUNT, "ACTIVE");
      console.log("\nBuscando estudiantes ausentes en SIE...");
      const studentSelected = await selectAbsent(client, studentCandidates, STUDENT_COUNT, "STUDENT");

      if (activeSelected.length < ACTIVE_COUNT || studentSelected.length < STUDENT_COUNT) {
        console.warn(
          `\nADVERTENCIA: no se completó la cuota. activos=${activeSelected.length}/${ACTIVE_COUNT} estudiantes=${studentSelected.length}/${STUDENT_COUNT}. ` +
            `Puedes ampliar --max-check o indicar documentos concretos.`,
        );
      }

      const prepared: Prepared[] = [
        ...activeSelected.map((candidate) => ({ kind: "ACTIVE" as const, applicationId: candidate.applicationId, payload: buildPayload(candidate, "ACTIVE") })),
        ...studentSelected.map((candidate) => ({ kind: "STUDENT" as const, applicationId: candidate.applicationId, payload: buildPayload(candidate, "STUDENT") })),
      ];
      console.log(`\n=== Payloads preparados (${prepared.length}) ===`);
      for (const item of prepared) console.log(JSON.stringify(describe(item), null, 2));
      console.log("\nDRY-RUN: no se envió nada al SIE. Ejecuta con --send para crear los asociados en SIE QA.");
      return;
    }

    console.log("\n=== Enviando a SIE QA (sin correos) ===");
    const results: Array<Record<string, unknown>> = [];

    const sendGroup = async (kind: "ACTIVE" | "STUDENT", candidates: Candidate[], target: number): Promise<void> => {
      if (target <= 0) return;
      let successes = 0;
      let checked = 0;
      console.log(`\n[${kind}] objetivo=${target} (solo ausentes; continúa ante error hasta lograrlo)`);
      for (const candidate of candidates) {
        if (successes >= target || checked >= MAX_CHECK) break;
        checked += 1;
        try {
          const state = await client.getAssociateState({
            tipoDocumento: toSieDocumentType(candidate.documentType),
            numDocumento: candidate.documentNumber,
          });
          if (state.status) {
            console.log(`  [${kind}] presente en SIE, se omite: app=${candidate.applicationId} doc=${maskDocument(candidate.documentNumber)}`);
            continue;
          }
        } catch (error) {
          const detail = error instanceof Error ? error.message : String(error);
          console.log(`  [${kind}] GET estado falló, se omite: app=${candidate.applicationId} doc=${maskDocument(candidate.documentNumber)} (${detail})`);
          continue;
        }

        const payload = buildPayload(candidate, kind);
        try {
          const result = await client.createAssociate(payload);
          successes += 1;
          results.push({
            kind,
            applicationId: candidate.applicationId,
            documento: maskDocument(payload.NumDocumento),
            ok: true,
            httpStatus: result.httpStatus,
            codigoAsociado: result.externalAssociateCode,
            mensaje: result.externalMessage,
            comprobante: result.receipt ?? null,
          });
          console.log(`  OK ${kind} app=${candidate.applicationId} doc=${maskDocument(payload.NumDocumento)} codigo=${result.externalAssociateCode} http=${result.httpStatus}`);
        } catch (error) {
          const node = error as { message?: string; code?: string; httpStatus?: number };
          results.push({
            kind,
            applicationId: candidate.applicationId,
            documento: maskDocument(payload.NumDocumento),
            ok: false,
            httpStatus: node.httpStatus ?? null,
            code: node.code ?? null,
            message: node.message ?? String(error),
          });
          console.log(`  ERROR ${kind} app=${candidate.applicationId} doc=${maskDocument(payload.NumDocumento)} http=${node.httpStatus ?? "?"} code=${node.code ?? "?"} ${node.message ?? ""}`);
        }
      }
      if (successes < target) console.warn(`  [${kind}] solo ${successes}/${target} exitosos (posible límite de candidatos ausentes).`);
    };

    await sendGroup("ACTIVE", activeCandidates, ACTIVE_COUNT);
    await sendGroup("STUDENT", studentCandidates, STUDENT_COUNT);

    const okCount = results.filter((item) => item.ok === true).length;
    console.log("\n=== Resumen ===");
    console.log(JSON.stringify({ exitosos: okCount, total: results.length, resultados: results }, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("FATAL:", error instanceof Error ? error.message : String(error));
  process.exit(1);
});
