import { Prisma, PrismaClient } from "@prisma/client";
import { APPROVED_ACADEMIC_DEGREE_CODES, APPROVED_ACADEMIC_DEGREE_IDS } from "../academicDegreeCanonicals";

export type MasterDataEntity = "UNIVERSITY" | "SPECIALTY" | "DEGREE";
export type MasterDataListParams = { page: number; pageSize: number; search?: string; status: "ALL" | "ACTIVE" | "INACTIVE"; countryId?: number; categoryId?: number; studyLevel?: "BACHELOR"|"MASTER"|"DOCTORATE"|"TECHNICAL"|"OTHER"; canonicalOnly?: boolean; hasReferences?: "with" | "without"; sortBy: "name" | "references" | "id" | "createdAt"; sortOrder: "asc" | "desc" };
type Db = PrismaClient | Prisma.TransactionClient;

export class MasterDataRepository {
  constructor(private readonly db: Db = new PrismaClient()) {}

  async list(entity: MasterDataEntity, params: MasterDataListParams) {
    const isActive = params.status === "ALL" ? undefined : params.status === "ACTIVE";
    const skip = (params.page - 1) * params.pageSize;
    if (entity === "UNIVERSITY") {
      const where = { ...(isActive === undefined ? {} : { isActive }), ...(params.countryId ? { countryId: params.countryId } : {}), ...(params.hasReferences === "with" ? { academicInfos: { some: {} } } : params.hasReferences === "without" ? { academicInfos: { none: {} } } : {}), ...(params.search ? { OR: [{ name: { contains: params.search, mode: "insensitive" as const } }, { acronym: { contains: params.search, mode: "insensitive" as const } }, { code: { contains: params.search, mode: "insensitive" as const } }] } : {}) };
      const orderBy = params.sortBy === "id" ? { id: params.sortOrder } : params.sortBy === "createdAt" ? { createdAt: params.sortOrder } : params.sortBy === "references" ? { academicInfos: { _count: params.sortOrder } } : { name: params.sortOrder };
      const [data, total] = await Promise.all([this.db.university.findMany({ where, skip, take: params.pageSize, include: { country: { select: { id: true, name: true } }, _count: { select: { academicInfos: true } } }, orderBy }), this.db.university.count({ where })]);
      return { data, pagination: { page: params.page, pageSize: params.pageSize, total, totalPages: Math.ceil(total / params.pageSize) } };
    }
    if (entity === "DEGREE") {
      const degreeFilters: Prisma.AcademicDegreeWhereInput[] = [];
      if (params.canonicalOnly) degreeFilters.push({ OR: [{ id: { in: [...APPROVED_ACADEMIC_DEGREE_IDS] } }, { code: { in: [...APPROVED_ACADEMIC_DEGREE_CODES] } }] });
      if (params.search) degreeFilters.push({ OR: [{ name: { contains: params.search, mode: "insensitive" } }, { code: { contains: params.search, mode: "insensitive" } }, { abbreviation: { contains: params.search, mode: "insensitive" } }] });
      const where: Prisma.AcademicDegreeWhereInput = { ...(isActive === undefined ? {} : { isActive }), ...(params.studyLevel ? { studyLevel: params.studyLevel } : {}), ...(degreeFilters.length ? { AND: degreeFilters } : {}) };
      const orderBy = params.sortBy === "id" ? { id: params.sortOrder } : params.sortBy === "createdAt" ? { createdAt: params.sortOrder } : params.sortBy === "references" ? { academicInfos: { _count: params.sortOrder } } : { name: params.sortOrder };
      const [data, total] = await Promise.all([this.db.academicDegree.findMany({ where, skip, take: params.pageSize, include: { _count: { select: { academicInfos: true } } }, orderBy }), this.db.academicDegree.count({ where })]);
      return { data, pagination: { page: params.page, pageSize: params.pageSize, total, totalPages: Math.ceil(total / params.pageSize) } };
    }
    const where = { ...(isActive === undefined ? {} : { isActive }), ...(params.categoryId ? { specialtyCategoryId: params.categoryId } : {}), ...(params.hasReferences === "with" ? { academicInfos: { some: {} } } : params.hasReferences === "without" ? { academicInfos: { none: {} } } : {}), ...(params.search ? { OR: [{ name: { contains: params.search, mode: "insensitive" as const } }, { code: { contains: params.search, mode: "insensitive" as const } }] } : {}) };
    const orderBy = params.sortBy === "id" ? { id: params.sortOrder } : params.sortBy === "createdAt" ? { createdAt: params.sortOrder } : params.sortBy === "references" ? { academicInfos: { _count: params.sortOrder } } : { name: params.sortOrder };
    const [data, total] = await Promise.all([this.db.specialty.findMany({ where, skip, take: params.pageSize, include: { specialtyCategory: { select: { id: true, name: true } }, _count: { select: { academicInfos: true } } }, orderBy }), this.db.specialty.count({ where })]);
    return { data, pagination: { page: params.page, pageSize: params.pageSize, total, totalPages: Math.ceil(total / params.pageSize) } };
  }

  async listCategories() { return this.db.specialtyCategory.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }); }

  async getSelected(entity: MasterDataEntity, ids: number[]) {
    if (entity === "UNIVERSITY") return this.db.university.findMany({ where: { id: { in: ids } }, include: { country: { select: { id: true, name: true } }, _count: { select: { academicInfos: true } } } });
    if (entity === "DEGREE") return this.db.academicDegree.findMany({ where: { id: { in: ids } }, include: { _count: { select: { academicInfos: true } } } });
    return this.db.specialty.findMany({ where: { id: { in: ids } }, include: { specialtyCategory: { select: { id: true, name: true } }, _count: { select: { academicInfos: true } } } });
  }

  async withTransaction<T>(callback: (tx: Prisma.TransactionClient) => Promise<T>) { return (this.db as PrismaClient).$transaction(callback, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }); }
}
