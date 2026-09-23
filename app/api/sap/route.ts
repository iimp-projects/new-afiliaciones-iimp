import { NextResponse } from "next/server";
import { contextService } from "@/modules/auth/context/service";
import { SapService } from "@/modules/shared/Services/SapService";

export async function GET() {
  try {
    const user = await contextService.getCurrentUser();
    if (!user) {
      return NextResponse.json({ success: false, message: "No autenticado." }, { status: 401 });
    }

    await contextService.requireRole(["SUPER_ADMIN"]);

    const sapService = new SapService();
    const sessionId = await sapService.login();

    if (!sessionId) {
      return NextResponse.json(
        { success: false, message: "No se pudo verificar la conexión con SAP." },
        { status: 502 },
      );
    }

    await sapService.logout(sessionId);
    return NextResponse.json({ success: true, message: "Conexión con SAP verificada." });
  } catch (error: unknown) {
    const status = error instanceof Error && "status" in error
      ? Number((error as { status: number }).status)
      : 500;
    return NextResponse.json(
      { success: false, message: status === 403 ? "No autorizado." : "No se pudo verificar la conexión con SAP." },
      { status },
    );
  }
}
