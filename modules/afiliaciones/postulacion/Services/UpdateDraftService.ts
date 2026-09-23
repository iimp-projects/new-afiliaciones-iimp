import { Application } from "../Entities/Application";
import { UpdateDraftDTO } from "../DTOs/update-draft.dto";
import { IApplicationRepository } from "../Repositories/Interfaces/IApplicationRepository";
import { prisma } from "@/lib/prisma";
import { ObservationStatus, Prisma, ValidationAction, ValidationStatus } from "@prisma/client";
import { ApplicationStatusCalculatorService } from "./ApplicationStatusCalculatorService";
import { NotifyApplicantService } from "./NotifyApplicantService";
import { AssociateProvisioningService } from "../../asociados/Services/AssociateProvisioningService";
import { ApplicationAccessService } from "./ApplicationAccessService";
import { ApplicationFlowError } from "./Exceptions/ApplicationFlowError";
import { AssociatesIntegrationService } from "../../associates-integration/Services/AssociatesIntegrationService";
import { PersonalInformation } from "../Models/PersonalInformation";

export class UpdateDraftService {

    constructor(
        private readonly repository: IApplicationRepository
    ) {}

    async execute(
        trackingCode: string,
        dto: UpdateDraftDTO,
        token?: string,
    ): Promise<Application> {

        const application =
            await this.findApplication(trackingCode);

        new ApplicationAccessService().require(Number(application.id), token);
        await this.ensureEditable(application, dto);

        const updatedApplication = await this.updateDraft(
            trackingCode,
            dto,
            application.status
        );

        if (application.status === "OBSERVED") {
            await this.syncPersistedEntities(Number(application.id), dto.draftData);
            await this.markCorrectionSubmitted(Number(application.id));

            try {
                const notifyService = new NotifyApplicantService();
                await notifyService.notifyCorrectionReceived(application, dto.draftData);
            } catch (err) {
                console.error("[UpdateDraftService] Error enviando correo de confirmación de subsanación:", err);
            }
        }

        return updatedApplication;

    }

    /**
     * Obtiene la postulación.
     */
    private async findApplication(
        trackingCode: string
    ): Promise<Application> {

        const application =
            await this.repository.findByTrackingCode(
                trackingCode
            );

        if (!application) {

            throw new Error(
                "La postulación no existe."
            );

        }

        return application;

    }

    /**
     * Verifica que la postulación
     * aún pueda modificarse.
     */
    private async ensureEditable(
        application: Application,
        dto: UpdateDraftDTO
    ): Promise<void> {

        if (application.status === "DRAFT") return;

        if (application.status !== "OBSERVED") {

            throw new ApplicationFlowError("APPLICATION_NOT_EDITABLE", "Tu solicitud ya fue enviada. Puedes revisarla desde Consultar.");

        }

        const observations = await prisma.membershipObservation.findMany({
            where: { applicationId: Number(application.id), status: "PENDING" },
            select: { fieldPaths: true },
        });
        const rawObservedPaths = observations.flatMap((item) =>
            Array.isArray(item.fieldPaths)
                ? item.fieldPaths.filter((path): path is string => typeof path === "string")
                : []
        );
        const strictlyObserved = new Set(rawObservedPaths);

        // Campos en cascada: si el padre fue observado, sus campos dependientes
        // también se permiten modificar en el draft.
        const DEPENDENT_CASCADE: Record<string, string[]> = {
            "personalInformation.countryId": [
                "personalInformation.departmentId",
                "personalInformation.provinceId",
                "personalInformation.districtId",
            ],
            "personalInformation.departmentId": [
                "personalInformation.provinceId",
                "personalInformation.districtId",
            ],
            "personalInformation.provinceId": [
                "personalInformation.districtId",
            ],
            // Al observar el RUC, se permite actualizar también la empresa, dirección laboral y situación
            "employmentInformation.companyTaxId": [
                "employmentInformation.companyName",
                "employmentInformation.isIndependent",
                "employmentInformation.isUnemployed",
                "employmentInformation.employmentStatus",
                "employmentInformation.workingAddress",
            ],
        };

        const allowedToModify = new Set(strictlyObserved);
        for (const [parent, children] of Object.entries(DEPENDENT_CASCADE)) {
            if (strictlyObserved.has(parent)) {
                children.forEach((child) => allowedToModify.add(child));
            }
        }

        const current = (application.draftData ?? {}) as Record<string, any>;
        const proposed = dto.draftData as Record<string, any>;

        const compare = (before: any, after: any, path = ""): void => {
            if (JSON.stringify(before) === JSON.stringify(after)) return;
            // Si la ruta exacta está en las permitidas, se acepta cualquier cambio en esa rama
            if (path && allowedToModify.has(path)) return;
            if (before && after && typeof before === "object" && typeof after === "object") {
                const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
                keys.forEach((key) => compare(before[key], after[key], path ? `${path}.${key}` : key));
                return;
            }
            if (!allowedToModify.has(path)) {
                throw new ApplicationFlowError("APPLICATION_NOT_EDITABLE", "Solo puede modificar los campos solicitados en la observación.");
            }
        };
        Object.keys(proposed).forEach((section) => compare(current[section], proposed[section], section));

        // ── VALIDACIÓN DE CAMPOS OBSERVADOS ATENDIDOS ─────────────────────────────
        // Verificar que TODOS los campos observados fueron efectivamente modificados.
        // Un campo se considera "atendido" cuando su valor en el draft propuesto
        // difiere del valor en el draft actual (comparación profunda por JSON).
        const getNestedValue = (obj: any, path: string): any =>
            path.split(".").reduce((acc, key) => acc?.[key], obj);

        const hasChanged = (path: string): boolean => {
            const before = getNestedValue(current, path);
            const after  = getNestedValue(proposed, path);
            return JSON.stringify(before) !== JSON.stringify(after);
        };

        const implicitlyAddressed = new Set<string>();
        for (const [parent, children] of Object.entries(DEPENDENT_CASCADE)) {
            if (strictlyObserved.has(parent) && hasChanged(parent)) {
                children.forEach((child) => implicitlyAddressed.add(child));
            }
        }

        const unattended = [...strictlyObserved].filter(
            (path) => !hasChanged(path) && !implicitlyAddressed.has(path)
        );

        const FIELD_LABELS: Record<string, string> = {
            names: "Nombres",
            fatherLastName: "Apellido paterno",
            motherLastName: "Apellido materno",
            birthDate: "Fecha de nacimiento",
            gender: "Género",
            phone: "Celular",
            primaryEmail: "Correo principal",
            secondaryEmail: "Correo secundario",
            address: "Dirección",
            countryId: "País",
            departmentId: "Departamento",
            provinceId: "Provincia",
            districtId: "Distrito",
            companyTaxId: "RUC / Situación laboral",
            companyName: "Empresa",
            area: "Área",
            positionName: "Cargo",
            workPhone: "Teléfono laboral",
            workEmail: "Correo laboral",
            workingAddress: "Dirección laboral",
            degreeId: "Grado Académico",
            degreeTitle: "Título obtenido",
            specialty: "Especialidad",
            professionalAssociation: "Colegio profesional",
            registrationNumber: "Número de colegiatura",
            declarationDocumentId: "Declaración jurada",
            identityDocument: "Documento de identidad",
            photo: "Fotografía",
            universityLetter: "Constancia universitaria",
        };

        if (unattended.length > 0) {
            const friendlyUnattended = unattended.map((path) => {
                const key = path.split(".").at(-1) ?? path;
                return FIELD_LABELS[key] ?? path;
            });

            throw new ApplicationFlowError(
                "CORRECTION_INCOMPLETE",
                `Debe corregir todos los campos observados antes de enviar la subsanación. Campos pendientes: ${friendlyUnattended.join(", ")}.`
            );
        }
        // ─────────────────────────────────────────────────────────────────────────

    }

    /**
     * Sincroniza las tablas relacionales (membership_documents, person, etc.)
     * con los datos subsanados del draftData para que el CMS y la BD se actualicen de inmediato.
     */
    private async syncPersistedEntities(applicationId: number, draftData: any): Promise<void> {
        if (!draftData) return;
        const draft = draftData as Record<string, any>;

        await prisma.$transaction(async (tx) => {
            const app = await tx.membershipApplication.findUnique({
                where: { id: applicationId },
            });
            if (!app) return;

            // 1. Sincronizar membership_documents
            await tx.applicationDocument.deleteMany({
                where: { applicationId },
            });

            const identityDoc = draft.personalInformation?.identityDocument;
            const identityUrl = typeof identityDoc === "string" ? identityDoc : identityDoc?.url;
            if (identityUrl) {
                await tx.applicationDocument.create({
                    data: {
                        applicationId,
                        category: "ID_DOCUMENT",
                        fileUrl: identityUrl,
                        fileName:
                            (typeof identityDoc === "object" && identityDoc?.name) ||
                            `Documento_Identidad_${draft.personalInformation?.documentNumber || app.documentNumber || ""}`,
                        mimeType: (typeof identityDoc === "object" && identityDoc?.type) || "application/pdf",
                        sizeBytes: BigInt(0),
                    },
                });
            }

            const photoDoc = draft.personalInformation?.photo;
            const photoUrl = typeof photoDoc === "string" ? photoDoc : photoDoc?.url;
            if (photoUrl) {
                await tx.applicationDocument.create({
                    data: {
                        applicationId,
                        category: "OTHER",
                        fileUrl: photoUrl,
                        fileName:
                            (typeof photoDoc === "object" && photoDoc?.name) ||
                            `Foto_${draft.personalInformation?.documentNumber || app.documentNumber || ""}`,
                        mimeType: (typeof photoDoc === "object" && photoDoc?.type) || "image/jpeg",
                        sizeBytes: BigInt(0),
                    },
                });
            }

            const declarationDoc = draft.endorsements?.declarationDocumentId;
            const declarationUrl = typeof declarationDoc === "string" ? declarationDoc : declarationDoc?.url;
            if (declarationUrl) {
                await tx.applicationDocument.create({
                    data: {
                        applicationId,
                        category: "SWORN_DECLARATION",
                        fileUrl: declarationUrl,
                        fileName:
                            (typeof declarationDoc === "object" && declarationDoc?.name) ||
                            "Declaracion_Jurada_Firmada.pdf",
                        mimeType: (typeof declarationDoc === "object" && declarationDoc?.type) || "application/pdf",
                        sizeBytes: BigInt(0),
                    },
                });
            }

            const universityLetter = draft.academicStudies?.[0]?.universityLetter;
            const letterUrl = typeof universityLetter === "string" ? universityLetter : universityLetter?.url;
            if (letterUrl) {
                await tx.applicationDocument.create({
                    data: {
                        applicationId,
                        category: "OTHER",
                        fileUrl: letterUrl,
                        fileName:
                            (typeof universityLetter === "object" && universityLetter?.name) ||
                            "Constancia_Estudios.pdf",
                        mimeType: (typeof universityLetter === "object" && universityLetter?.type) || "application/pdf",
                        sizeBytes: BigInt(0),
                    },
                });
            }

            // 2. Sincronizar datos de la persona si existe
            if (app.personId && draft.personalInformation) {
                const personal = draft.personalInformation;
                await tx.person.update({
                    where: { id: app.personId },
                    data: {
                        firstName: personal.names || undefined,
                        paternalLastName: personal.fatherLastName || undefined,
                        maternalLastName: personal.motherLastName || undefined,
                        birthDate: personal.birthDate ? new Date(personal.birthDate) : undefined,
                        gender: personal.gender || undefined,
                    },
                });
                await this.persistPrimaryAddress(tx, app.personId, personal);
            }
        });
    }

    private async persistPrimaryAddress(tx: Prisma.TransactionClient, personId: number, personal: PersonalInformation): Promise<void> {
        const street = personal.address?.trim();
        const countryId = Number(personal.countryId);

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
            const departmentId = Number(personal.departmentId);
            const provinceId = Number(personal.provinceId);
            const requestedDistrictId = Number(personal.districtId);
            if (!Number.isInteger(departmentId) || departmentId <= 0 || !Number.isInteger(provinceId) || provinceId <= 0 || !Number.isInteger(requestedDistrictId) || requestedDistrictId <= 0) {
                throw new ApplicationFlowError("INVALID_INPUT", "Seleccione departamento, provincia y distrito para el país elegido.", 422);
            }

            const district = await tx.district.findFirst({
                where: {
                    id: requestedDistrictId,
                    isActive: true,
                    province: { id: provinceId, isActive: true, department: { id: departmentId, countryId, isActive: true } },
                },
                select: { id: true },
            });
            if (!district) {
                throw new ApplicationFlowError("INVALID_INPUT", "El distrito no corresponde a la ubicación seleccionada.", 422);
            }
            districtId = district.id;
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
            foreignRegion: districtId ? null : personal.foreignRegion?.trim() || null,
            foreignCity: districtId ? null : personal.foreignCity?.trim() || null,
            isPrimary: true,
        };

        if (primaryAddress) {
            await tx.address.update({ where: { id: primaryAddress.id }, data });
            return;
        }

        await tx.address.create({ data: { personId, ...data } });
    }

    /** Bloquea una subsanación enviada y la deja disponible para reevaluación. */
    private async markCorrectionSubmitted(applicationId: number): Promise<void> {
        const integrationService = new AssociatesIntegrationService();
        let integrationId: number | undefined;
        await prisma.$transaction(async (tx) => {
            const observations = await tx.membershipObservation.findMany({
                where: { applicationId, status: ObservationStatus.PENDING },
                select: { reviewDepartment: true },
            });
            const departments = new Set(observations.map((observation) => observation.reviewDepartment));

            await tx.membershipObservation.updateMany({
                where: { applicationId, status: ObservationStatus.PENDING },
                data: { status: ObservationStatus.RESOLVED, resolvedAt: new Date() },
            });

            const validations = await tx.membershipValidation.findMany({
                where: { applicationId, status: ValidationStatus.OBSERVED },
                include: { department: true },
            });

            for (const validation of validations.filter((item) => departments.has(item.department.code))) {
                await tx.membershipValidation.update({
                    where: { id: validation.id },
                    data: { status: ValidationStatus.RESOLVED, validatedAt: new Date() },
                });
                await tx.membershipValidationHistory.create({
                    data: {
                        validationId: validation.id,
                        action: ValidationAction.SUBMITTED_CORRECTION,
                        comment: "El postulante envió la subsanación solicitada.",
                    },
                });
            }

            await new ApplicationStatusCalculatorService(integrationService).recalculate(applicationId, tx, (preparedId) => { integrationId = preparedId; });
        });
        if (integrationId) await integrationService.processAfterCommit(integrationId);
        if (integrationId) await new AssociateProvisioningService().provisionCompletedApplication(applicationId);
    }

    /**
     * Guarda el borrador.
     */
    private async updateDraft(
        trackingCode: string,
        dto: UpdateDraftDTO,
        expectedStatus: string
    ): Promise<Application> {

        return await this.repository.updateDraft(
            trackingCode,
            dto,
            expectedStatus
        );

    }

}
