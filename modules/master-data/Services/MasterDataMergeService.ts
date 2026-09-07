import { PrismaClient } from "@prisma/client";
import { MasterDataRepository, type MasterDataEntity, type MasterDataListParams } from "../Repositories/MasterDataRepository";

export class MasterDataMergeError extends Error { constructor(message: string, public readonly status = 400) { super(message); } }
const MAX_SELECTION = 20;

export function validateMergeSelection(selectedIds: number[], canonicalId: number): string | null {
  const ids = [...new Set(selectedIds)];
  if (ids.length < 2) return "Selecciona al menos 2 registros.";
  if (ids.length > MAX_SELECTION) return `No puedes fusionar más de ${MAX_SELECTION} registros.`;
  if (!ids.includes(canonicalId)) return "El registro canónico debe pertenecer a la selección.";
  return null;
}

export class MasterDataMergeService {
  private readonly prisma = new PrismaClient();
  private readonly repository = new MasterDataRepository(this.prisma);

  async list(entity: MasterDataEntity, params: MasterDataListParams) { return this.repository.list(entity, params); }
  async listCategories() { return this.repository.listCategories(); }

  async create(entity: MasterDataEntity, data: { name: string; code?: string | null; abbreviation?: string | null; studyLevel?: "BACHELOR"|"MASTER"|"DOCTORATE"|"TECHNICAL"|"OTHER"; description?: string | null; acronym?: string | null; website?: string | null; logoUrl?: string | null; websiteUrl?: string | null; facebookUrl?: string | null; instagramUrl?: string | null; linkedinUrl?: string | null; youtubeUrl?: string | null; isLicensed?: boolean; isPublic?: boolean; isActive?: boolean; countryId?: number; specialtyCategoryId?: number | null; userId: number }) {
    const name = data.name.trim();
    if (!name) throw new MasterDataMergeError("El nombre es obligatorio.");
    if (entity === "UNIVERSITY" && (!Number.isInteger(data.countryId) || (data.countryId ?? 0) <= 0)) throw new MasterDataMergeError("El país es obligatorio.");
    return this.repository.withTransaction(async (tx) => {
      const duplicate = entity === "UNIVERSITY"
        ? await tx.university.findFirst({ where: { countryId: data.countryId, name: { equals: name, mode: "insensitive" } } })
        : entity === "DEGREE"
          ? await tx.academicDegree.findFirst({ where: { name: { equals: name, mode: "insensitive" } } })
          : await tx.specialty.findFirst({ where: { name: { equals: name, mode: "insensitive" } } });
      if (duplicate) throw new MasterDataMergeError("Ya existe un registro con un nombre similar.", 409);
      const created = entity === "UNIVERSITY"
        ? await tx.university.create({ data: { name, code: data.code?.trim() || null, acronym: data.acronym?.trim() || null, website: data.website?.trim() || null, logoUrl: data.logoUrl?.trim() || null, websiteUrl: data.websiteUrl?.trim() || null, facebookUrl: data.facebookUrl?.trim() || null, instagramUrl: data.instagramUrl?.trim() || null, linkedinUrl: data.linkedinUrl?.trim() || null, youtubeUrl: data.youtubeUrl?.trim() || null, isLicensed: data.isLicensed ?? true, isPublic: data.isPublic ?? false, isActive: data.isActive ?? true, countryId: data.countryId as number } })
        : entity === "DEGREE" ? await tx.academicDegree.create({ data: { name, code: data.code?.trim() || null, abbreviation: data.abbreviation?.trim() || null, studyLevel: data.studyLevel ?? "OTHER", description: data.description?.trim() || null, isActive: data.isActive ?? true } })
        : await tx.specialty.create({ data: { name, code: data.code?.trim() || null, description: data.description?.trim() || null, specialtyCategoryId: data.specialtyCategoryId ?? null, isActive: data.isActive ?? true } });
      await tx.auditLog.create({ data: { userId: data.userId, action: "MASTER_DATA_CREATE", entity, entityId: String(created.id), oldValues: {}, newValues: created as object } });
      return created;
    });
  }

  async update(entity: MasterDataEntity, id: number, data: { name?: string; code?: string | null; abbreviation?: string | null; studyLevel?: "BACHELOR"|"MASTER"|"DOCTORATE"|"TECHNICAL"|"OTHER"; description?: string | null; acronym?: string | null; website?: string | null; logoUrl?: string | null; websiteUrl?: string | null; facebookUrl?: string | null; instagramUrl?: string | null; linkedinUrl?: string | null; youtubeUrl?: string | null; isLicensed?: boolean; isPublic?: boolean; countryId?: number; specialtyCategoryId?: number | null; isActive?: boolean; userId: number }) {
    if (!Number.isInteger(id) || id <= 0) throw new MasterDataMergeError("Identificador inválido.");
    const changes = entity === "UNIVERSITY"
      ? { ...(data.name === undefined ? {} : { name: data.name.trim() }), ...(data.code === undefined ? {} : { code: data.code?.trim() || null }), ...(data.acronym === undefined ? {} : { acronym: data.acronym?.trim() || null }), ...(data.website === undefined ? {} : { website: data.website?.trim() || null }), ...(data.logoUrl === undefined ? {} : { logoUrl: data.logoUrl?.trim() || null }), ...(data.websiteUrl === undefined ? {} : { websiteUrl: data.websiteUrl?.trim() || null }), ...(data.facebookUrl === undefined ? {} : { facebookUrl: data.facebookUrl?.trim() || null }), ...(data.instagramUrl === undefined ? {} : { instagramUrl: data.instagramUrl?.trim() || null }), ...(data.linkedinUrl === undefined ? {} : { linkedinUrl: data.linkedinUrl?.trim() || null }), ...(data.youtubeUrl === undefined ? {} : { youtubeUrl: data.youtubeUrl?.trim() || null }), ...(data.isLicensed === undefined ? {} : { isLicensed: data.isLicensed }), ...(data.isPublic === undefined ? {} : { isPublic: data.isPublic }), ...(data.countryId === undefined ? {} : { countryId: data.countryId }), ...(data.isActive === undefined ? {} : { isActive: data.isActive }) }
      : entity === "DEGREE" ? { ...(data.name === undefined ? {} : { name: data.name.trim() }), ...(data.code === undefined ? {} : { code: data.code?.trim() || null }), ...(data.abbreviation === undefined ? {} : { abbreviation: data.abbreviation?.trim() || null }), ...(data.studyLevel === undefined ? {} : { studyLevel: data.studyLevel }), ...(data.description === undefined ? {} : { description: data.description?.trim() || null }), ...(data.isActive === undefined ? {} : { isActive: data.isActive }) } : { ...(data.name === undefined ? {} : { name: data.name.trim() }), ...(data.code === undefined ? {} : { code: data.code?.trim() || null }), ...(data.description === undefined ? {} : { description: data.description?.trim() || null }), ...(data.specialtyCategoryId === undefined ? {} : { specialtyCategoryId: data.specialtyCategoryId }), ...(data.isActive === undefined ? {} : { isActive: data.isActive }) };
    if ("name" in changes && !changes.name) throw new MasterDataMergeError("El nombre es obligatorio.");
    return this.repository.withTransaction(async (tx) => {
      const previous = entity === "UNIVERSITY" ? await tx.university.findUnique({ where: { id } }) : entity === "DEGREE" ? await tx.academicDegree.findUnique({ where: { id } }) : await tx.specialty.findUnique({ where: { id } });
      if (!previous) throw new MasterDataMergeError("Registro no encontrado.", 404);
      const updated = entity === "UNIVERSITY" ? await tx.university.update({ where: { id }, data: changes }) : entity === "DEGREE" ? await tx.academicDegree.update({ where: { id }, data: changes }) : await tx.specialty.update({ where: { id }, data: changes });
      await tx.auditLog.create({ data: { userId: data.userId, action: data.isActive === false ? "MASTER_DATA_DEACTIVATE" : data.isActive === true ? "MASTER_DATA_REACTIVATE" : "MASTER_DATA_UPDATE", entity, entityId: String(id), oldValues: previous as object, newValues: updated as object } });
      return updated;
    });
  }

  async references(entity: MasterDataEntity, id: number, page = 1, pageSize = 20, search = "") {
    if (entity === "DEGREE") {
      const data = await this.prisma.academicInfo.findMany({ where: { degreeId: id }, skip: (page - 1) * pageSize, take: pageSize, select: { id: true, personId: true, degreeTitle: true, person: { select: { firstName: true, paternalLastName: true, maternalLastName: true } } }, orderBy: { id: "asc" } });
      const total = await this.prisma.academicInfo.count({ where: { degreeId: id } });
      return { data, pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } };
    }
    const where = entity === "UNIVERSITY" ? { universityId: id } : { specialtyId: id };
    const personFilter = search ? { person: { OR: [{ firstName: { contains: search, mode: "insensitive" as const } }, { paternalLastName: { contains: search, mode: "insensitive" as const } }, { documentNumber: { contains: search, mode: "insensitive" as const } }] } } : {};
    const filteredWhere = { ...where, ...personFilter };
    const [data, total] = await Promise.all([
      this.prisma.academicInfo.findMany({ where: filteredWhere, skip: (page - 1) * pageSize, take: pageSize, select: { id: true, personId: true, degreeTitle: true, graduationYear: true, studyLevel: true, createdAt: true, person: { select: { firstName: true, paternalLastName: true, maternalLastName: true, documentType: true, documentNumber: true, applications: { select: { id: true, applicationCode: true, affiliateType: true, status: true }, orderBy: { createdAt: "desc" }, take: 1 } } }, university: { select: { id: true, name: true } }, specialty: { select: { id: true, name: true } } }, orderBy: { id: "asc" } }),
      this.prisma.academicInfo.count({ where: filteredWhere }),
    ]);
    return { data, pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } };
  }

  async bulkDeactivate(input: { entity: MasterDataEntity; selectedIds: number[]; userId: number }) {
    const ids = [...new Set(input.selectedIds)].filter((id) => Number.isInteger(id) && id > 0);
    if (!ids.length) throw new MasterDataMergeError("Selecciona al menos un registro.");
    if (ids.length > 50) throw new MasterDataMergeError("Puedes desactivar como máximo 50 registros por operación.");
    return this.repository.withTransaction(async (tx) => {
      const rows = input.entity === "UNIVERSITY"
        ? await tx.university.findMany({ where: { id: { in: ids } }, select: { id: true, isActive: true, _count: { select: { academicInfos: true } } } })
        : input.entity === "DEGREE"
          ? await tx.academicDegree.findMany({ where: { id: { in: ids } }, select: { id: true, isActive: true, _count: { select: { academicInfos: true } } } })
          : await tx.specialty.findMany({ where: { id: { in: ids } }, select: { id: true, isActive: true, _count: { select: { academicInfos: true } } } });
      if (rows.length !== ids.length) throw new MasterDataMergeError("Uno o más registros no existen.", 404);
      const active = rows.filter((row) => row.isActive);
      const inactive = rows.filter((row) => !row.isActive);
      const references = rows.reduce((sum, row) => sum + row._count.academicInfos, 0);
      if (!active.length) throw new MasterDataMergeError("Todos los registros seleccionados ya están inactivos.");
      const result = input.entity === "UNIVERSITY"
        ? await tx.university.updateMany({ where: { id: { in: active.map((row) => row.id) }, isActive: true }, data: { isActive: false } })
        : input.entity === "DEGREE"
          ? await tx.academicDegree.updateMany({ where: { id: { in: active.map((row) => row.id) }, isActive: true }, data: { isActive: false } })
          : await tx.specialty.updateMany({ where: { id: { in: active.map((row) => row.id) }, isActive: true }, data: { isActive: false } });
      if (result.count !== active.length) throw new MasterDataMergeError("Los registros cambiaron durante la operación; no se aplicaron cambios.", 409);
      await tx.auditLog.create({ data: { userId: input.userId, action: "MASTER_DATA_BULK_DEACTIVATE", entity: input.entity, entityId: "BULK", oldValues: { selectedIds: ids, activeCount: active.length, inactiveCount: inactive.length, references }, newValues: { deactivatedIds: active.map((row) => row.id), deactivatedCount: result.count } } });
      return { selectedCount: ids.length, deactivatedCount: result.count, inactiveCount: inactive.length, references };
    });
  }

  async preview(input: { entity: MasterDataEntity; selectedIds: number[]; canonicalId: number }) {
    const ids = [...new Set(input.selectedIds)];
    const selectionError = validateMergeSelection(ids, input.canonicalId);
    if (selectionError) throw new MasterDataMergeError(selectionError);
    const rows = await this.repository.getSelected(input.entity, ids);
    if (rows.length !== ids.length) throw new MasterDataMergeError("Uno o más registros no existen.");
    const inactive = rows.filter((row) => !row.isActive);
    if (inactive.length) throw new MasterDataMergeError("Todos los registros seleccionados deben estar activos.");
    const warnings: string[] = [];
    const blocks: string[] = [];
    if (input.entity === "UNIVERSITY") {
      const countries = new Set((rows as Array<{ countryId: number }>).map((row) => row.countryId));
      if (countries.size > 1) blocks.push("Los registros pertenecen a países distintos.");
    } else {
      const categories = new Set((rows as Array<{ specialtyCategoryId: number | null }>).map((row) => row.specialtyCategoryId).filter((id): id is number => id !== null));
      if (categories.size > 1) blocks.push("Los registros pertenecen a categorías distintas.");
    }
    const references = rows.reduce((sum, row) => sum + row._count.academicInfos, 0);
    return { entity: input.entity, selectedIds: ids, canonicalId: input.canonicalId, records: rows, references, duplicateCount: ids.length - 1, warnings, blocks, canExecute: blocks.length === 0 };
  }

  async merge(input: { entity: MasterDataEntity; selectedIds: number[]; canonicalId: number; confirmation: boolean; userId: number }) {
    if (!input.confirmation) throw new MasterDataMergeError("Debes confirmar que representan la misma entidad.");
    const preview = await this.preview(input);
    if (!preview.canExecute) throw new MasterDataMergeError(preview.blocks.join(" "), 409);
    const duplicateIds = input.selectedIds.filter((id) => id !== input.canonicalId);
    return this.repository.withTransaction(async (tx) => {
      const fresh = input.entity === "UNIVERSITY"
        ? await tx.university.findMany({ where: { id: { in: input.selectedIds } }, include: { country: { select: { id: true, name: true } }, _count: { select: { academicInfos: true } } } })
        : await tx.specialty.findMany({ where: { id: { in: input.selectedIds } }, include: { specialtyCategory: { select: { id: true, name: true } }, _count: { select: { academicInfos: true } } } });
      if (fresh.length !== input.selectedIds.length || fresh.some((row) => !row.isActive)) throw new MasterDataMergeError("Los registros cambiaron; vuelve a generar el preview.", 409);
      const before = fresh.map((row) => ({ id: row.id, name: row.name, references: row._count.academicInfos }));
      let moved = 0;
      if (input.entity === "UNIVERSITY") {
        moved = (await Promise.all(duplicateIds.map((id) => tx.academicInfo.updateMany({ where: { universityId: id }, data: { universityId: input.canonicalId } })))).reduce((sum, result) => sum + result.count, 0);
        await tx.university.updateMany({ where: { id: { in: duplicateIds }, isActive: true }, data: { isActive: false } });
        if (await tx.academicInfo.count({ where: { universityId: { in: duplicateIds } } }) !== 0) throw new MasterDataMergeError("No se pudieron mover todas las referencias.", 409);
      } else {
        moved = (await Promise.all(duplicateIds.map((id) => tx.academicInfo.updateMany({ where: { specialtyId: id }, data: { specialtyId: input.canonicalId } })))).reduce((sum, result) => sum + result.count, 0);
        await tx.specialty.updateMany({ where: { id: { in: duplicateIds }, isActive: true }, data: { isActive: false } });
        if (await tx.academicInfo.count({ where: { specialtyId: { in: duplicateIds } } }) !== 0) throw new MasterDataMergeError("No se pudieron mover todas las referencias.", 409);
      }
      await tx.auditLog.create({ data: { userId: input.userId, action: "MASTER_DATA_MERGE", entity: input.entity, entityId: String(input.canonicalId), oldValues: { selectedIds: input.selectedIds, duplicateIds, records: before }, newValues: { canonicalId: input.canonicalId, moved, deactivatedIds: duplicateIds, aliasesCandidate: before.filter((row) => row.id !== input.canonicalId).map((row) => row.name) } } });
      return { canonicalId: input.canonicalId, deactivatedIds: duplicateIds, referencesMoved: moved };
    });
  }
}
