export type EmploymentStatus = "EMPLOYED" | "SELF_EMPLOYED" | "NOT_WORKING";

export interface EmploymentInformation {
    employmentStatus?: EmploymentStatus;

    /**
     * Profesional independiente.
     */
    isIndependent: boolean;

    /**
     * Actualmente no labora.
     */
    isUnemployed: boolean;

    /**
     * Empresa o institución.
     */
    companyId?: number;

    /**
     * Nombre de empresa cuando no exista en el catálogo.
     */
    companyName?: string;

    /**
     * Área o departamento.
     */
    area?: string;

    /**
     * Cargo.
     */
    positionId?: number;

    /**
     * Nombre del cargo cuando no exista en catálogo.
     */
    positionName?: string;

    /**
     * RUC.
     */
    companyTaxId?: string;

    /**
     * Teléfono.
     */
    workPhone?: string;

    /**
     * Anexo.
     */
    workExtension?: string;

    /**
     * Correo corporativo.
     */
    workEmail?: string;

    /**
     * Dirección laboral.
     */
    workingAddress?: string;

}

export function resolveEmploymentStatus(data?: Partial<EmploymentInformation>): EmploymentStatus | undefined {
    if (!data) return undefined;
    if (data.employmentStatus === "EMPLOYED" || data.employmentStatus === "SELF_EMPLOYED" || data.employmentStatus === "NOT_WORKING") return data.employmentStatus;
    if (data.isUnemployed) return "NOT_WORKING";
    if (data.isIndependent) return "SELF_EMPLOYED";
    if (data.companyName || data.companyTaxId || data.positionName || data.workEmail || data.workPhone) return "EMPLOYED";
    return undefined;
}

export function normalizeEmploymentInformation(data: EmploymentInformation): EmploymentInformation {
    const employmentStatus = resolveEmploymentStatus(data);
    const base = { ...data, employmentStatus, isIndependent: employmentStatus === "SELF_EMPLOYED", isUnemployed: employmentStatus === "NOT_WORKING" };
    if (employmentStatus === "NOT_WORKING") {
        return { employmentStatus, isIndependent: false, isUnemployed: true, companyId: undefined, companyName: "", area: "", positionId: undefined, positionName: "", companyTaxId: "", workPhone: "", workExtension: "", workEmail: "", workingAddress: "" };
    }
    if (employmentStatus === "SELF_EMPLOYED") {
        return { ...base, companyId: undefined, positionId: undefined, workExtension: "" };
    }
    return base;
}
