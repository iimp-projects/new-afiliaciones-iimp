import { NextResponse } from "next/server";
import { GetPublicTestimonialsService } from "@/modules/afiliaciones/testimonios/Services/GetPublicTestimonialsService";
import { CreateTestimonialService } from "@/modules/afiliaciones/testimonios/Services/CreateTestimonialService";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const service = new GetPublicTestimonialsService();
    const data = await service.execute();
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("Error al obtener testimonios:", error);
    return NextResponse.json(
      { success: false, message: "Error al cargar testimonios" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body.documentNumber || !body.fullName || !body.content) {
      return NextResponse.json(
        { success: false, message: "Campos requeridos incompletos (documentNumber, fullName, content)" },
        { status: 400 }
      );
    }

    const service = new CreateTestimonialService();
    const result = await service.execute({
      documentNumber: String(body.documentNumber),
      fullName: String(body.fullName),
      category: body.category === "ASOCIADO ACTIVO" ? "ASOCIADO ACTIVO" : "ASOCIADO ESTUDIANTE",
      role: String(body.role || ""),
      institution: String(body.institution || ""),
      content: String(body.content),
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error al registrar testimonio:", error);
    return NextResponse.json(
      { success: false, message: "Error al registrar testimonio" },
      { status: 500 }
    );
  }
}
