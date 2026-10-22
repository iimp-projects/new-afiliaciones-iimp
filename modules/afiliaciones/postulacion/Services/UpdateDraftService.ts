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
import { ApplicationDraft } from "../Models/ApplicationDraft";
import { AcademicStudy } from "../Models/AcademicStudy";
import { MembershipType } from "../Types/MembershipType";
import { AcademicStudyValidator } from "../Validators/AcademicStudyValidator";
import { assertStudentAcademicAllowed, persistAcademicInfos } from "../Repositories/AcademicInfoPersistence";
import { isLegacyTrackingCode } from "../StudentAcademicRules";
import { findUnauthorizedChange } from "../DraftComparison";
import { applicationNotificationEvents, type CorrectionReference } from "../../notifications/Services/ApplicationNotificationEvents";
import { isSubsanacionSyncDisabled } from "@/lib/config/env";

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

        const isLegacy = isLegacyTrackingCode(application.trackingCode);

        if (application.status === "OBSERVED" && isSubsanacionSyncDisabled()) {
            throw new ApplicationFlowError(
                "SUBSANACION_UNAVAILABLE",
                "La subsanación está temporalmente en mantenimiento. Intenta nuevamente más tarde.",
            );
        }

        await this.validateStudentAcademicCatalog(dto, application, isLegacy);

        if (application.status === "OBSERVED") {
            this.validateAcademicSync(dto, application, isLegacy);
        }

        const updatedApplication = await this.updateDraft(
            trackingCode,
            dto,
            application.status
        );

        if (application.status === "OBSERVED") {
            await this.syncPersistedEntities(Number(application.id), updatedApplication.draftData, isLegacy);
            const corrections = await this.markCorrectionSubmitted(Number(application.id));

            try {
                const notifyService = new NotifyApplicantService();
                await notifyService.notifyCorrectionReceived(application, dto.draftData);
            } catch (err) {
                console.error("[UpdateDraftService] Error enviando correo de confirmación de subsanación:", err);
            }

            try {
                await applicationNotificationEvents.notifyCorrectionReceived(Number(application.id), corrections);
            } catch (notificationError) {
                console.error("[UpdateDraftService] Error generando notificaciones internas de subsanación:", notificationError);
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

        const unauthorized = findUnauthorizedChange(current, proposed, allowedToModify);
        if (unauthorized) {
            throw new ApplicationFlowError("APPLICATION_NOT_EDITABLE", "Solo puede modificar los campos solicitados en la observación.");
        }

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
            cycle: "Ciclo",
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
     * Valida la formación académica antes de persistir la subsanación, reutilizando
     * el mismo validador del envío inicial para no duplicar las reglas. Para
     * estudiantes exige especialidad, ciclo y año de ingreso, además de los campos
     * ya obligatorios del flujo estudiantil.
     *
     * Para postulaciones Legacy se omite esta revalidación integral: los registros
     * académicos migrados no disponen de todos los campos del flujo nuevo (p. ej.
     * `cycle` se migró como `termOrSemester`) y no deben revalidarse contra las
     * reglas actuales. La restricción de especialidad ya se aplica, con
     * compatibilidad de familias, en {@link validateStudentAcademicCatalog}.
     */
    private validateAcademicSync(dto: UpdateDraftDTO, application: Application, isLegacy: boolean): void {
        if (application.affiliateType !== "STUDENT") return;
        if (isLegacy) return;

        const studies = (dto.draftData as ApplicationDraft | undefined)?.academicStudies;
        if (!studies?.length) return;

        const validator = new AcademicStudyValidator();
        for (const study of studies) {
            const result = validator.validate(study, MembershipType.STUDENT);
            if (!result.valid) {
                const error = result.errors[0];
                throw new ApplicationFlowError("INVALID_INPUT", error.message, 422);
            }
        }
    }

    /**
     * Valida en backend las restricciones de catálogo del flujo ESTUDIANTE
     * (especialidades canónicas y filtro provisional de universidad) cada vez
     * que se guarda información académica, para que la restricción no dependa
     * únicamente del filtro visual del frontend.
     *
     * En postulaciones Legacy se permite conservar especialidades históricas de
     * las familias Minas / Geología / Metalurgia.
     */
    private async validateStudentAcademicCatalog(dto: UpdateDraftDTO, application: Application, isLegacy: boolean): Promise<void> {
        if (application.affiliateType !== "STUDENT") return;

        const studies = (dto.draftData as ApplicationDraft | undefined)?.academicStudies;
        if (!studies?.length) return;

        for (const study of studies as AcademicStudy[]) {
            await assertStudentAcademicAllowed(prisma, study, {
                allowLegacySpecialtyFamily: isLegacy,
            });
        }
    }

    /**
     * Sincroniza las tablas relacionales (membership_documents, person, etc.)
     * con los datos subsanados del draftData para que el CMS y la BD se actualicen de inmediato.
     */
    private async syncPersistedEntities(applicationId: number, draftData: any, isLegacy: boolean): Promise<void> {
        if (!draftData) return;
        const draft = draftData as Record<string, any>;

        await prisma.$transaction(async (tx) => {
            const app = await tx.membershipApplication.findUnique({
                where: { id: applicationId },
            });
            if (!app) return;

            // 1. Sincronizar membership_documents (selectivo, idempotente, NO destructivo).
            //    No se elimina ningún documento preexistente: se agregan/actualizan
            //    únicamente las referencias presentes en el draft. Esto preserva las
            //    categorías históricas (RECOMMENDATION_LETTER, CV, PAYMENT_VOUCHER),
            //    los documentos legacy y los múltiples archivos válidos por categoría.
            const identityDoc = draft.personalInformation?.identityDocument;
            const identityUrl = typeof identityDoc === "string" ? identityDoc : identityDoc?.url;
            const identityInserted = await this.ensureDocument(
                tx,
                applicationId,
                "ID_DOCUMENT",
                identityUrl,
                (typeof identityDoc === "object" && identityDoc?.name) ||
                    `Documento_Identidad_${draft.personalInformation?.documentNumber || app.documentNumber || ""}`,
                (typeof identityDoc === "object" && identityDoc?.type) || "application/pdf",
            );

            const photoDoc = draft.personalInformation?.photo;
            const photoUrl = typeof photoDoc === "string" ? photoDoc : photoDoc?.url;
            const photoInserted = await this.ensureDocument(
                tx,
                applicationId,
                "OTHER",
                photoUrl,
                (typeof photoDoc === "object" && photoDoc?.name) ||
                    `Foto_${draft.personalInformation?.documentNumber || app.documentNumber || ""}`,
                (typeof photoDoc === "object" && photoDoc?.type) || "image/jpeg",
            );

            const declarationDoc = draft.endorsements?.declarationDocumentId;
            const declarationUrl = typeof declarationDoc === "string" ? declarationDoc : declarationDoc?.url;
            const declarationInserted = await this.ensureDocument(
                tx,
                applicationId,
                "SWORN_DECLARATION",
                declarationUrl,
                (typeof declarationDoc === "object" && declarationDoc?.name) ||
                    "Declaracion_Jurada_Firmada.pdf",
                (typeof declarationDoc === "object" && declarationDoc?.type) || "application/pdf",
            );

            const universityLetter = draft.academicStudies?.[0]?.universityLetter;
            const letterUrl = typeof universityLetter === "string" ? universityLetter : universityLetter?.url;
            const letterInserted = await this.ensureDocument(
                tx,
                applicationId,
                "OTHER",
                letterUrl,
                (typeof universityLetter === "object" && universityLetter?.name) ||
                    "Constancia_Estudios.pdf",
                (typeof universityLetter === "object" && universityLetter?.type) || "application/pdf",
            );

            await tx.auditLog.create({
                data: {
                    action: "SUBSANACION_DOCUMENT_SYNC",
                    entity: "MembershipApplication",
                    entityId: String(applicationId),
                    newValues: {
                        addedDocuments: [
                            identityInserted ? identityUrl : null,
                            photoInserted ? photoUrl : null,
                            declarationInserted ? declarationUrl : null,
                            letterInserted ? letterUrl : null,
                        ].filter((url): url is string => typeof url === "string"),
                    },
                },
            });

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

            // 3. Sincronizar la formación académica (academic_info) desde el draft
            // persistido, para que `cycle` y el resto de campos académicos queden
            // alineados con draftData después de una subsanación.
            if (app.personId) {
                await persistAcademicInfos(tx, app.personId, app.draftData, app.affiliateType, {
                    allowLegacySpecialtyFamily: isLegacy,
                });
            }
        });
    }

    /**
     * Inserta una referencia documental solo si aún no existe para ese expediente
     * y URL. No elimina registros existentes (selectivo e idempotente).
     */
    private async ensureDocument(
        tx: Prisma.TransactionClient,
        applicationId: number,
        category: "ID_DOCUMENT" | "OTHER" | "SWORN_DECLARATION",
        fileUrl: string | undefined,
        fileName: string,
        mimeType: string,
    ): Promise<boolean> {
        if (!fileUrl) return false;

        const existing = await tx.applicationDocument.findFirst({
            where: { applicationId, fileUrl },
            select: { id: true },
        });
        if (existing) return false;

        await tx.applicationDocument.create({
            data: {
                applicationId,
                category,
                fileUrl,
                fileName,
                mimeType,
                sizeBytes: BigInt(0),
            },
        });
        return true;
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

            const provinceId = Number(personal.provinceId);
            const requestedDistrictId = Number(personal.districtId);
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
            zipCode: personal.postalCode?.trim() || null,
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
    private async markCorrectionSubmitted(applicationId: number): Promise<CorrectionReference[]> {
        const integrationService = new AssociatesIntegrationService();
        let integrationId: number | undefined;
        const corrections: CorrectionReference[] = [];
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
                const history = await tx.membershipValidationHistory.create({
                    data: {
                        validationId: validation.id,
                        action: ValidationAction.SUBMITTED_CORRECTION,
                        comment: "El postulante envió la subsanación solicitada.",
                    },
                });
                corrections.push({ departmentCode: validation.department.code, validationHistoryId: history.id });
            }

            await new ApplicationStatusCalculatorService(integrationService).recalculate(applicationId, tx, (preparedId) => { integrationId = preparedId; });
        });
        if (integrationId) await integrationService.processAfterCommit(integrationId);
        if (integrationId) await new AssociateProvisioningService().provisionCompletedApplication(applicationId);
        return corrections;
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
