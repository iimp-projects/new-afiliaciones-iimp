export interface Declaration {
    /**
     * Aceptación de la Declaración Jurada.
     */
    declarationAccepted: boolean;

    /**
     * URL del documento firmado (Ficha + Declaración Jurada en un único PDF).
     */
    declarationDocumentId?: string;
}
