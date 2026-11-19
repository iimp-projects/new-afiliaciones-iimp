import type { QuotaAccountingStatus, QuotaConcept } from "@prisma/client";
import type { SieAssociateStateQuota } from "@/modules/afiliaciones/associates-integration/Models/AssociateIntegration";
import { QuotaDomainError } from "../Models/QuotaErrors";
import type { NormalizedQuota } from "../Models/QuotaModels";
import { QuotaIdentityResolver, assertUniqueQuotaIdentities, sha256, type QuotaIdentityInput, type QuotaPersonIdentityInput } from "./QuotaIdentityResolver";

const ACCOUNTING_STATUS_BY_VALUE: Readonly<Record<string, QuotaAccountingStatus>> = {
  Facturado: "FACTURADO",
  Pendiente: "PENDIENTE",
};

const SUPPORTED_CURRENCIES = new Set(["S/", "US$"]);

export class QuotaNormalizer {
  constructor(private readonly resolver: QuotaIdentityResolver = new QuotaIdentityResolver()) {}

  normalize(quota: SieAssociateStateQuota, person: QuotaPersonIdentityInput & { institutionalCode?: string | null }, inscriptionDiscriminator?: string): NormalizedQuota {
    const concept = this.concept(quota.concepto);
    const identityInput: QuotaIdentityInput = {
      provider: "SIE",
      documentType: person.documentType,
      documentNumber: person.documentNumber,
      concept,
      year: this.year(quota.anno),
      quotaNumber: quota.numero ?? null,
      inscriptionDiscriminator,
    };
    const identity = this.resolver.resolve(identityInput);

    const amount = this.amount(quota.monto);
    const currency = this.currency(quota.moneda);
    const accountingStatus = this.accountingStatus(quota.estadoContable);
    const membershipType = this.membershipType(quota.tipo);
    const paidAt = this.dateOrNull(quota.fechaPago, "fecha de pago");
    const periodStart = this.dateOrNull(quota.fechaInicio, "fecha de inicio");
    const periodEnd = this.dateOrNull(quota.fechaFin, "fecha de fin");
    const receiptSerie = this.emptyToNull(quota.docGSer);
    const receiptNumber = this.emptyToNull(quota.docGNro);

    const sourcePayloadHash = sha256(JSON.stringify({
      provider: identityInput.provider,
      concept,
      quotaNumber: quota.numero ?? null,
      year: identityInput.year,
      currency,
      amount,
      accountingStatus,
      membershipType,
      paidAt,
      periodStart,
      periodEnd,
      receiptSerie,
      receiptNumber,
    }));

    return {
      provider: "SIE",
      personIdentityHash: identity.personIdentityHash,
      documentType: identity.documentType,
      documentNumberHash: identity.documentNumberHash,
      sourceKey: identity.sourceKey,
      sourcePayloadHash,
      institutionalCode: this.emptyToNull(person.institutionalCode),
      concept,
      quotaNumber: quota.numero ?? null,
      year: identityInput.year,
      currency,
      amount,
      accountingStatus,
      membershipType,
      paidAt,
      periodStart,
      periodEnd,
      receiptSerie,
      receiptNumber,
    };
  }

  normalizeAll(
    quotas: readonly SieAssociateStateQuota[],
    person: QuotaPersonIdentityInput & { institutionalCode?: string | null },
    existingLegacyInscriptionYear?: number | null,
  ): NormalizedQuota[] {
    const inscriptions = quotas.filter((quota) => quota.concepto === "INSCRIPCION");
    const inscriptionsByYear = new Map<number, number>();
    for (const inscription of inscriptions) {
      inscriptionsByYear.set(inscription.anno, (inscriptionsByYear.get(inscription.anno) ?? 0) + 1);
    }
    if (inscriptions.length > 1 && [...inscriptionsByYear.values()].some((count) => count > 1)) {
      throw new QuotaDomainError(
        "AMBIGUOUS_QUOTA_IDENTITY",
        "El SIE devuelve múltiples inscripciones para el mismo año; no existe una identidad estable sin definir una regla funcional.",
      );
    }

    const multipleInscriptions = inscriptions.length > 1;
    const knownLegacyPresent = existingLegacyInscriptionYear != null && inscriptionsByYear.has(existingLegacyInscriptionYear);
    let primaryInscriptionYear: number | null = null;
    if (multipleInscriptions) {
      primaryInscriptionYear = knownLegacyPresent
        ? existingLegacyInscriptionYear
        : existingLegacyInscriptionYear == null
          ? Math.min(...inscriptionsByYear.keys())
          : null;
    } else if (inscriptions.length === 1) {
      const onlyYear = inscriptions[0].anno;
      primaryInscriptionYear = existingLegacyInscriptionYear == null || onlyYear === existingLegacyInscriptionYear ? onlyYear : null;
    }

    const normalized = quotas.map((quota) => this.normalize(
      quota,
      person,
      quota.concepto === "INSCRIPCION" && quota.anno !== primaryInscriptionYear ? String(quota.anno) : undefined,
    ));
    assertUniqueQuotaIdentities(normalized);
    return normalized;
  }

  private concept(value: string): QuotaConcept {
    if (value === "INSCRIPCION" || value === "CUOTA") return value;
    throw new QuotaDomainError("INVALID_CONCEPT", "El concepto de la cuota no es compatible con la integración SIE.");
  }

  private year(value: number): number {
    if (!Number.isSafeInteger(value) || value < 1900 || value > 2100) {
      throw new QuotaDomainError("INVALID_YEAR", "El año de la cuota no es válido.");
    }
    return value;
  }

  private amount(value: number): string {
    if (!Number.isFinite(value) || value < 0) {
      throw new QuotaDomainError("INVALID_AMOUNT", "El monto de la cuota no es válido.");
    }
    const minor = Math.round(value * 100);
    if (!Number.isSafeInteger(minor) || Math.abs(value * 100 - minor) > 1e-7) {
      throw new QuotaDomainError("INVALID_AMOUNT", "El monto de la cuota excede la precisión soportada.");
    }
    return (minor / 100).toFixed(2);
  }

  private currency(value: string): string {
    if (!SUPPORTED_CURRENCIES.has(value)) {
      throw new QuotaDomainError("INVALID_CURRENCY", "La moneda de la cuota no es compatible con la integración SIE.");
    }
    return value;
  }

  private accountingStatus(value: string): QuotaAccountingStatus {
    const status = ACCOUNTING_STATUS_BY_VALUE[value];
    if (!status) {
      throw new QuotaDomainError("INVALID_ACCOUNTING_STATUS", "El estado contable de la cuota no es compatible con la integración SIE.");
    }
    return status;
  }

  private membershipType(value: string): string {
    const normalized = value.trim();
    if (!normalized) {
      throw new QuotaDomainError("INVALID_MEMBERSHIP_TYPE", "El tipo de registro de la cuota es obligatorio.");
    }
    return normalized;
  }

  private dateOrNull(value: string, label: string): string | null {
    if (!value) return null;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      throw new QuotaDomainError("INVALID_DATE", `La ${label} de la cuota no es válida.`);
    }
    const [year, month, day] = value.split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
      throw new QuotaDomainError("INVALID_DATE", `La ${label} de la cuota no es válida.`);
    }
    return value;
  }

  private emptyToNull(value: string | null | undefined): string | null {
    if (typeof value !== "string") return null;
    const normalized = value.trim();
    return normalized ? normalized : null;
  }
}
