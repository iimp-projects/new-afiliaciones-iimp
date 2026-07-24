export interface Endorsement {

    /**
     * DNI ingresado por el postulante.
     */
    sponsorDocumentNumber: string;

    /**
     * Persona encontrada durante la búsqueda.
     */
    sponsorPersonId?: number;

    /**
     * Código del asociado.
     */
    sponsorCode?: string;

    /**
     * Nombre completo.
     */
    sponsorFullName?: string;

    /**
     * Correo electrónico.
     */
    sponsorEmail?: string;

}