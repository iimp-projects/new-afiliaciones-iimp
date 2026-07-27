export type ValidationFlowStatus = 
  | 'NEW'        // Caso 1: Persona nueva, habilitar formulario
  | 'DRAFT'      // Caso 2: Borrador encontrado, lanzar modal OTP
  | 'ASSOCIATE'  // Caso 3: Ya es asociado activo, mostrar error
  | 'REJECTED'   // Caso 4: Postulaci n anterior rechazada, reutilizar persona, iniciar nueva
  | 'APPROVED';  // Caso 5: Postulaci n aprobada (pendiente de pago/alta), comportarse como asociado

export interface ValidationResponseDTO {
  status: ValidationFlowStatus;
  message: string;
  trackingCode: string | null;
  email: string | null;
  person: {
    id: number;
    documentType: string;
    documentNumber: string;
    firstName: string;
    paternalLastName: string;
    maternalLastName: string | null;
  } | null;
}