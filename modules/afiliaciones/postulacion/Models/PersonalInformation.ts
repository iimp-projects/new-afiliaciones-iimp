export interface UploadedFile {
    url: string;
    name: string;
    type: string;
}


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
    departmentId?: number | null;
    provinceId?: number | null;   
    districtId?: number | null;
    address: string;
    foreignRegion?: string | null;
    foreignCity?: string | null;

    /**
     * Documentos
     */
    photo?: File | UploadedFile | null;
    photoUrl?: string;
    identityDocument?: File | UploadedFile | null;

    /**
     * Estado de la validación de identidad
     */
    identityVerified: boolean;

}
