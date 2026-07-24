export interface PersonalInformation {

    /**
     * Identificación
     */
    documentType: string;
    documentNumber: string;

    /**
     * Datos personales
     */
    names: string;
    fatherLastName: string;
    motherLastName: string;
    birthDate: string;
    gender: string;

    /**
     * Contacto
     */
    phone: string;
    primaryEmail: string;
    secondaryEmail?: string;

    /**
     * Ubicación
     */
    countryId: number;
    departmentId?: number;
    provinceId?: number;
    districtId?: number;
    address: string;

    /**
     * Documentos
     */
    photo?: File | null;
    identityDocument?: File | null;

    /**
     * Estado de la validación de identidad
     */
    identityVerified: boolean;

}