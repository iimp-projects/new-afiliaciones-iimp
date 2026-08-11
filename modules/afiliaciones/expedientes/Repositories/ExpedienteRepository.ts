import { Prisma, ApplicationStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export interface ExpedienteFilters {
  page: number;
  pageSize: number;
  search?: string;
  status?: string;
  modality?: string;
  logisticValidation?: string;
  associateValidation?: string;
  assignedTo?: string;
  dateFrom?: string;
  dateTo?: string;
  orderBy?: string;
}

export class ExpedienteRepository {
  async getPaginated(filters: ExpedienteFilters) {
    const { page, pageSize, search, status, modality, dateFrom, dateTo, orderBy } = filters;
    const skip = (page - 1) * pageSize;

    const where: Prisma.MembershipApplicationWhereInput = {
      deletedAt: null,
      status: { not: ApplicationStatus.DRAFT },
    };

    if (search) {
      where.OR = [
        { applicationCode: { contains: search, mode: "insensitive" } },
        { documentNumber: { contains: search, mode: "insensitive" } },
        { person: { OR: [ { firstName: { contains: search, mode: "insensitive" } }, { paternalLastName: { contains: search, mode: "insensitive" } }, { maternalLastName: { contains: search, mode: "insensitive" } } ] } },
      ];
    }

    if (status && status !== "Todos") where.status = status as ApplicationStatus;
    if (modality && modality !== "Todos") where.affiliateType = modality === "Estudiante" ? "STUDENT" : "ACTIVE";

    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(`${dateFrom}T00:00:00.000Z`);
      if (dateTo) where.createdAt.lte = new Date(`${dateTo}T23:59:59.999Z`);
    }

    let orderByInput: Prisma.MembershipApplicationOrderByWithRelationInput = { createdAt: "desc" };
    if (orderBy === "Más antiguos") orderByInput = { createdAt: "asc" };

    const [total, items] = await Promise.all([
      prisma.membershipApplication.count({ where }),
      prisma.membershipApplication.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: orderByInput,
        include: {
          person: true,
          payments: { orderBy: { createdAt: "desc" }, take: 1 },
          approvals: { include: { sponsorPerson: true } },
          observations: { where: { status: 'PENDING' }, orderBy: { createdAt: "desc" } },
          documents: true, 
          areaValidations: { include: { validatedBy: { include: { person: true } } } },
          history: { orderBy: { createdAt: "desc" }, take: 5 },
          // 👇 AQUÍ ESTÁ LA NUEVA TABLA QUE FALTABA 👇
          validations: {
            include: {
              department: true,
              validatedBy: { include: { person: true } },
            },
            orderBy: {
              department: { displayOrder: 'asc' }
            }
          }
        },
      }),
    ]);

    return {
      data: items,
      meta: { total, page, pageSize, totalPages: Math.ceil(total / pageSize) },
    };
  }

  async getById(id: number) {
    return await prisma.membershipApplication.findUnique({
      where: { id },
      include: {
        person: { include: { academicInfos: { include: { university: true } }, employmentInfos: true } },
        payments: { orderBy: { createdAt: "desc" } },
        approvals: { include: { sponsorPerson: true } },
        observations: { orderBy: { createdAt: "desc" } },
        documents: true, 
        areaValidations: { include: { validatedBy: { include: { person: true } } } },
        history: { orderBy: { createdAt: "desc" } },
        // 👇 TAMBIÉN LA INCLUIMOS EN EL DETALLE 👇
        validations: {
          include: {
            department: true,
            validatedBy: { include: { person: true } },
          },
          orderBy: {
            department: { displayOrder: 'asc' }
          }
        }
      },
    });
  }
}