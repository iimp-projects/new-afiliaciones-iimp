import type {
  AccessMovementSource,
  AccessMovementType,
  AccessValidationResult,
} from "@prisma/client";
import type { AccessIdentityDto, AccessMovementDto, AccessPresenceDto } from "../Models/access";

type AffiliateTypeLike = "ACTIVE" | "STUDENT" | null;

type PersonName = {
  firstName: string;
  paternalLastName: string;
  maternalLastName: string | null;
  associateCode: string | null;
};

export function fullName(person: PersonName): string {
  return [person.firstName, person.paternalLastName, person.maternalLastName].filter(Boolean).join(" ");
}

export function categoryLabel(affiliateType: AffiliateTypeLike, sieCategoryName: string | null | undefined): string | null {
  if (affiliateType === "ACTIVE") return "Asociado Activo";
  if (affiliateType === "STUDENT") return "Asociado Estudiante";
  return sieCategoryName?.trim() || null;
}

type SearchRow = {
  id: number;
  firstName: string;
  paternalLastName: string;
  maternalLastName: string | null;
  associateCode: string | null;
  user: { image: string | null } | null;
  applications: Array<{ affiliateType: "ACTIVE" | "STUDENT"; documents: Array<{ fileUrl: string }> }>;
  sieAssociateRecords: Array<{ externalCode: string; category: { name: string; mappedAffiliateType: AffiliateTypeLike } | null }>;
};

export function searchRowToIdentity(row: SearchRow): AccessIdentityDto {
  const application = row.applications[0];
  const sie = row.sieAssociateRecords[0];
  return {
    id: row.id,
    fullName: fullName(row),
    code: row.associateCode ?? sie?.externalCode ?? null,
    category: categoryLabel(application?.affiliateType ?? sie?.category?.mappedAffiliateType ?? null, sie?.category?.name),
    photoUrl: row.user?.image ?? application?.documents[0]?.fileUrl ?? null,
  };
}

type MovementRow = {
  id: string;
  movementType: AccessMovementType;
  validationResult: AccessValidationResult;
  reasonCode: string | null;
  source: AccessMovementSource;
  occurredAt: Date;
  person: PersonName & { id: number };
  site: { id: number; name: string };
  accessPoint: { id: number; name: string };
  registeredByUser: { name: string | null; email: string } | null;
};

export function movementToDto(row: MovementRow): AccessMovementDto {
  return {
    id: row.id,
    person: { id: row.person.id, fullName: fullName(row.person), code: row.person.associateCode },
    site: row.site,
    accessPoint: row.accessPoint,
    movementType: row.movementType,
    validationResult: row.validationResult,
    reasonCode: row.reasonCode,
    source: row.source,
    occurredAt: row.occurredAt.toISOString(),
    registeredBy: row.registeredByUser?.name ?? row.registeredByUser?.email ?? null,
  };
}

type PresenceRow = {
  id: number;
  entryAt: Date;
  person: PersonName & { id: number; user: { image: string | null } | null };
  site: { id: number; name: string };
  entryPoint: { id: number; name: string };
};

export function presenceToDto(row: PresenceRow): AccessPresenceDto {
  return {
    sessionId: row.id,
    person: { id: row.person.id, fullName: fullName(row.person), code: row.person.associateCode, photoUrl: row.person.user?.image ?? null },
    site: row.site,
    entryPoint: row.entryPoint,
    entryAt: row.entryAt.toISOString(),
  };
}
