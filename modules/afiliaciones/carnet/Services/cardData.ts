import { randomBytes } from "node:crypto";
import { AffiliateType, Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { resolveAffiliatePhoto } from "@/modules/shared/Services/AffiliatePhotoResolver";
import { S3StorageService } from "@/modules/shared/Services/S3StorageService";

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

export type CardEligibility = { eligible: boolean; reason: string | null };

export type ExistingCard = {
  generated: boolean;
  status: "ISSUED" | "REVOKED" | null;
  verificationToken: string | null;
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
  void migrated;
  void completed;

  const completedApplication = person.applications.find((application) => application.status === "COMPLETED");
  if (completedApplication) {
    if (completedApplication.affiliateType === AffiliateType.ACTIVE || completedApplication.affiliateType === AffiliateType.STUDENT) {
      return { eligible: true, reason: null };
    }
    return { eligible: false, reason: "La categoría del asociado no es elegible para el carnet." };
  }
  return { eligible: false, reason: "La postulación no está completada." };
}

/**
 * Resuelve los datos institucionales del carnet y su elegibilidad. Es
 * estrictamente de solo lectura: nunca crea registros ni consulta SIE.
 */
export async function resolveCardData(
  personId: number,
  db: Database = prisma,
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
      eligible: false, reason: "Asociado no encontrado.", notFound: true,
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
  const affiliateType = completedApplication?.affiliateType ?? null;
  const isActiveOrStudent = affiliateType === AffiliateType.ACTIVE || affiliateType === AffiliateType.STUDENT;

  const source: CardSource | null = completedApplication && isActiveOrStudent ? "NEW" : null;
  // Código institucional SIE: se conserva solo para presentación (puede ser null;
  // la UI/PDF mostrarán "Pendiente de sincronización SIE"). Ya no condiciona la elegibilidad.
  const code = migrated
    ? migrated.externalCode.trim()
    : completed
      ? String(completed.associateIntegration!.externalAssociateCode)
      : null;
  const category = affiliateType ? affiliateTypeLabel(affiliateType) : null;

  const { eligible, reason } = eligibility(person, migrated, completed);
  const photoUrl = await resolvePhotoUrl(person);

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
    notFound: false,
  };
}

export function newVerificationToken(): string {
  return randomBytes(16).toString("base64url");
}

export async function getCard(personId: number, db: Database = prisma): Promise<ExistingCard> {
  const card = await db.associateCard.findUnique({ where: { personId } });
  if (!card) return { generated: false, status: null, verificationToken: null, revokedAt: null, revokedReason: null };
  return {
    generated: true,
    status: card.status,
    verificationToken: card.verificationToken,
    revokedAt: card.revokedAt,
    revokedReason: card.revokedReason,
  };
}

/**
 * Crea la credencial si no existe. Idempotente ante solicitudes simultáneas
 * (único por persona + P2002). Nunca reactiva automáticamente una revocada.
 */
export async function issueCard(
  personId: number,
  db: Database = prisma,
): Promise<{ verificationToken: string; status: "ISSUED" }> {
  const existing = await db.associateCard.findUnique({ where: { personId } });
  if (existing?.status === "ISSUED") return { verificationToken: existing.verificationToken, status: "ISSUED" };
  if (existing?.status === "REVOKED") throw new CardError("Credencial revocada. Solicite la regeneración administrativa.", "REVOKED");

  try {
    const created = await db.associateCard.create({ data: { personId, verificationToken: newVerificationToken() } });
    return { verificationToken: created.verificationToken, status: "ISSUED" };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const raced = await db.associateCard.findUnique({ where: { personId } });
      if (raced?.status === "ISSUED") return { verificationToken: raced.verificationToken, status: "ISSUED" };
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
