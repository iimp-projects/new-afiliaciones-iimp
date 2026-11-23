/* eslint-disable @typescript-eslint/no-explicit-any -- structural query helpers shared by the directory listing and its export. */
import { ApplicationStatus, Gender, Prisma, SieLinkStatus, UserStatus } from "@prisma/client";

export interface AssociateAdvancedFilters {
  gender?: Gender;
  countryId?: number;
  universityId?: number;
  companyId?: number;
  accountStatus?: UserStatus;
  dateFrom?: Date;
  dateTo?: Date;
  includeInactive?: boolean;
}

const VISIBLE_MEMBERSHIP_CODES = ["A", "E", "V", "H", "T"];
const ALL_MEMBERSHIP_CODES = ["A", "E", "V", "H", "T", "X", "R", "U", "F"];
const MEMBERSHIP_TYPE_TO_CODE: Record<string, string> = {
  ACTIVE: "A",
  STUDENT: "E",
  A: "A",
  E: "E",
  V: "V",
  H: "H",
  T: "T",
  X: "X",
  R: "R",
  U: "U",
  F: "F",
};

function dateRange(dateFrom?: Date, dateTo?: Date): Prisma.DateTimeFilter | undefined {
  if (!dateFrom && !dateTo) return undefined;
  return {
    ...(dateFrom ? { gte: dateFrom } : {}),
    ...(dateTo ? { lte: dateTo } : {}),
  };
}

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

export function buildV2Where(search?: string, membershipType?: string, advanced?: AssociateAdvancedFilters): Prisma.MembershipApplicationWhereInput {
  const baseWhere: Prisma.MembershipApplicationWhereInput = {
    status: ApplicationStatus.COMPLETED,
    deletedAt: null,
  };
  const personFilters: Prisma.PersonWhereInput = {};
  if (advanced?.gender) personFilters.gender = advanced.gender;
  if (advanced?.countryId) personFilters.addresses = { some: { countryId: advanced.countryId } };
  if (advanced?.universityId) personFilters.academicInfos = { some: { universityId: advanced.universityId } };
  if (advanced?.companyId) personFilters.employmentInfos = { some: { companyId: advanced.companyId } };
  if (advanced?.accountStatus) personFilters.user = { status: advanced.accountStatus };
  if (Object.keys(personFilters).length > 0) baseWhere.person = personFilters;
  const range = dateRange(advanced?.dateFrom, advanced?.dateTo);
  if (range) baseWhere.updatedAt = range;
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
    const code = MEMBERSHIP_TYPE_TO_CODE[membershipType];
    if (code === "A") baseWhere.affiliateType = "ACTIVE";
    else if (code === "E") baseWhere.affiliateType = "STUDENT";
    else baseWhere.id = { in: [] };
  }
  return baseWhere;
}

export function buildHistoricalWhere(search?: string, membershipType?: string, advanced?: AssociateAdvancedFilters): Prisma.SieAssociateRecordWhereInput {
  const personFilters: Prisma.PersonWhereInput = {
    deletedAt: null,
    applications: { none: { status: ApplicationStatus.COMPLETED, deletedAt: null } },
  };
  if (advanced?.gender) personFilters.gender = advanced.gender;
  if (advanced?.countryId) personFilters.addresses = { some: { countryId: advanced.countryId } };
  if (advanced?.universityId) personFilters.academicInfos = { some: { universityId: advanced.universityId } };
  if (advanced?.companyId) personFilters.employmentInfos = { some: { companyId: advanced.companyId } };
  if (advanced?.accountStatus) personFilters.user = { status: advanced.accountStatus };
  const where: Prisma.SieAssociateRecordWhereInput = {
    provider: "SIE",
    linkStatus: SieLinkStatus.LINKED,
    person: personFilters,
  };
  const range = dateRange(advanced?.dateFrom, advanced?.dateTo);
  if (range) where.updatedAt = range;
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
    const code = MEMBERSHIP_TYPE_TO_CODE[membershipType];
    if (code) where.category = { code };
  } else if (advanced?.includeInactive) {
    where.category = { code: { in: ALL_MEMBERSHIP_CODES } };
  } else {
    where.category = { code: { in: VISIBLE_MEMBERSHIP_CODES } };
  }
  return where;
}
