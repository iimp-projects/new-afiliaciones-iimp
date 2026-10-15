"use server";
/* eslint-disable @typescript-eslint/no-explicit-any -- legacy action contract is consumed by the shared drawer. */

import { prisma } from "@/lib/prisma";
import { contextService } from "@/modules/auth/context/service";
import { resolveAffiliatePhoto } from "@/modules/shared/Services/AffiliatePhotoResolver";
import { ApplicationStatus, Prisma, SieLinkStatus } from "@prisma/client";

interface FetchAsociadosParams {
  page?: number;
  pageSize?: number;
  search?: string;
  membershipType?: string;
  sort?: string;
}

export type AssociateSource = "POSTULACION" | "SIE_HISTORICAL";

function resolveInstitutionalCode(person: any): string | null {
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

function buildV2Where(search?: string, membershipType?: string): Prisma.MembershipApplicationWhereInput {
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

function buildHistoricalWhere(search?: string, membershipType?: string): Prisma.SieAssociateRecordWhereInput {
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

function roleForHistorical(affiliateType: string | null | undefined) {
  return affiliateType === "STUDENT"
    ? { slug: "ASOCIADO_ESTUDIANTE", name: "Asociado Estudiante" }
    : { slug: "ASOCIADO_ACTIVO", name: "Asociado Activo" };
}

export async function fetchAsociadosAction(params: FetchAsociadosParams) {
  try {
    await contextService.requirePermission("read", "associates");

    const { page = 1, pageSize = 12, search, membershipType, sort = "desc" } = params;
    const skip = (page - 1) * pageSize;
    const orderByConfig = sort === "desc" ? ({ updatedAt: "desc" } as const) : ({ updatedAt: "asc" } as const);

    const v2Where = buildV2Where(search, membershipType);
    const histWhere = buildHistoricalWhere(search, membershipType);

    const [v2Total, histTotal] = await Promise.all([
      prisma.membershipApplication.count({ where: v2Where }),
      prisma.sieAssociateRecord.count({ where: histWhere }),
    ]);

    const [v2Light, histLight] = await Promise.all([
      prisma.membershipApplication.findMany({ where: v2Where, select: { id: true, updatedAt: true }, orderBy: orderByConfig }),
      prisma.sieAssociateRecord.findMany({ where: histWhere, select: { id: true, updatedAt: true }, orderBy: orderByConfig }),
    ]);

    const merged = [
      ...v2Light.map((item) => ({ source: "POSTULACION" as const, id: item.id, updatedAt: item.updatedAt })),
      ...histLight.map((item) => ({ source: "SIE_HISTORICAL" as const, id: item.id, updatedAt: item.updatedAt })),
    ].sort((left, right) =>
      sort === "desc" ? right.updatedAt.getTime() - left.updatedAt.getTime() : left.updatedAt.getTime() - right.updatedAt.getTime()
    );

    const pageEntries = merged.slice(skip, skip + pageSize);
    const v2Ids = pageEntries.filter((entry) => entry.source === "POSTULACION").map((entry) => entry.id);
    const histIds = pageEntries.filter((entry) => entry.source === "SIE_HISTORICAL").map((entry) => entry.id);

    const [v2Rows, histRows] = await Promise.all([
      v2Ids.length
        ? prisma.membershipApplication.findMany({
            where: { id: { in: v2Ids } },
            include: {
              payments: { orderBy: { createdAt: "desc" }, include: { billing: { include: { country: true, invoice: true } } } },
              associateIntegration: true,
              person: {
                include: {
                  nationality: true,
                  addresses: { include: { district: { include: { province: { include: { department: true } } } } } },
                  contacts: { orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }] },
                  academicInfos: { include: { specialty: true, university: true, degree: true } },
                  employmentInfos: { orderBy: { updatedAt: "desc" }, include: { company: true, position: true } },
                  professionalExperiences: { orderBy: [{ isCurrent: "desc" }, { updatedAt: "desc" }], include: { company: true, position: true } },
                  sieAssociateRecords: { where: { linkStatus: "LINKED" }, include: { category: true } },
                  applications: {
                    where: { deletedAt: null },
                    orderBy: { updatedAt: "desc" },
                    include: {
                      history: { orderBy: { createdAt: "desc" } },
                      documents: { orderBy: { updatedAt: "desc" } },
                      payments: { orderBy: { createdAt: "desc" }, include: { billing: { include: { country: true, invoice: true } } } },
                    },
                  },
                  user: { include: { role: true } },
                },
              },
            },
          })
        : [],
      histIds.length
        ? prisma.sieAssociateRecord.findMany({
            where: { id: { in: histIds } },
            include: {
              person: {
                include: {
                  nationality: true,
                  addresses: { include: { district: { include: { province: { include: { department: true } } } } } },
                  contacts: { orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }] },
                  academicInfos: { include: { specialty: true, university: true, degree: true } },
                  employmentInfos: { orderBy: { updatedAt: "desc" }, include: { company: true, position: true } },
                  professionalExperiences: { orderBy: [{ isCurrent: "desc" }, { updatedAt: "desc" }], include: { company: true, position: true } },
                  user: { include: { role: true } },
                },
              },
              category: true,
            },
          })
        : [],
    ]);

    const v2Mapped = await Promise.all(
      v2Rows.map(async (application) => {
        const { person, ...applicationData } = application;
        const safeApplicationData = {
          ...applicationData,
          payments: applicationData.payments.map((payment) => {
            const { gatewayPayload, ...safePayment } = payment;
            void gatewayPayload;
            return { ...safePayment, totalAmount: Number(payment.totalAmount) };
          }),
        };
        return {
          id: application.id,
          source: "POSTULACION" as const,
          status: person?.user?.status ?? "ACTIVE",
          email: person?.user?.email ?? application.email,
          image: person?.user?.image ?? null,
          role: person?.user?.role ?? { slug: application.affiliateType === "STUDENT" ? "ASOCIADO_ESTUDIANTE" : "ASOCIADO_ACTIVO", name: application.affiliateType === "STUDENT" ? "Asociado Estudiante" : "Asociado Activo" },
          createdAt: person?.user?.createdAt ?? application.createdAt,
          updatedAt: application.updatedAt,
          lastLoginAt: person?.user?.lastLoginAt ?? null,
          systemUser: null,
          person: person ? { ...person, applications: [safeApplicationData] } : null,
          institutionalCode: person ? resolveInstitutionalCode(person) : null,
          affiliateAvatarUrl: await resolveAffiliatePhoto(person?.applications ?? []),
          sieCode: null,
          sieSourceType: null,
          sieSourceDescription: null,
        };
      })
    );

    const histMapped = histRows
      .filter((record) => record.person !== null)
      .map((record) => {
        const person = record.person!;
        const affiliateType = record.category?.mappedAffiliateType ?? null;
        return {
          id: person.id,
          source: "SIE_HISTORICAL" as const,
          status: "COMPLETED",
          email: person.user?.email ?? null,
          image: person.user?.image ?? null,
          role: person.user?.role ?? roleForHistorical(affiliateType),
          createdAt: person.createdAt,
          updatedAt: record.updatedAt,
          lastLoginAt: person.user?.lastLoginAt ?? null,
          systemUser: null,
          person: { ...person, applications: [] },
          institutionalCode: record.externalCode,
          affiliateAvatarUrl: null,
          sieCode: record.externalCode,
          sieSourceType: record.sourceType,
          sieSourceDescription: record.sourceDescription,
        };
      });

    const data = [...v2Mapped, ...histMapped].sort((left, right) =>
      sort === "desc"
        ? new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()
        : new Date(left.updatedAt).getTime() - new Date(right.updatedAt).getTime()
    );

    return { success: true, data, total: v2Total + histTotal, page, pageSize };
  } catch (error: any) {
    console.error("[Fetch Asociados Error]:", error);
    return { success: false, message: "Error al obtener la lista de asociados.", data: [], total: 0 };
  }
}
