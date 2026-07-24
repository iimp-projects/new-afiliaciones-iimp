export interface EmploymentInformation {

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