import { prisma } from "@/lib/prisma";
import { sponsorEligibilityWhere } from "./SponsorEligibility";

export class ValidateSponsorService {
  public async execute(documentNumber: string) {
    // Buscamos a la persona que cumpla estrictamente con ser Asociado Activo Hábil
    // (COMPLETED + ACTIVO + PAGADO). No se exige cuenta de usuario.
    const person = await prisma.person.findFirst({
      where: sponsorEligibilityWhere(documentNumber),
      include: {
        user: true,
        contacts: { orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }] },
      },
    });

    if (!person) {
      return null;
    }

    const contactEmail =
      person.contacts.find((contact) => contact.isPrimary)?.email ||
      person.contacts[0]?.email;

    return {
      id: person.id,
      documentNumber: person.documentNumber,
      fullName: `${person.firstName} ${person.paternalLastName} ${person.maternalLastName || ""}`.trim(),
      email: person.user?.email || contactEmail || "Sin correo",
      sponsorCode: `A-${person.id.toString().padStart(4, '0')}` // Generamos un código temporal basado en su ID
    };
  }
}
