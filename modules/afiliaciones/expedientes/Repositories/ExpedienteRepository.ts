import { prisma } from "@/lib/prisma";
import { ApplicationStatus, Prisma } from "@prisma/client";
import type { ExpedienteDTO, PaginatedExpedientes } from "../Entities/ExpedienteDTO";

export class ExpedienteRepository {
    async getPaginated(params: { 
        page: number; 
        pageSize: number; 
        search?: string;
        status?: string;
    }): Promise<PaginatedExpedientes> {
        const { page, pageSize, search, status } = params;
        const skip = (page - 1) * pageSize;

        // Construimos el query dinámico
        const whereInput: Prisma.MembershipApplicationWhereInput = {
            // NUNCA traemos borradores a esta vista
            status: status ? (status as ApplicationStatus) : { not: ApplicationStatus.DRAFT },
        };

        if (search) {
            whereInput.OR = [
                { applicationCode: { contains: search, mode: 'insensitive' } },
                { documentNumber: { contains: search } },
                { email: { contains: search, mode: 'insensitive' } },
                { 
                    person: { 
                        OR: [
                            { firstName: { contains: search, mode: 'insensitive' } },
                            { paternalLastName: { contains: search, mode: 'insensitive' } }
                        ]
                    } 
                }
            ];
        }

        // Ejecutamos count y findMany en paralelo para máxima velocidad
        const [total, records] = await Promise.all([
            prisma.membershipApplication.count({ where: whereInput }),
            prisma.membershipApplication.findMany({
                where: whereInput,
                include: { person: true },
                orderBy: { submittedAt: 'desc' }, // Los más recientes primero
                skip,
                take: pageSize,
            })
        ]);

        const data: ExpedienteDTO[] = records.map((app) => ({
            id: app.id,
            applicationCode: app.applicationCode,
            documentType: app.documentType,
            documentNumber: app.documentNumber,
            fullName: app.person 
                ? `${app.person.firstName} ${app.person.paternalLastName} ${app.person.maternalLastName || ""}`.trim()
                : "Postulante Desconocido",
            email: app.email,
            phone: app.phone,
            affiliateType: app.affiliateType,
            status: app.status,
            currentStep: app.currentStep,
            submittedAt: app.submittedAt ? app.submittedAt.toISOString() : null,
        }));

        return {
            data,
            meta: {
                total,
                page,
                pageSize,
                totalPages: Math.ceil(total / pageSize),
            }
        };
    }
}