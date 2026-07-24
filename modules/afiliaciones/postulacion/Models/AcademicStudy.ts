export interface AcademicStudy {

    /**
     * Identificador de la institución.
     */
    institutionId?: number;

    /**
     * Nombre de la institución cuando se selecciona "Otra".
     */
    otherInstitution?: string;

    /**
     * Nombre del título o diploma.
     */
    degreeTitle: string;

    /**
     * Especialidad.
     */
    specialty: string;

    /**
     * Colegio profesional.
     */
    professionalAssociation?: string;

    /**
     * Número de colegiatura.
     */
    registrationNumber?: string;

    /**
     * Año de ingreso.
     */
    admissionYear?: number;

    /**
     * Año de egreso.
     */
    graduationYear?: number;

    /**
     * Tiempo laborando en el sector.
     */
    sectorExperience?: string;

    /**
     * Observaciones.
     */
    observations?: string;

    /**
     * Carta universitaria.
     */
    universityLetter?: File | null;

    /**
     * Aceptación para estudiantes.
     */
    studentTermsAccepted?: boolean;

}