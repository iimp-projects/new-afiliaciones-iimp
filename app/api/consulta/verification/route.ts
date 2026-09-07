import { VerificationError } from "@/modules/shared/Models/VerificationError";
import { NextResponse } from "next/server";
import { QueryVerificationService } from "@/modules/afiliaciones/consulta/Services/QueryVerificationService";

export async function POST(request: Request) {
  try {
    return NextResponse.json(await new QueryVerificationService().lookup(await request.json()), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ message: error instanceof VerificationError ? error.message : "No se pudo preparar la consulta." }, { status: 400 });
  }
}
