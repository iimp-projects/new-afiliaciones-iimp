import { NextRequest, NextResponse } from "next/server";
import { ApisNetPeService } from "@/modules/shared/Services/ApisNetPeService";

export async function POST(request: NextRequest) {
  try {
    const { ruc } = await request.json();
    if (!ruc || ruc.length !== 11) {
      return NextResponse.json({ message: "RUC inválido." }, { status: 400 });
    }

    const apiService = new ApisNetPeService();
    const companyData = await apiService.getRuc(ruc);

    if (!companyData) {
      return NextResponse.json({ message: "No se encontró información para el RUC ingresado." }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: companyData });
  } catch (error: any) {
    return NextResponse.json({ message: error.message || "Error al consultar RUC." }, { status: 500 });
  }
}