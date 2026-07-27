import { NextRequest, NextResponse } from "next/server";
import { DeclarationPdfService } from "@/modules/afiliaciones/postulacion/Services/DeclarationPdfService";
import type { ApplicationDraft } from "@/modules/afiliaciones/postulacion/Models/ApplicationDraft";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const draft = body.draft as ApplicationDraft;

    if (!draft) {
      return NextResponse.json({ message: "No se proporcionó información para generar el PDF." }, { status: 400 });
    }

    // Instanciamos el servicio (Arquitectura limpia)
    const pdfService = new DeclarationPdfService();
    
    // Obtiene el Uint8Array desde Puppeteer
    const pdfData = await pdfService.generate(draft);

    // SOLUCIÓN TS: Usamos "as any" para evitar el choque de tipos entre Node (ArrayBufferLike) y el DOM (BlobPart).
    // A nivel de ejecución (JavaScript), Uint8Array es perfectamente válido aquí.
    const pdfBlob = new Blob([pdfData as any], { type: "application/pdf" });

    return new NextResponse(pdfBlob, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="Solicitud_Afiliacion_IIMP.pdf"',
      },
    });

  } catch (error: any) {
    console.error("[GeneratePDF Route] Error:", error);
    return NextResponse.json(
      { message: "Error interno al generar el documento PDF." }, 
      { status: 500 }
    );
  }
}