/* eslint-disable @typescript-eslint/no-explicit-any -- structural query helpers shared by the directory listing and its export. */
import { ApplicationStatus, Prisma, SieLinkStatus } from "@prisma/client";

export function resolveInstitutionalCode(person: any): string | null {
  const sieRecord = person?.sieAssociateRecords?.find(
    (record: any) =>
      record.externalCode?.trim() &&
      (record.category?.mappedAffiliateType === "ACTIVE" || record.category?.mappedAffiliateType === "STUDENT"),
  );
  if (sieRecord) return sieRecord.externalCode.trim();
  const application = person?.applications?.[0];
  if (
    application?.status === "COMPLETED" &&
    application?.associateIntegration?.status === "SYNCED" &&
    application.associateIntegration.externalAssociateCode != null
  ) {
    return String(application.associateIntegration.externalAssociateCode);
  }
  return null;
}

export function buildV2Where(search?: string, membershipType?: string): Prisma.MembershipApplicationWhereInput {
  const baseWhere: Prisma.MembershipApplicationWhereInput = {
    status: ApplicationStatus.COMPLETED,
    deletedAt: null,
  };
  if (search) {
    baseWhere.OR = [
      { email: { contains: search, mode: "insensitive" } },
      { documentNumber: { contains: search } },
      { person: { firstName: { contains: search, mode: "insensitive" } } },
      { person: { paternalLastName: { contains: search, mode: "insensitive" } } },
      { person: { maternalLastName: { contains: search, mode: "insensitive" } } },
    ];
  }
  if (membershipType && membershipType !== "ALL") {
    baseWhere.affiliateType = membershipType === "ACTIVE" ? "ACTIVE" : "STUDENT";
  }
  return baseWhere;
}

export function buildHistoricalWhere(search?: string, membershipType?: string): Prisma.SieAssociateRecordWhereInput {
  const where: Prisma.SieAssociateRecordWhereInput = {
    provider: "SIE",
    linkStatus: SieLinkStatus.LINKED,
    category: { mappedAffiliateType: { not: null } },
    person: {
      deletedAt: null,
      applications: { none: { status: ApplicationStatus.COMPLETED, deletedAt: null } },
    },
  };
  if (search) {
    // La búsqueda debe poder coincidir con el código institucional O con
    // cualquier campo de la persona; nunca combinarse con AND.
    where.OR = [
      { externalCode: { contains: search } },
      { person: { documentNumber: { contains: search } } },
      { person: { firstName: { contains: search, mode: "insensitive" } } },
      { person: { paternalLastName: { contains: search, mode: "insensitive" } } },
      { person: { maternalLastName: { contains: search, mode: "insensitive" } } },
    ];
  }
  if (membershipType && membershipType !== "ALL") {
    where.category = { mappedAffiliateType: membershipType === "ACTIVE" ? "ACTIVE" : "STUDENT" };
  }
  return where;
}
