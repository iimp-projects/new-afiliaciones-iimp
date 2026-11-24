import { randomBytes } from "node:crypto";
import { AffiliateType, Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { resolveAffiliatePhoto } from "@/modules/shared/Services/AffiliatePhotoResolver";
import { S3StorageService } from "@/modules/shared/Services/S3StorageService";
import { resolveAssociateCode } from "@/modules/shared/Utils/associateCode";
import { currentQuotaYear } from "@/modules/afiliaciones/quotas/Services/quotaPendingScope";
import { MAX_PENDING_QUOTAS } from "../Models/cardRules";

export { MAX_PENDING_QUOTAS };

type Database = PrismaClient | Prisma.TransactionClient;

export type CardSource = "NEW" | "MIGRATED";

export type CardData = {
  firstName: string;
  paternalLastName: string;
  maternalLastName: string | null;
  name: string;
  code: string | null;
  category: string | null;
  photoUrl: string | null;
  source: CardSource | null;
};

export type CardEligibility = { eligible: boolean; reason: string | null; pendingQuotaCount?: number };

export type ExistingCard = {
  generated: boolean;
  status: "ISSUED" | "REVOKED" | null;
  verificationToken: string | null;
  issuedAt: Date | null;
  revokedAt: Date | null;
  revokedReason: string | null;
};

export class CardError extends Error {
  constructor(
    message: string,
    readonly code: "REVOKED" | "CONFLICT" | "NOT_FOUND" | "NOT_ELIGIBLE",
  ) {
    super(message);
    this.name = "CardError";
  }
}

function affiliateTypeLabel(type: AffiliateType): string {
  return type === "STUDENT" ? "Asociado Estudiante" : "Asociado Activo";
}

function permittedCategory(category: { mappedAffiliateType: AffiliateType | null } | null | undefined): boolean {
  return category?.mappedAffiliateType === "ACTIVE" || category?.mappedAffiliateType === "STUDENT";
}

// Preservada para la reactivación de las validaciones SIE (ver TODO en `eligibility`).
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function categoryLabel(category: { mappedAffiliateType: AffiliateType | null; name: string } | null | undefined): string | null {
  if (!category) return null;
  if (category.mappedAffiliateType) return affiliateTypeLabel(category.mappedAffiliateType);
  return category.name;
}

type PersonWithCardSources = {
  firstName: string;
  paternalLastName: string;
  maternalLastName: string | null;
  associateCode: string | null;
  user: { image: string | null } | null;
  applications: Array<{
    status: string;
    affiliateType: AffiliateType;
    documents: Array<{ mimeType: string; category: string | null; fileName: string | null; fileUrl: string }>;
    associateIntegration: { status: string; externalAssociateCode: number | null } | null;
  }>;
  sieAssociateRecords: Array<{
    externalCode: string;
    category: { mappedAffiliateType: AffiliateType | null; name: string } | null;
  }>;
};

async function resolvePhotoUrl(person: PersonWithCardSources): Promise<string | null> {
  const photo = await resolveAffiliatePhoto(person.applications as never);
  if (photo) return photo;
  const avatar = person.user?.image ?? null;
  if (avatar) return await new S3StorageService().getPresignedAvatarUrl(avatar);
  return null;
}

function eligibility(
  person: PersonWithCardSources,
  migrated: PersonWithCardSources["sieAssociateRecords"][number] | undefined,
  completed: PersonWithCardSources["applications"][number] | undefined,
  pendingQuotaCount: number,
): CardEligibility {
  // TODO: Reactivar validaciones de elegibilidad institucional/SIE en una siguiente fase.
  // ===========================================================================
  // Regla original (conservada, desactivada temporalmente):
  //   if (migrated || completed) return { eligible: true, reason: null };
  //   const hasBlockedCategory = person.sieAssociateRecords.some(
  //     (record) => record.externalCode?.trim() && !permittedCategory(record.category),
  //   );
  //   if (hasBlockedCategory) return { eligible: false, reason: "Categoría institucional no permitida para el carnet." };
  //   const hasCompletedApplication = person.applications.some((application) => application.status === "COMPLETED");
  //   if (hasCompletedApplication) return { eligible: false, reason: "El código institucional aún no fue confirmado por SIE." };
  //   return { eligible: false, reason: "No se encontró una membresía institucional elegible." };
  // ===========================================================================
  const completedApplication = person.applications.find((application) => application.status === "COMPLETED");
  const completedType = completedApplication?.affiliateType;
  const migratedType = migrated?.category?.mappedAffiliateType;
  const hasEligibleCompleted = completedType === AffiliateType.ACTIVE || completedType === AffiliateType.STUDENT;
  const hasEligibleMigrated = migratedType === AffiliateType.ACTIVE || migratedType === AffiliateType.STUDENT;
  if (!hasEligibleCompleted && !hasEligibleMigrated) {
    return { eligible: false, reason: "No se encontró una membresía institucional elegible.", pendingQuotaCount };
  }
  if (pendingQuotaCount > MAX_PENDING_QUOTAS) {
    return {
      eligible: false,
      reason: `La membresía registra ${pendingQuotaCount} cuotas pendientes (máximo permitido: ${MAX_PENDING_QUOTAS}). Queda restringida.`,
      pendingQuotaCount,
    };
  }
  return { eligible: true, reason: null, pendingQuotaCount };
}

/**
 * Cuenta las cuotas de membresía pendientes y exigibles (excluye años futuros,
 * que son la próxima cuota a pagar) según la tabla local sincronizada desde SIE.
 */
async function countPendingQuotas(personId: number, db: Database): Promise<number> {
  return db.associateQuota.count({
    where: {
      personId,
      concept: "CUOTA",
      accountingStatus: "PENDIENTE",
      year: { lte: currentQuotaYear() },
      isPresentInLastSuccessfulSync: true,
    },
  });
}

/**
 * Resuelve los datos institucionales del carnet y su elegibilidad. Es
 * estrictamente de solo lectura: nunca crea registros ni consulta SIE.
 */
export interface ResolveCardDataOptions {
  /** Evita resolver la foto (y sus URLs firmadas) cuando solo se requiere el estado institucional. */
  readonly includePhoto?: boolean;
}

export async function resolveCardData(
  personId: number,
  db: Database = prisma,
  options: ResolveCardDataOptions = {},
): Promise<CardData & CardEligibility & { notFound: boolean }> {
  const person = await db.person.findUnique({
    where: { id: personId, deletedAt: null },
    include: {
      user: { select: { image: true } },
      applications: {
        where: { deletedAt: null },
        orderBy: { updatedAt: "desc" },
        include: {
          documents: { orderBy: { updatedAt: "desc" } },
          associateIntegration: true,
        },
      },
      sieAssociateRecords: {
        where: { linkStatus: "LINKED" },
        orderBy: { updatedAt: "desc" },
        include: { category: true },
      },
    },
  });

  if (!person) {
    return {
      firstName: "", paternalLastName: "", maternalLastName: null, name: "",
      code: null, category: null, photoUrl: null, source: null,
      eligible: false, reason: "Asociado no encontrado.", pendingQuotaCount: 0, notFound: true,
    };
  }

  const migrated = person.sieAssociateRecords.find(
    (record) => record.externalCode?.trim() && permittedCategory(record.category),
  );
  const completed = person.applications.find(
    (application) =>
      application.status === "COMPLETED" &&
      application.associateIntegration?.status === "SYNCED" &&
      application.associateIntegration.externalAssociateCode != null,
  );

  // TODO: Reactivar validaciones de elegibilidad institucional/SIE en una siguiente fase.
  // REGLA SIMPLIFICADA TEMPORAL: categoría (ACTIVE/STUDENT) + postulación COMPLETED.
  const completedApplication = person.applications.find((application) => application.status === "COMPLETED");
  const affiliateType = completedApplication?.affiliateType ?? migrated?.category?.mappedAffiliateType ?? null;
  const isActiveOrStudent = affiliateType === AffiliateType.ACTIVE || affiliateType === AffiliateType.STUDENT;

  const source: CardSource | null = completedApplication && isActiveOrStudent
    ? "NEW"
    : migrated && isActiveOrStudent
      ? "MIGRATED"
      : null;
  // Código institucional SIE: se conserva solo para presentación. Si aún no existe,
  // el carnet usa el mismo código local A-<personId> que muestra la ficha del asociado.
  const code = resolveAssociateCode(person)
    ?? (migrated
      ? migrated.externalCode.trim()
      : completed
        ? String(completed.associateIntegration!.externalAssociateCode)
        : null);
  const category = affiliateType ? affiliateTypeLabel(affiliateType) : null;

  const pendingQuotaCount = await countPendingQuotas(personId, db);
  const { eligible, reason } = eligibility(person, migrated, completed, pendingQuotaCount);
  const photoUrl = options.includePhoto === false ? null : await resolvePhotoUrl(person);

  return {
    firstName: person.firstName,
    paternalLastName: person.paternalLastName,
    maternalLastName: person.maternalLastName,
    name: [person.firstName, person.paternalLastName, person.maternalLastName].filter(Boolean).join(" ").trim(),
    code,
    category,
    photoUrl,
    source,
    eligible,
    reason,
    pendingQuotaCount,
    notFound: false,
  };
}

export function newVerificationToken(): string {
  return randomBytes(16).toString("base64url");
}

export async function getCard(personId: number, db: Database = prisma): Promise<ExistingCard> {
  const card = await db.associateCard.findUnique({ where: { personId } });
  if (!card) return { generated: false, status: null, verificationToken: null, issuedAt: null, revokedAt: null, revokedReason: null };
  return {
    generated: true,
    status: card.status,
    verificationToken: card.verificationToken,
    issuedAt: card.createdAt,
    revokedAt: card.revokedAt,
    revokedReason: card.revokedReason,
  };
}

export type CardRecord = {
  id: string;
  personId: number;
  verificationToken: string;
  status: "ISSUED" | "REVOKED";
  issuedAt: Date;
  revokedAt: Date | null;
  revokedReason: string | null;
  updatedAt: Date;
};

/** Registro institucional del carné; único por persona. */
export async function getCardRecord(personId: number, db: Database = prisma): Promise<CardRecord | null> {
  const card = await db.associateCard.findUnique({ where: { personId } });
  if (!card) return null;
  return {
    id: card.id,
    personId: card.personId,
    verificationToken: card.verificationToken,
    status: card.status,
    issuedAt: card.createdAt,
    revokedAt: card.revokedAt,
    revokedReason: card.revokedReason,
    updatedAt: card.updatedAt,
  };
}

/**
 * Crea la credencial si no existe. Idempotente ante solicitudes simultáneas
 * (único por persona + P2002). Nunca reactiva automáticamente una revocada.
 */
export type IssuedCard = { verificationToken: string; status: "ISSUED"; created: boolean };

export async function issueCard(
  personId: number,
  db: Database = prisma,
): Promise<IssuedCard> {
  const existing = await db.associateCard.findUnique({ where: { personId } });
  if (existing?.status === "ISSUED") return { verificationToken: existing.verificationToken, status: "ISSUED", created: false };
  if (existing?.status === "REVOKED") throw new CardError("Credencial revocada. Solicite la regeneración administrativa.", "REVOKED");

  try {
    const created = await db.associateCard.create({ data: { personId, verificationToken: newVerificationToken() } });
    return { verificationToken: created.verificationToken, status: "ISSUED", created: true };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const raced = await db.associateCard.findUnique({ where: { personId } });
      if (raced?.status === "ISSUED") return { verificationToken: raced.verificationToken, status: "ISSUED", created: false };
    }
    throw error;
  }
}

export async function revokeCard(personId: number, reason: string, db: Database = prisma): Promise<void> {
  const card = await db.associateCard.findUnique({ where: { personId } });
  if (!card) throw new CardError("No existe una credencial para este asociado.", "NOT_FOUND");
  if (card.status === "REVOKED") return;
  await db.associateCard.update({
    where: { personId },
    data: { status: "REVOKED", revokedAt: new Date(), revokedReason: reason },
  });
}

/**
 * Genera un token completamente nuevo e invalida el QR anterior. No conserva
 * historial de versiones (fuera del MVP); la acción se audita en el caller.
 */
export async function regenerateCard(
  personId: number,
  db: Database = prisma,
): Promise<{ verificationToken: string; status: "ISSUED" }> {
  const card = await db.associateCard.findUnique({ where: { personId } });
  if (!card) throw new CardError("No existe una credencial para este asociado.", "NOT_FOUND");
  const verificationToken = newVerificationToken();
  await db.associateCard.update({
    where: { personId },
    data: { verificationToken, status: "ISSUED", revokedAt: null, revokedReason: null },
  });
  return { verificationToken, status: "ISSUED" };
}
