import { NextRequest, NextResponse } from "next/server";
import { ExpedienteRepository } from "@/modules/afiliaciones/expedientes/Repositories/ExpedienteRepository";
import { apiAuthorizationStatus, requireApiPermission } from "@/modules/auth/context/api-authorization";

export async function GET(
    request: NextRequest, 
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        await requireApiPermission("read", "applications");
        const { id } = await params;
        const repository = new ExpedienteRepository();
        
        const expediente = await repository.getById(parseInt(id, 10));

        if (!expediente) {
            return NextResponse.json({ success: false, message: "Expediente no encontrado." }, { status: 404 });
        }

        // SOLUCIÓN PARA BIGINT: 
        // Interceptamos la conversión a JSON y transformamos los BigInt a String
        const jsonPayload = JSON.stringify(
            { success: true, data: expediente },
            (key, value) => (typeof value === "bigint" ? value.toString() : value)
        );

        // Devolvemos una respuesta estándar con nuestro JSON ya sanitizado
        return new NextResponse(jsonPayload, { 
            status: 200,
            headers: { "Content-Type": "application/json" }
        });

    } catch (error: unknown) {
        console.error("[Expediente Detalle API Error]:", error);
        return NextResponse.json(
            { success: false, message: apiAuthorizationStatus(error) < 500 ? "No autorizado." : "Error al obtener el detalle del expediente." },
            { status: apiAuthorizationStatus(error) }
        );
    }
}
