import { prisma } from "@/lib/prisma";
import { UserType, UserStatus } from "@prisma/client";

export class ValidateSponsorService {
  public async execute(documentNumber: string) {
    // Buscamos a la persona que cumpla estrictamente con ser Asociado Activo Hábil
    const person = await prisma.person.findFirst({
      where: {
        documentNumber,
        user: {
          type: UserType.AFFILIATE,
          status: UserStatus.ACTIVE,
          role: {
            slug: "ASOCIADO_ACTIVO"
          }
        }
      },
      include: {
        user: true
      }
    });

    if (!person) {
      return null;
    }

    return {
      id: person.id,
      documentNumber: person.documentNumber,
      fullName: `${person.firstName} ${person.paternalLastName} ${person.maternalLastName || ""}`.trim(),
      email: person.user?.email || "Sin correo",
      sponsorCode: `A-${person.id.toString().padStart(4, '0')}` // Generamos un código temporal basado en su ID
    };
  }
}