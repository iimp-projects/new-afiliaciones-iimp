import { NextResponse } from "next/server";
import { CampaignSendService, CAMPAIGN_SEND_SYSTEM_ACTOR } from "@/modules/communications/Services/CampaignSendService";

const TICK_SECRET_HEADER = "x-campaign-send-tick-secret";

/**
 * Disparador server-side del motor de envío masivo, independiente de la sesión
 * y del navegador. Un scheduler (systemd/EventBridge) invoca este endpoint con
 * un secreto compartido; internamente procesa un lote por cada campaña SENDING.
 *
 * El navegador NO ejecuta lotes: solo consulta el progreso (getCampaignSendProgressAction).
 */
export async function POST(request: Request): Promise<NextResponse> {
  const secret = process.env.CAMPAIGN_SEND_TICK_SECRET;
  const provided = request.headers.get(TICK_SECRET_HEADER);
  if (!secret || provided !== secret) {
    return NextResponse.json({ message: "No autorizado." }, { status: 401 });
  }

  try {
    const result = await new CampaignSendService().processAllSendingCampaigns(CAMPAIGN_SEND_SYSTEM_ACTOR);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "No se pudo ejecutar el tick." }, { status: 500 });
  }
}
