import { NextResponse } from "next/server";
import { z } from "zod";
import { contextService } from "@/modules/auth/context/service";
import { AssociateProfileService } from "@/modules/afiliaciones/portal/Services/AssociateProfileService";
import { profileAddressSchema } from "@/modules/afiliaciones/portal/Validators/ProfileAddressSchema";
export async function PATCH(request: Request) { try { const user = await contextService.requireAffiliate(); const data = await new AssociateProfileService().updateAddress(user.id, profileAddressSchema.parse(await request.json())); return NextResponse.json({ success: true, data }); } catch (error) { return NextResponse.json({ success: false, message: error instanceof z.ZodError ? "Verifica los datos de dirección." : error instanceof Error ? error.message : "No fue posible actualizar la dirección." }, { status: error instanceof z.ZodError ? 400 : 403 }); } }
