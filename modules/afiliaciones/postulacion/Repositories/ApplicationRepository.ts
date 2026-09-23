import { ApplicationStatus, Prisma, ValidationStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { Application } from "../Entities/Application";
import { IApplicationRepository } from "./Interfaces/IApplicationRepository";
import { UpdateDraftDTO } from "../DTOs/update-draft.dto";
import { ApplicationDraft } from "../Models/ApplicationDraft";
import { blocksNewApplication, canEditApplication, canSubmitApplication, currentApplicationStates } from "../Models/ApplicationAction";
import { ApplicationFlowError } from "../Services/Exceptions/ApplicationFlowError";
import { normalizeEmploymentInformation } from "../Models/EmploymentInformation";
import { ContactUniquenessService } from "../Services/ContactUniquenessService";

export class ApplicationRepository implements IApplicationRepository {
  constructor(private readonly db = prisma) {}

  async createDraftIfAllowed(application: Partial<Application>, authorizedIds: number[]): Promise<Application> {
    return this.db.$transaction(async tx => {
      const key = `${application.documentType}:${application.documentNumber}:${application.affiliateType}`;
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))`;
      const existing = await tx.membershipApplication.findMany({ where: { documentType: application.documentType as never, documentNumber: application.documentNumber, affiliateType: application.affiliateType as never, deletedAt: null }, select: { id: true, status: true } });
      if (existing.some(item => blocksNewApplication(item.status))) throw new ApplicationFlowError("APPLICATION_EXISTS", "Encontramos una solicitud asociada a este documento. Verifica tu identidad para continuar.");
      if (existing.length && !existing.some(item => authorizedIds.includes(item.id))) throw new ApplicationFlowError("VERIFICATION_REQUIRED", "Verifica tu identidad antes de iniciar una nueva postulación.", 401);
      await this.assertEmailIdentityAvailable(tx, application.email!, application.documentNumber!);
      await this.assertContactUnique(tx, { email: application.email, phone: application.phone });
      const person = await tx.person.findUnique({ where: { documentType_documentNumber: { documentType: application.documentType as never, documentNumber: application.documentNumber! } }, include: { user: true } });
      if (person?.user?.type === "AFFILIATE") throw new ApplicationFlowError("APPLICATION_EXISTS", "No es posible iniciar otra postulación. Consulta tu solicitud o contacta al IIMP.");
      const created = await tx.membershipApplication.create({ data: { applicationCode: application.applicationCode!, trackingCode: application.trackingCode!, documentType: application.documentType as never, documentNumber: application.documentNumber!, affiliateType: application.affiliateType as never, email: application.email!, phone: application.phone!, status: "DRAFT", currentStep: 1, draftData: {} } });
      return this.mapToEntity(created);
    });
  }

  async findDraftByDocument(
    documentNumber: string,
  ): Promise<Application | null> {
    const application = await this.db.membershipApplication.findFirst({
      where: {
        documentNumber,
        status: ApplicationStatus.DRAFT,
        deletedAt: null,
      },
    });

    if (!application) {
      return null;
    }

    return {
      id: application.id,
      applicationCode: application.applicationCode,
      trackingCode: application.trackingCode,
      personId: application.personId,
      documentType: application.documentType,
      documentNumber: application.documentNumber,
      email: application.email,
      phone: application.phone,
      affiliateType: application.affiliateType,
      status: application.status,
      currentStep: application.currentStep,
      draftData: application.draftData as Prisma.JsonValue | null,
      correspondencePreference: application.correspondencePreference,
      submittedAt: application.submittedAt,
      verifiedAt: application.verifiedAt,
      lastAccessAt: application.lastAccessAt,
      expiresAt: application.expiresAt,
      createdAt: application.createdAt,
      updatedAt: application.updatedAt,
      deletedAt: application.deletedAt,
    };
  }

  async findByApplicationCode(
    applicationCode: string,
  ): Promise<Application | null> {
    const application = await this.db.membershipApplication.findUnique({
      where: {
        applicationCode,
      },
    });

    if (!application) {
      return null;
    }

    return this.mapToEntity(application);
  }

  async create(application: Partial<Application>): Promise<Application> {
    const newApplication = await this.db.membershipApplication.create({
      data: {
        applicationCode: application.applicationCode!,
        trackingCode: application.trackingCode!,
        affiliateType: application.affiliateType as any,
        documentType: application.documentType as any,
        documentNumber: application.documentNumber!,
        email: application.email!,
        phone: application.phone!,
        status: application.status as any,
        currentStep: application.currentStep ?? 1,
        draftData:
          application.draftData === null
            ? Prisma.JsonNull
            : (application.draftData as Prisma.InputJsonValue),
      },
    });

    return this.mapToEntity(newApplication);
  }

  async update(
    id: number,
    application: Partial<Application>,
  ): Promise<Application> {
    const updated = await this.db.membershipApplication.update({
      where: {
        id,
      },
      data: {
        personId: application.personId,
        affiliateType: application.affiliateType as any,
        documentType: application.documentType as any,
        documentNumber: application.documentNumber,
        email: application.email,
        phone: application.phone,
        status: application.status as any,
        currentStep: application.currentStep,
        correspondencePreference: application.correspondencePreference,
        draftData:
          application.draftData === undefined
            ? undefined
            : application.draftData === null
              ? Prisma.JsonNull
              : (application.draftData as Prisma.InputJsonValue),
        submittedAt: application.submittedAt,
        verifiedAt: application.verifiedAt,
        lastAccessAt: application.lastAccessAt,
        expiresAt: application.expiresAt,
      },
    });

    return this.mapToEntity(updated);
  }

  async findByTrackingCode(trackingCode: string): Promise<Application | null> {
    const application = await this.db.membershipApplication.findFirst({
      where: {
        trackingCode,
        deletedAt: null,
      },
    });

    if (!application) {
      return null;
    }

    return this.mapToEntity(application);
  }

  async updateDraft(trackingCode: string, dto: UpdateDraftDTO, expectedStatus?: string): Promise<Application> {
    return this.db.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM membership_applications WHERE "trackingCode" = ${trackingCode} FOR UPDATE`;
      const application = await tx.membershipApplication.findUnique({ where: { trackingCode } });
      if (!application || application.deletedAt || !canEditApplication(application.status) || (expectedStatus && application.status !== expectedStatus)) {
        throw new ApplicationFlowError("APPLICATION_NOT_EDITABLE", "El estado de tu solicitud cambió. Revisa las acciones disponibles desde Consultar.");
      }
      const mergedDraft = { ...((application.draftData as Record<string, unknown>) ?? {}), ...dto.draftData };
      if (mergedDraft.employmentInformation && typeof mergedDraft.employmentInformation === "object") {
        mergedDraft.employmentInformation = normalizeEmploymentInformation(mergedDraft.employmentInformation as ApplicationDraft["employmentInformation"] extends infer T ? NonNullable<T> : never);
      }
      const personal = (mergedDraft.personalInformation ?? {}) as { primaryEmail?: string; phone?: string };
      await this.assertContactUnique(tx, { email: personal.primaryEmail, phone: personal.phone, excludeApplicationId: application.id });
      const updated = await tx.membershipApplication.update({ where: { trackingCode }, data: { currentStep: application.status === "DRAFT" ? dto.currentStep : application.currentStep, draftData: mergedDraft as unknown as Prisma.InputJsonValue, lastAccessAt: new Date() } });
      return this.mapToEntity(updated);
    });
  }

  async submitApplication(trackingCode: string): Promise<Application> {
    return await this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM membership_applications WHERE "trackingCode" = ${trackingCode} FOR UPDATE`;
      const application = await tx.membershipApplication.findUnique({
        where: {
          trackingCode,
        },
      });

      if (!application) {
        throw new Error("La postulación no existe.");
      }

      await this.validateBusinessRules(tx, application);

      const personId = await this.upsertPerson(tx, application);
      await this.persistPrimaryAddress(tx, personId, application);

      await this.persistAcademicInfos(tx, personId, application);
      await this.persistEmploymentInfos(tx, personId, application);
      await this.persistApprovals(tx, application);
      await this.persistDocuments(tx, application);

      // 👇 AQUÍ EJECUTAMOS LA CREACIÓN DE LAS COLAS DE TRABAJO (ÁREAS) 👇
      await this.persistInitialValidations(tx, application.id);

      return await this.completeApplication(tx, application, personId);
    });
  }

  // =================================================================
  // NUEVO MÉTODO: Crea los registros reales de áreas pendientes en BD
  // =================================================================
  private async persistInitialValidations(
    tx: Prisma.TransactionClient,
    applicationId: number
  ): Promise<void> {
    // 1. Buscamos todos los departamentos que tu sistema requiere evaluar
    const departments = await tx.membershipDepartment.findMany({
      where: { isActive: true, isRequired: true },
    });

    if (departments.length === 0) return;

    // 2. Por cada departamento, insertamos físicamente un registro "PENDIENTE"
    // ValidatedById queda en null porque nadie lo ha atendido aún.
    const validationsData = departments.map((dept) => ({
      applicationId: applicationId,
      departmentId: dept.id,
      status: ValidationStatus.PENDING,
    }));

    await tx.membershipValidation.createMany({
      data: validationsData,
      skipDuplicates: true, // Protege contra dobles envíos
    });
  }

  private async validateBusinessRules(
    tx: Prisma.TransactionClient,
    application: Prisma.MembershipApplicationGetPayload<Record<string, never>>,
  ): Promise<void> {
    if (!application.draftData) {
      throw new Error("La postulación no contiene información.");
    }

    if (!canSubmitApplication(application.status)) {
      throw new ApplicationFlowError("ALREADY_SUBMITTED", "Tu solicitud ya fue enviada. Puedes revisarla desde Consultar.");
    }

    const draft = application.draftData as unknown as ApplicationDraft;

    if (!draft.personalInformation) {
      throw new Error("La información personal es obligatoria.");
    }

    const personal = draft.personalInformation;

    await this.assertEmailIdentityAvailable(tx, application.email, personal.documentNumber);
    await this.assertContactUnique(tx, { email: personal.primaryEmail, phone: personal.phone, excludeApplicationId: application.id });

    if (!personal.documentNumber) {
      throw new Error("El número de documento es obligatorio.");
    }

    if (!personal.documentType) {
      throw new Error("El tipo de documento es obligatorio.");
    }

    const duplicatedApplication = await tx.membershipApplication.findFirst({
      where: {
        id: {
          not: application.id,
        },
        documentType: application.documentType,
        documentNumber: application.documentNumber,
        affiliateType: application.affiliateType,
        deletedAt: null,
        status: {
          in: [...currentApplicationStates, "COMPLETED"],
        },
      },
    });

    if (duplicatedApplication) {
      throw new ApplicationFlowError("APPLICATION_EXISTS", "Ya existe otra postulación vigente para este documento y tipo de afiliación.");
    }
  }

  private async assertEmailIdentityAvailable(tx: Prisma.TransactionClient, rawEmail: string, documentNumber: string): Promise<void> {
    const email = rawEmail.trim().toLowerCase();
    const owner = await tx.user.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
      select: { person: { select: { documentNumber: true } } },
    });
    if (owner?.person && owner.person.documentNumber !== documentNumber) {
      throw new ApplicationFlowError("EMAIL_CONFLICT", "Este correo ya se encuentra asociado a una cuenta existente. Verifica el correo ingresado o utiliza otro correo para continuar.", 409);
    }
  }

  /**
   * Garantiza que el correo y el celular no estén registrados por otra
   * postulación. La misma postulación (excluida por id) puede volver a guardar
   * sus propios valores sin considerarse duplicado.
   *
   * Regla de negocio: `REJECTED` es la única excepción. Cualquier otra
   * postulación (incluida COMPLETED) bloquea la reutilización.
   */
  private async assertContactUnique(
    tx: Prisma.TransactionClient,
    input: { email?: string | null; phone?: string | null; excludeApplicationId?: number },
  ): Promise<void> {
    const email = ContactUniquenessService.normalizeEmail(input.email);
    const phone = ContactUniquenessService.normalizePhone(input.phone);
    if (!email && !phone) return;

    const existing = await tx.membershipApplication.findMany({
      where: {
        deletedAt: null,
        status: { not: "REJECTED" },
      },
      select: { id: true, email: true, phone: true, status: true },
    });

    const conflict = ContactUniquenessService.detectConflict(
      existing.filter((item) => ContactUniquenessService.blocksDuplicateReuse(item.status)),
      {
        email: input.email,
        phone: input.phone,
        excludeId: input.excludeApplicationId,
      },
    );

    if (conflict.email) {
      throw new ApplicationFlowError("DUPLICATE_EMAIL", "Este correo electrónico ya se encuentra registrado.", 409);
    }
    if (conflict.phone) {
      throw new ApplicationFlowError("DUPLICATE_PHONE", "Este número de celular ya se encuentra registrado.", 409);
    }
  }

  private async upsertPerson(
    tx: Prisma.TransactionClient,
    application: Prisma.MembershipApplicationGetPayload<Record<string, never>>,
  ): Promise<number> {
    if (!application.draftData) {
      throw new Error("La postulación no contiene información.");
    }

    const draft = application.draftData as unknown as ApplicationDraft;

    if (!draft.personalInformation) {
      throw new Error("No existe la información personal de la postulación.");
    }

    const personal = draft.personalInformation;

    const existingPerson = await tx.person.findUnique({
      where: {
        documentType_documentNumber: {
          documentType: personal.documentType as any,
          documentNumber: personal.documentNumber,
        },
      },
    });

    if (existingPerson) {
      const updated = await tx.person.update({
        where: {
          id: existingPerson.id,
        },
        data: {
          firstName: personal.names,
          paternalLastName: personal.fatherLastName,
          maternalLastName: personal.motherLastName,
          birthDate: personal.birthDate ? new Date(personal.birthDate) : null,
          gender: personal.gender as any,
        },
      });

      return updated.id;
    }

    const created = await tx.person.create({
      data: {
        documentType: personal.documentType as any,
        documentNumber: personal.documentNumber,
        firstName: personal.names,
        paternalLastName: personal.fatherLastName,
        maternalLastName: personal.motherLastName,
        birthDate: personal.birthDate ? new Date(personal.birthDate) : null,
        gender: personal.gender as any,
        birthPlace: null,
        civilStatus: null,
        nationalityId: null,
      },
    });

    return created.id;
  }

  private async persistPrimaryAddress(
    tx: Prisma.TransactionClient,
    personId: number,
    application: Prisma.MembershipApplicationGetPayload<Record<string, never>>,
  ): Promise<void> {
    const personal = (application.draftData as unknown as ApplicationDraft | null)?.personalInformation;
    const street = personal?.address?.trim();
    const countryId = Number(personal?.countryId);

    if (!street || !Number.isInteger(countryId) || countryId <= 0) {
      throw new ApplicationFlowError("INVALID_INPUT", "La dirección principal y el país son obligatorios.", 422);
    }

    const country = await tx.country.findUnique({
      where: { id: countryId },
      select: { id: true, isActive: true },
    });
    if (!country?.isActive) {
      throw new ApplicationFlowError("INVALID_INPUT", "El país seleccionado no está disponible.", 422);
    }

    const countryHasDistrictHierarchy = await tx.district.findFirst({
      where: {
        isActive: true,
        province: { isActive: true, department: { isActive: true, countryId } },
      },
      select: { id: true },
    });

    let districtId: number | null = null;
    if (countryHasDistrictHierarchy) {
      const departmentId = Number(personal?.departmentId);
      if (!Number.isInteger(departmentId) || departmentId <= 0) {
        throw new ApplicationFlowError("INVALID_INPUT", "Seleccione el departamento para el país elegido.", 422);
      }

      const department = await tx.department.findFirst({
        where: { id: departmentId, isActive: true, countryId },
        select: { id: true },
      });
      if (!department) {
        throw new ApplicationFlowError("INVALID_INPUT", "El departamento no corresponde al país seleccionado.", 422);
      }

      const provinceId = Number(personal?.provinceId);
      const requestedDistrictId = Number(personal?.districtId);
      const hasProvince = Number.isInteger(provinceId) && provinceId > 0;
      const hasDistrict = Number.isInteger(requestedDistrictId) && requestedDistrictId > 0;

      if (hasDistrict) {
        const district = await tx.district.findFirst({
          where: {
            id: requestedDistrictId,
            isActive: true,
            province: {
              isActive: true,
              ...(hasProvince ? { id: provinceId } : {}),
              department: { id: departmentId, countryId, isActive: true },
            },
          },
          select: { id: true },
        });
        if (!district) {
          throw new ApplicationFlowError("INVALID_INPUT", "El distrito no corresponde a la ubicación seleccionada.", 422);
        }
        districtId = district.id;
      } else if (hasProvince) {
        const province = await tx.province.findFirst({
          where: { id: provinceId, isActive: true, department: { id: departmentId, countryId, isActive: true } },
          select: { id: true },
        });
        if (!province) {
          throw new ApplicationFlowError("INVALID_INPUT", "La provincia no corresponde al departamento seleccionado.", 422);
        }
        // Provincia sin distrito: permitido (districtId permanece null).
      }
      // Sin provincia ni distrito: permitido (ambos quedan null).
    }

    const addressType = await tx.addressType.findUnique({
      where: { code: "HOME" },
      select: { id: true, isActive: true },
    });
    if (!addressType?.isActive) {
      throw new Error("No existe un tipo de direccion principal activo.");
    }

    const primaryAddress = await tx.address.findFirst({
      where: { personId, isPrimary: true },
      orderBy: { id: "asc" },
      select: { id: true },
    });
    const data = {
      countryId,
      districtId,
      addressTypeId: addressType.id,
      street,
      foreignRegion: districtId ? null : personal?.foreignRegion?.trim() || null,
      foreignCity: districtId ? null : personal?.foreignCity?.trim() || null,
      isPrimary: true,
    };

    if (primaryAddress) {
      await tx.address.update({ where: { id: primaryAddress.id }, data });
      return;
    }

    await tx.address.create({ data: { personId, ...data } });
  }

  private async persistAcademicInfos(
    tx: Prisma.TransactionClient,
    personId: number,
    application: Prisma.MembershipApplicationGetPayload<Record<string, never>>,
  ): Promise<void> {
    if (!application.draftData) {
      return;
    }

    const draft = application.draftData as unknown as ApplicationDraft;

    if (!draft.academicStudies?.length) {
      return;
    }

    await tx.academicInfo.deleteMany({
      where: {
        personId,
      },
    });

    for (const study of draft.academicStudies) {
      const degree = study.degreeId
        ? await tx.academicDegree.findUnique({ where: { id: study.degreeId }, select: { studyLevel: true, isActive: true } })
        : null;
      if (study.degreeId && (!degree || !degree.isActive)) {
        throw new Error("El grado académico seleccionado no está disponible.");
      }
      await tx.academicInfo.create({
        data: {
          personId,
          studyLevel: degree?.studyLevel ?? "OTHER",
          degreeId: study.degreeId ?? null,
          universityId:
            study.institutionId && study.institutionId > 0
              ? study.institutionId
              : null,
          specialtyId: study.specialtyId ?? null,
          degreeTitle: study.degreeTitle,
          professionalAssociation: study.professionalAssociation ?? null,
          licenseNumber: study.registrationNumber ?? null,
          graduationYear: study.graduationYear ?? null,
          termOrSemester: null,
        },
      });
    }
  }

  private async persistEmploymentInfos(
    tx: Prisma.TransactionClient,
    personId: number,
    application: Prisma.MembershipApplicationGetPayload<Record<string, never>>,
  ): Promise<void> {
    if (!application.draftData) {
      return;
    }

    const draft = application.draftData as unknown as ApplicationDraft;

    if (!draft.employmentInformation) {
      return;
    }

    const employment = normalizeEmploymentInformation(draft.employmentInformation);

    await tx.employmentInfo.deleteMany({
      where: {
        personId,
      },
    });

    if (employment.employmentStatus === "NOT_WORKING") return;

    await tx.employmentInfo.create({
      data: {
        personId,
        companyId: employment.companyId ?? null,
        positionId: employment.positionId ?? null,
        area: employment.area ?? null,
        workingAddress: employment.workingAddress ?? null,
        workPhone: employment.workPhone ?? null,
        workExtension: employment.workExtension ?? null,
        workEmail: employment.workEmail ?? null,
      },
    });
  }

  private async persistApprovals(
    tx: Prisma.TransactionClient,
    application: Prisma.MembershipApplicationGetPayload<Record<string, never>>,
  ): Promise<void> {
    if (!application.draftData) {
      return;
    }

    const draft = application.draftData as unknown as ApplicationDraft;

    if (!draft.endorsements) {
      return;
    }

    const endorsements = draft.endorsements;

    await tx.membershipApproval.deleteMany({
      where: {
        applicationId: application.id,
      },
    });

    const approvals = [
      endorsements.firstEndorsement,
      endorsements.secondEndorsement,
    ].filter(
      (endorsement): endorsement is NonNullable<typeof endorsement> =>
        endorsement !== undefined && endorsement !== null,
    );

    for (const endorsement of approvals) {
      if (!endorsement.sponsorDocumentNumber) {
        continue;
      }

      const sponsor = await tx.person.findFirst({
        where: {
          documentNumber: endorsement.sponsorDocumentNumber,
          user: { type: "AFFILIATE", status: "ACTIVE", role: { slug: "ASOCIADO_ACTIVO" } },
        },
        select: { id: true },
      });
      if (!sponsor) throw new ApplicationFlowError("INVALID_INPUT", "Uno de los avales ya no se encuentra hábil.", 422);

      await tx.membershipApproval.create({
        data: {
          applicationId: application.id,
          sponsorPersonId: sponsor.id,
          sponsorCode: `A-${sponsor.id.toString().padStart(4, "0")}`,
        },
      });
    }
  }

  private async persistDocuments(
    tx: Prisma.TransactionClient,
    application: Prisma.MembershipApplicationGetPayload<Record<string, never>>,
  ): Promise<void> {
    if (!application.draftData) {
      return;
    }

    const draft = application.draftData as unknown as ApplicationDraft;

    await tx.applicationDocument.deleteMany({
      where: {
        applicationId: application.id,
      },
    });

    const identityDoc = draft.personalInformation?.identityDocument as any;
    if (identityDoc && identityDoc.url) {
      await tx.applicationDocument.create({
        data: {
          applicationId: application.id,
          category: "ID_DOCUMENT",
          fileUrl: identityDoc.url,
          fileName:
            identityDoc.name ||
            `Documento_Identidad_${draft.personalInformation?.documentNumber}`,
          mimeType: identityDoc.type || "application/pdf",
          sizeBytes: BigInt(0),
        },
      });
    }

    const photoDoc = draft.personalInformation?.photo as any;
    if (photoDoc && photoDoc.url) {
      await tx.applicationDocument.create({
        data: {
          applicationId: application.id,
          category: "OTHER",
          fileUrl: photoDoc.url,
          fileName:
            photoDoc.name ||
            `Foto_${draft.personalInformation?.documentNumber}`,
          mimeType: photoDoc.type || "image/jpeg",
          sizeBytes: BigInt(0),
        },
      });
    }

    const declarationUrl = draft.endorsements?.declarationDocumentId;
    if (declarationUrl) {
      await tx.applicationDocument.create({
        data: {
          applicationId: application.id,
          category: "SWORN_DECLARATION",
          fileUrl: declarationUrl,
          fileName: "Declaracion_Jurada_Firmada.pdf",
          mimeType: "application/pdf",
          sizeBytes: BigInt(0),
        },
      });
    }

    const universityLetter = draft.academicStudies?.[0]
      ?.universityLetter as any;
    if (universityLetter && universityLetter.url) {
      await tx.applicationDocument.create({
        data: {
          applicationId: application.id,
          category: "OTHER",
          fileUrl: universityLetter.url,
          fileName: universityLetter.name || "Constancia_Estudios.pdf",
          mimeType: universityLetter.type || "application/pdf",
          sizeBytes: BigInt(0),
        },
      });
    }
  }

  private async completeApplication(
    tx: Prisma.TransactionClient,
    application: Prisma.MembershipApplicationGetPayload<Record<string, never>>,
    personId: number,
  ): Promise<Application> {
    const updated = await tx.membershipApplication.update({
      where: {
        id: application.id,
      },
      data: {
        personId,
        status: ApplicationStatus.PENDING,
        submittedAt: new Date(),
      },
    });

    return this.mapToEntity(updated);
  }

  private mapToEntity(
    application: Prisma.MembershipApplicationGetPayload<Record<string, never>>,
  ): Application {
    return {
      id: application.id,
      applicationCode: application.applicationCode,
      trackingCode: application.trackingCode,
      personId: application.personId,
      documentType: application.documentType,
      documentNumber: application.documentNumber,
      email: application.email,
      phone: application.phone,
      affiliateType: application.affiliateType,
      status: application.status,
      currentStep: application.currentStep,
      draftData: application.draftData as Prisma.JsonValue | null,
      correspondencePreference: application.correspondencePreference,
      submittedAt: application.submittedAt,
      verifiedAt: application.verifiedAt,
      lastAccessAt: application.lastAccessAt,
      expiresAt: application.expiresAt,
      createdAt: application.createdAt,
      updatedAt: application.updatedAt,
      deletedAt: application.deletedAt,
    };
  }
}
