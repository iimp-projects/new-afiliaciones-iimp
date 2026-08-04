import { prisma } from "@/lib/prisma";
import { ApplicationStatus, Prisma } from "@prisma/client";

export class ExpedienteRepository {
  async getPaginated(params: {
    page: number;
    pageSize: number;
    search?: string;
    status?: string;
  }) {
    const { page, pageSize, search, status } = params;
    const skip = (page - 1) * pageSize;

    // Filtramos los que NO son borradores
    const whereInput: Prisma.MembershipApplicationWhereInput = {
      status: status ? (status as ApplicationStatus) : { not: ApplicationStatus.DRAFT },
    };

    if (search) {
      whereInput.OR = [
        { applicationCode: { contains: search, mode: "insensitive" } },
        { documentNumber: { contains: search } },
        { email: { contains: search, mode: "insensitive" } },
        {
          person: {
            OR: [
              { firstName: { contains: search, mode: "insensitive" } },
              { paternalLastName: { contains: search, mode: "insensitive" } },
            ],
          },
        },
      ];
    }

    const [total, records] = await Promise.all([
      prisma.membershipApplication.count({ where: whereInput }),
      // Traemos el expediente con TODO su ecosistema de datos
      prisma.membershipApplication.findMany({
        where: whereInput,
        include: {
          person: true,
          payments: { orderBy: { createdAt: "desc" }, take: 1 }, // Último pago
          approvals: true, // Avales
          observations: { where: { status: "PENDING" } }, // Problemas activos
          documents: {
            where: { category: "OTHER", fileName: { contains: "Foto" } },
            take: 1,
          }, // Para el Avatar
        },
        orderBy: { submittedAt: "desc" },
        skip,
        take: pageSize,
      }),
    ]);

    return { total, page, pageSize, totalPages: Math.ceil(total / pageSize), records };
  }
}