import { createHash } from "node:crypto";
import type { DocumentType, QuotaConcept } from "@prisma/client";
import { QuotaDomainError } from "../Models/QuotaErrors";
import type { NormalizedQuota, QuotaIdentity } from "../Models/QuotaModels";

const DOCUMENT_TYPE_BY_VALUE: Readonly<Record<string, DocumentType>> = {
  "1": "DNI",
  "4": "CE",
  "7": "PASSPORT",
  DNI: "DNI",
  CE: "CE",
  PASSPORT: "PASSPORT",
};

export type QuotaPersonIdentityInput = {
  provider?: string;
  documentType: string;
  documentNumber: string;
};

export type QuotaIdentityInput = QuotaPersonIdentityInput & {
  concept: QuotaConcept | "INSCRIPCION" | "CUOTA";
  year: number;
  quotaNumber?: number | null;
  /** Solo para INSCRIPCION: distingue inscripciones múltiples por año. */
  inscriptionDiscriminator?: string | null;
};

export function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function normalizeDocumentType(value: string): DocumentType {
  const normalized = DOCUMENT_TYPE_BY_VALUE[value.trim().toUpperCase()];
  if (!normalized) {
    throw new QuotaDomainError("INVALID_DOCUMENT", "El tipo de documento no es compatible con la integración SIE.");
  }
  return normalized;
}

/**
 * Resuelve la identidad estable de una cuota.
 *
 * La identidad NUNCA incluye monto, estado contable, fecha de pago, fechas de
 * período, número de comprobante ni marcas de sincronización. Esos atributos
 * se controlan mediante sourcePayloadHash.
 */
export class QuotaIdentityResolver {
  resolvePerson(input: QuotaPersonIdentityInput): { documentType: DocumentType; documentNumberHash: string; personIdentityHash: string } {
    const documentType = normalizeDocumentType(input.documentType);
    const documentNumber = input.documentNumber.trim();
    if (!documentNumber) {
      throw new QuotaDomainError("INVALID_DOCUMENT", "El número de documento es obligatorio para identificar la cuota.");
    }
    return {
      documentType,
      documentNumberHash: sha256(documentNumber),
      personIdentityHash: sha256(`${documentType}|${documentNumber}`),
    };
  }

  resolve(input: QuotaIdentityInput): QuotaIdentity {
    const person = this.resolvePerson(input);
    const provider = (input.provider ?? "SIE").trim().toUpperCase() || "SIE";
    if (!Number.isSafeInteger(input.year) || input.year < 1900 || input.year > 2100) {
      throw new QuotaDomainError("INVALID_YEAR", "El año de la cuota no es válido.");
    }

    if (input.concept !== "INSCRIPCION" && input.concept !== "CUOTA") {
      throw new QuotaDomainError("INVALID_CONCEPT", "El concepto de la cuota no es compatible con la integración SIE.");
    }

    if (input.concept === "INSCRIPCION" && input.quotaNumber != null) {
      throw new QuotaDomainError("INVALID_QUOTA_NUMBER", "La inscripción no debe tener número de cuota.");
    }

    if (input.concept === "CUOTA" && (!Number.isSafeInteger(input.quotaNumber) || (input.quotaNumber ?? 0) < 1)) {
      throw new QuotaDomainError("INVALID_QUOTA_NUMBER", "La cuota requiere un número entero positivo.");
    }

    const inscriptionDiscriminator = input.inscriptionDiscriminator?.trim();
    const periodKey = input.concept === "CUOTA"
      ? `${input.year}|${input.quotaNumber}`
      : inscriptionDiscriminator
        ? `Y${inscriptionDiscriminator}`
        : "INSCRIPCION";
    return {
      personIdentityHash: person.personIdentityHash,
      documentType: person.documentType,
      documentNumberHash: person.documentNumberHash,
      sourceKey: `${provider}|${person.personIdentityHash}|${input.concept}|${periodKey}`,
    };
  }
}

/** Falla cerrado si el SIE devuelve dos filas para la misma identidad de cuota. */
export function assertUniqueQuotaIdentities(quotas: readonly NormalizedQuota[]): void {
  const seen = new Set<string>();
  const duplicated = new Set<string>();
  for (const quota of quotas) {
    if (seen.has(quota.sourceKey)) duplicated.add(quota.sourceKey);
    seen.add(quota.sourceKey);
  }
  if (duplicated.size > 0) {
    throw new QuotaDomainError(
      "AMBIGUOUS_QUOTA_IDENTITY",
      `La respuesta del SIE contiene ${duplicated.size} identidad(es) de cuota duplicada(s). No se aplicará una deduplicación destructiva.`,
    );
  }
}
