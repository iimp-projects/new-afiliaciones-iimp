import {
  Prisma,
  ApplicationStatus,
  ValidationStatus,
  PaymentStatus,
} from "@prisma/client";

import { prisma } from "@/lib/prisma";

import {
  getCountryCode,
} from "countries-list";

export interface ExpedienteFilters {
  page: number;
  pageSize: number;
  search?: string;
  status?: string;
  modality?: string;
  logisticValidation?: string;
  associateValidation?: string;
  comiteValidation?: string;
  legalValidation?: string;
  comunicacionesValidation?: string;
  paymentStatus?: string;
  assignedTo?: string;
  dateFrom?: string;
  dateTo?: string;
  orderBy?: string;
}

export class ExpedienteRepository {

  // ============================================================
  // RESOLVER CÓDIGO ISO DEL PAÍS
  //
  // Ejemplos:
  //
  // Perú       -> PE
  // Colombia   -> CO
  // Argentina  -> AR
  // Chile      -> CL
  // Canadá     -> CA
  //
  // No hacemos IF por país.
  // ============================================================

  private resolveCountryCode(
    countryName: string
  ): string | null {

    if (
      !countryName ||
      countryName === "No registrado"
    ) {
      return null;
    }

    try {

      const normalizedName =
        countryName
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .trim();

      // ==========================================================
      // Primero intentamos con el nombre original.
      // ==========================================================

      let code =
        getCountryCode(countryName);

      // ==========================================================
      // Si no encuentra el nombre con tilde,
      // intentamos con el nombre normalizado.
      // ==========================================================

      if (!code) {
        code =
          getCountryCode(normalizedName);
      }

      // ==========================================================
      // Retornamos siempre en mayúsculas.
      // ==========================================================

      return code
        ? code.toUpperCase()
        : null;

    } catch (error) {

      console.error(
        `[COUNTRY] Error resolviendo "${countryName}":`,
        error
      );

      return null;
    }
  }

  // ============================================================
  // PAGINACIÓN
  // ============================================================

  async getPaginated(
    filters: ExpedienteFilters
  ) {

    const {
      page,
      pageSize,
      search,
      status,
      modality,
      dateFrom,
      dateTo,
      orderBy,
      logisticValidation,
      associateValidation,
      comiteValidation,
      legalValidation,
      comunicacionesValidation,
      paymentStatus,
    } = filters;

    const skip =
      (page - 1) * pageSize;

    const where: Prisma.MembershipApplicationWhereInput = {
      deletedAt: null,

      status: {
        not: ApplicationStatus.DRAFT,
      },
    };

    // ============================================================
    // BÚSQUEDA
    // ============================================================

    if (search) {

      where.OR = [

        {
          applicationCode: {
            contains: search,
            mode: "insensitive",
          },
        },

        {
          documentNumber: {
            contains: search,
            mode: "insensitive",
          },
        },

        {
          person: {
            OR: [

              {
                firstName: {
                  contains: search,
                  mode: "insensitive",
                },
              },

              {
                paternalLastName: {
                  contains: search,
                  mode: "insensitive",
                },
              },

              {
                maternalLastName: {
                  contains: search,
                  mode: "insensitive",
                },
              },

            ],
          },
        },

      ];
    }

    // ============================================================
    // ESTADO
    // ============================================================

    if (
      status &&
      status !== "Todos"
    ) {

      where.status =
        status as ApplicationStatus;
    }

    // ============================================================
    // MODALIDAD
    // ============================================================

    if (
      modality &&
      modality !== "Todos"
    ) {

      where.affiliateType =
        modality === "Estudiante"
          ? "STUDENT"
          : "ACTIVE";
    }

    // ============================================================
    // FECHAS
    // ============================================================

    if (
      dateFrom ||
      dateTo
    ) {

      where.createdAt = {};

      if (dateFrom) {

        where.createdAt.gte =
          new Date(
            `${dateFrom}T00:00:00.000Z`
          );
      }

      if (dateTo) {

        where.createdAt.lte =
          new Date(
            `${dateTo}T23:59:59.999Z`
          );
      }
    }

    // ============================================================
    // PAGOS
    // ============================================================

    if (
      paymentStatus &&
      paymentStatus !== "Todos"
    ) {

      where.payments = {
        some: {
          status:
            paymentStatus as PaymentStatus,
        },
      };
    }

    // ============================================================
    // VALIDACIONES POR ÁREA
    // ============================================================

    const areaConditions:
      Prisma.MembershipApplicationWhereInput[] =
      [];

    if (
      logisticValidation &&
      logisticValidation !== "Todos"
    ) {

      areaConditions.push({

        validations: {
          some: {

            department: {
              code: "LOGISTICA",
            },

            status:
              logisticValidation as ValidationStatus,

          },
        },

      });
    }

    if (
      associateValidation &&
      associateValidation !== "Todos"
    ) {

      areaConditions.push({

        validations: {
          some: {

            department: {
              code: "ASOCIADOS",
            },

            status:
              associateValidation as ValidationStatus,

          },
        },

      });
    }

    if (
      comiteValidation &&
      comiteValidation !== "Todos"
    ) {

      areaConditions.push({

        validations: {
          some: {

            department: {
              code: "COMITE",
            },

            status:
              comiteValidation as ValidationStatus,

          },
        },

      });
    }

    if (
      legalValidation &&
      legalValidation !== "Todos"
    ) {

      areaConditions.push({

        validations: {
          some: {

            department: {
              code: "LEGAL",
            },

            status:
              legalValidation as ValidationStatus,

          },
        },

      });
    }

    if (
      comunicacionesValidation &&
      comunicacionesValidation !== "Todos"
    ) {

      areaConditions.push({

        validations: {
          some: {

            department: {
              code: "COMUNICACIONES",
            },

            status:
              comunicacionesValidation as ValidationStatus,

          },
        },

      });
    }

    // ============================================================
    // TODOS LOS FILTROS DE ÁREA
    // ============================================================

    if (
      areaConditions.length > 0
    ) {

      where.AND =
        areaConditions;
    }

    // ============================================================
    // ORDEN
    // ============================================================

    let orderByInput:
      Prisma.MembershipApplicationOrderByWithRelationInput =
      {
        createdAt: "desc",
      };

    if (
      orderBy === "Más antiguos"
    ) {

      orderByInput = {
        createdAt: "asc",
      };
    }

    // ============================================================
    // CONSULTA
    // ============================================================

    const [
      total,
      items,
    ] = await Promise.all([

      prisma.membershipApplication.count({
        where,
      }),

      prisma.membershipApplication.findMany({

        where,

        skip,

        take: pageSize,

        orderBy:
          orderByInput,

        include: {

          person: true,

          payments: {
            orderBy: {
              createdAt: "desc",
            },

            take: 1,
          },

          approvals: {
            include: {
              sponsorPerson: true,
            },
          },

          observations: {

            where: {
              status: "PENDING",
            },

            orderBy: {
              createdAt: "desc",
            },

          },

          documents: true,

          areaValidations: {

            include: {

              validatedBy: {
                include: {
                  person: true,
                },
              },

            },

          },

          history: {

            orderBy: {
              createdAt: "desc",
            },

            take: 5,

          },

          validations: {

            include: {

              department: true,

              validatedBy: {
                include: {
                  person: true,
                },
              },

            },

            orderBy: {

              department: {
                displayOrder: "asc",
              },

            },

          },

        },

      }),

    ]);

    return {

      data: items,

      meta: {

        total,

        page,

        pageSize,

        totalPages:
          Math.ceil(
            total / pageSize
          ),

      },

    };
  }

  // ============================================================
  // OBTENER EXPEDIENTE POR ID
  // ============================================================

  async getById(
    id: number
  ) {

    const expediente =
      await prisma.membershipApplication.findUnique({

        where: {
          id,
        },

        include: {

          person: {

            include: {

              academicInfos: {
                include: {
                  university: true,
                },
              },

              employmentInfos: true,

            },

          },

          payments: {

            orderBy: {
              createdAt: "desc",
            },

          },

          approvals: {

            include: {
              sponsorPerson: true,
            },

          },

          observations: {

            orderBy: {
              createdAt: "desc",
            },

          },

          documents: true,

          areaValidations: {

            include: {

              validatedBy: {

                include: {
                  person: true,
                },

              },

            },

          },

          history: {

            orderBy: {
              createdAt: "desc",
            },

          },

          validations: {

            include: {

              department: true,

              validatedBy: {

                include: {
                  person: true,
                },

              },

            },

            orderBy: {

              department: {
                displayOrder: "asc",
              },

            },

          },

        },

      });

    if (!expediente) {
      return null;
    }

    // ============================================================
    // RESOLUCIÓN DE DATOS GEOGRÁFICOS
    // ============================================================

    if (
      expediente.draftData
    ) {

      const draft =
        expediente.draftData as any;

      const personal =
        draft.personalInformation;

      if (personal) {

        // ========================================================
        // PAÍS
        // ========================================================

        if (
          personal.countryId
        ) {

          const country =
            await prisma.country.findUnique({

              where: {
                id: Number(
                  personal.countryId
                ),
              },

            });

          const countryName =
            country?.name ||
            "No registrado";

          // ------------------------------------------------------
          // NOMBRE
          // ------------------------------------------------------

          personal.resolvedCountry =
            countryName;

          // ------------------------------------------------------
          // CÓDIGO ISO
          // ------------------------------------------------------

          const countryCode =
            this.resolveCountryCode(
              countryName
            );

          personal.resolvedCountryCode =
            countryCode;

          console.log(
            "[EXPEDIENTE - PAÍS]",
            {
              countryId:
                personal.countryId,

              countryName,

              countryCode,
            }
          );

        } else {

          personal.resolvedCountry =
            "No registrado";

          personal.resolvedCountryCode =
            null;
        }

        // ========================================================
        // DEPARTAMENTO
        // ========================================================

        if (
          personal.departmentId
        ) {

          const dept =
            await prisma.department.findUnique({

              where: {
                id: Number(
                  personal.departmentId
                ),
              },

            });

          personal.resolvedDepartment =
            dept?.name ||
            null;
        }

        // ========================================================
        // PROVINCIA
        // ========================================================

        if (
          personal.provinceId
        ) {

          const prov =
            await prisma.province.findUnique({

              where: {
                id: Number(
                  personal.provinceId
                ),
              },

            });

          personal.resolvedProvince =
            prov?.name ||
            null;
        }

        // ========================================================
        // DISTRITO
        // ========================================================

        if (
          personal.districtId
        ) {

          const dist =
            await prisma.district.findUnique({

              where: {
                id: Number(
                  personal.districtId
                ),
              },

            });

          personal.resolvedDistrict =
            dist?.name ||
            null;
        }
      }

      // ==========================================================
      // GUARDAMOS DATA RESUELTA
      // ==========================================================

      expediente.draftData =
        draft;
    }

    return expediente;
  }
}