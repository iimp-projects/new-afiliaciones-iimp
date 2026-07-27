import { ApplicationStatus, DocumentType, UserType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ValidationResponseDTO } from "../DTOs/validation-response.dto";
import { ApisNetPeService } from "@/modules/shared/Services/ApisNetPeService";

export class ValidateDocumentService {
  private readonly externalApi = new ApisNetPeService();

  public async execute(documentType: DocumentType, documentNumber: string): Promise<ValidationResponseDTO> {
    
    // 1. Buscamos a la persona si existe (para asociados activos o trámites antiguos aprobados)
    const person = await prisma.person.findUnique({
      where: { documentType_documentNumber: { documentType, documentNumber } },
      include: { user: true },
    });

    // 2. Buscamos la última postulación directamente en las solicitudes (porque los borradores no tienen person_id aún)
    const lastApp = await prisma.membershipApplication.findFirst({
      where: { documentType, documentNumber },
      orderBy: { createdAt: "desc" }
    });

    const personData = person ? {
      id: person.id,
      documentType: person.documentType as string,
      documentNumber: person.documentNumber,
      firstName: person.firstName,
      paternalLastName: person.paternalLastName,
      maternalLastName: person.maternalLastName,
    } : null;

    // ESCENARIO 3: Ya es Asociado Activo
    if (person && person.user && person.user.type === UserType.AFFILIATE) {
      return this.buildResponse("ASSOCIATE", "El documento pertenece a un asociado activo.", null, person.user.email, personData);
    }

    // ESCENARIOS 2, 4 y 5: Encontramos una postulación previa (Borrador, Aprobado, Rechazado)
    if (lastApp) {
        if (lastApp.status === ApplicationStatus.APPROVED) {
            return this.buildResponse("APPROVED", "Su postulación ya fue aprobada.", lastApp.trackingCode, lastApp.email, personData);
        }

        if (lastApp.status === ApplicationStatus.REJECTED || lastApp.status === ApplicationStatus.CANCELLED) {
            return this.buildResponse("REJECTED", "Su última postulación no procedió. Puede iniciar una nueva.", null, null, personData);
        }

        // Si es DRAFT, SUBMITTED o cualquier otro estado en tránsito:
        return this.buildResponse("DRAFT", "Existe una solicitud en proceso.", lastApp.trackingCode, lastApp.email, personData);
    }

    // ==========================================
    // ESCENARIO 1: Persona nueva -> Consultar RENIEC
    // ==========================================
    let firstName = "";
    let paternalLastName = "";
    let maternalLastName = "";

    if (documentType === DocumentType.DNI) {
        const reniecData = await this.externalApi.getDni(documentNumber);
        if (reniecData) {
            firstName = reniecData.nombres;
            paternalLastName = reniecData.apellidoPaterno;
            maternalLastName = reniecData.apellidoMaterno;
        }
    }

    const externalPersonData = {
        id: 0,
        documentType,
        documentNumber,
        firstName,
        paternalLastName,
        maternalLastName,
    };

    return this.buildResponse("NEW", "No existen registros previos. Puede iniciar una nueva postulación.", null, null, externalPersonData);
  }

  private buildResponse(
    status: ValidationResponseDTO["status"],
    message: string,
    trackingCode: string | null = null,
    email: string | null = null,
    person: ValidationResponseDTO["person"] = null
  ): ValidationResponseDTO {
    return { status, message, trackingCode, email, person };
  }
}