import { NextResponse } from "next/server";
import { PaymentAmountResolver } from "@/modules/afiliaciones/payments/Services/PaymentAmountResolver";
import { SystemSettingsError } from "@/modules/security/system-settings/Services/SystemSettingsService";

export async function GET() {
  try {
    const amount = await new PaymentAmountResolver().resolve();
    return NextResponse.json(amount, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof SystemSettingsError) {
      return NextResponse.json({ message: "El monto no está disponible en este momento." }, { status: 503 });
    }
    console.error("[PAYMENTS] Error resolviendo el monto:", error);
    return NextResponse.json({ message: "No se pudo resolver el monto." }, { status: 500 });
  }
}
