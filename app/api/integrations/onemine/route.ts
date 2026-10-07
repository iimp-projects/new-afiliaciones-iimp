import { NextResponse } from "next/server";
import { contextService } from "@/modules/auth/context/service";
import { createOneMineSsoUrl } from "@/modules/integrations/onemine/sso";

export async function GET() {
  await contextService.requireAffiliate();

  const secret = process.env.ONEMINE_SSO_SECRET;
  if (!secret?.trim()) {
    return NextResponse.json(
      { success: false, message: "El acceso a OneMine no está configurado. Contacta al administrador." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  return NextResponse.redirect(createOneMineSsoUrl(secret), {
    headers: { "Cache-Control": "no-store, private" },
  });
}
