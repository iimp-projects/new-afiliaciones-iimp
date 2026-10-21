import { prisma } from "@/lib/prisma";
import type { CreateTestimonialDTO } from "../DTOs/PublicTestimonialDTO";

export class CreateTestimonialService {
  async execute(input: CreateTestimonialDTO) {
    const cleanDni = input.documentNumber.trim();

    // 1. Vincular automáticamente con Person si existe en la BD
    const person = await prisma.person.findFirst({
      where: { documentNumber: cleanDni },
      select: { id: true, firstName: true, paternalLastName: true },
    });

    // 2. Crear testimonio con isApproved: false para moderación previa
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const newTestimonial = await (prisma as any).associateTestimonial.create({
      data: {
        documentNumber: cleanDni,
        personId: person ? person.id : null,
        fullName: input.fullName.trim(),
        category: input.category,
        role: input.role.trim(),
        institution: input.institution.trim(),
        content: input.content.trim(),
        isApproved: false, // Requiere aprobación previa de moderación
        isFeatured: false,
      },
    });

    return {
      success: true,
      message: "Testimonio recibido con éxito. Será publicado tras la moderación.",
      id: newTestimonial.id,
    };
  }
}
