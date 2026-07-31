import { NextRequest, NextResponse } from "next/server";
import { ExpedienteRepository } from "@/modules/afiliaciones/expedientes/Repositories/ExpedienteRepository";

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const page = parseInt(searchParams.get("page") || "1");
        const pageSize = parseInt(searchParams.get("pageSize") || "12");
        const search = searchParams.get("search") || undefined;
        const status = searchParams.get("status") || undefined;

        const repository = new ExpedienteRepository();
        const result = await repository.getPaginated({ page, pageSize, search, status });

        return NextResponse.json({ success: true, ...result }, { status: 200 });
    } catch (error: any) {
        return NextResponse.json(
            { success: false, message: "Error al obtener los expedientes." },
            { status: 500 }
        );
    }
}