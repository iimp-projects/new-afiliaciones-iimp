import { ApplicationStatus, Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

import { Application } from "../Entities/Application";
import { IApplicationRepository } from "./Interfaces/IApplicationRepository";
import { UpdateDraftDTO } from "../DTOs/update-draft.dto";
import { ApplicationDraft } from "../Models/ApplicationDraft";

export class ApplicationRepository implements IApplicationRepository {
  constructor(private readonly db = prisma) {}

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
    const application = await this.db.membershipApplication.findUnique({
      where: {
        trackingCode,
      },
    });

    if (!application) {
      return null;
    }

    return this.mapToEntity(application);
  }

  async updateDraft(
    trackingCode: string,
    dto: UpdateDraftDTO,
  ): Promise<Application> {
    const application = await this.db.membershipApplication.findUnique({
      where: {
        trackingCode,
      },
    });

    if (!application) {
      throw new Error("La postulación no existe.");
    }

    /**
     * Merge del borrador.
     * Conserva toda la información existente
     * y únicamente agrega o reemplaza
     * la sección enviada.
     */
    const mergedDraft = {
      ...((application.draftData as Record<string, unknown>) ?? {}),
      ...dto.draftData,
    };

    const updatedApplication = await this.db.membershipApplication.update({
      where: {
        trackingCode,
      },
      data: {
        currentStep: dto.currentStep,

        draftData: mergedDraft as unknown as Prisma.InputJsonValue,

        lastAccessAt: new Date(),
      },
    });

    return this.mapToEntity(updatedApplication);
  }

  async submitApplication(trackingCode: string): Promise<Application> {
    return await this.db.$transaction(async (tx) => {
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

      await this.persistAcademicInfos(tx, personId, application);

      await this.persistEmploymentInfos(tx, personId, application);

      await this.persistApprovals(tx, application);

      return await this.completeApplication(tx, application, personId);
    });
  }

  private async validateBusinessRules(
    tx: Prisma.TransactionClient,
    application: Prisma.MembershipApplicationGetPayload<Record<string, never>>,
  ): Promise<void> {
    // 1. Debe existir información del borrador.
    if (!application.draftData) {
      throw new Error("La postulación no contiene información.");
    }

    // 2. Solo se puede enviar un DRAFT.
    if (application.status !== ApplicationStatus.DRAFT) {
      throw new Error(
        "Solo las postulaciones en estado DRAFT pueden enviarse.",
      );
    }

    const draft = application.draftData as unknown as ApplicationDraft;

    // 3. Debe existir el paso 1.
    if (!draft.personalInformation) {
      throw new Error("La información personal es obligatoria.");
    }

    const personal = draft.personalInformation;

    // 4. Documento obligatorio.
    if (!personal.documentNumber) {
      throw new Error("El número de documento es obligatorio.");
    }

    if (!personal.documentType) {
      throw new Error("El tipo de documento es obligatorio.");
    }

    // 5. Buscar otra postulación activa.
    const duplicatedApplication = await tx.membershipApplication.findFirst({
      where: {
        id: {
          not: application.id,
        },

        documentType: application.documentType,

        documentNumber: application.documentNumber,

        deletedAt: null,

        status: {
          in: [ApplicationStatus.DRAFT, ApplicationStatus.SUBMITTED],
        },
      },
    });

    if (duplicatedApplication) {
      throw new Error("Ya existe otra postulación activa para este documento.");
    }

    // ======================================================
    // TODO
    // Verificar si la persona ya es asociada.
    // Esta regla depende del modelo Person/Affiliate.
    // ======================================================
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

    // Eliminamos la información previa para volver a sincronizarla.
    await tx.academicInfo.deleteMany({
      where: {
        personId,
      },
    });

    for (const study of draft.academicStudies) {
      await tx.academicInfo.create({
        data: {
          personId,

          // Temporal hasta que el formulario envíe el nivel de estudio.
          studyLevel: "OTHER",

          degreeId: null,

          universityId:
            study.institutionId && study.institutionId > 0
              ? study.institutionId
              : null,

          specialtyId: null,

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

    const employment = draft.employmentInformation;

    await tx.employmentInfo.deleteMany({
      where: {
        personId,
      },
    });

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

  private async persistProfessionalExperiences(
    tx: Prisma.TransactionClient,
    personId: number,
    application: Prisma.MembershipApplicationGetPayload<Record<string, never>>,
  ): Promise<void> {
    // TODO Sprint 5
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
      if (!endorsement.sponsorPersonId) {
        continue;
      }

      await tx.membershipApproval.create({
        data: {
          applicationId: application.id,
          sponsorPersonId: endorsement.sponsorPersonId,
          sponsorCode: endorsement.sponsorCode ?? null,
        },
      });
    }
  }

  private async persistDocuments(
    tx: Prisma.TransactionClient,
    application: Prisma.MembershipApplicationGetPayload<Record<string, never>>,
  ): Promise<void> {
    // TODO Sprint 7
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
        status: ApplicationStatus.SUBMITTED,
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
