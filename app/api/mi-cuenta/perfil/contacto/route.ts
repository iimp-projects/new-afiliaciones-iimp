import { NextResponse } from "next/server";
import { z } from "zod";
import { contextService } from "@/modules/auth/context/service";
import { AssociateProfileService } from "@/modules/afiliaciones/portal/Services/AssociateProfileService";
const schema = z.object({ primaryPhone: z.string().trim().min(6).max(50).regex(/^[0-9+()\-\s]+$/), secondaryEmail: z.string().trim().email().max(150).nullable() }).strict();
export async function PATCH(request: Request) { try { const user = await contextService.requireAffiliate(); const data = await new AssociateProfileService().updateContact(user.id, schema.parse(await request.json())); return NextResponse.json({ success: true, data }); } catch (error) { return NextResponse.json({ success: false, message: error instanceof z.ZodError ? "Verifica los datos de contacto." : error instanceof Error ? error.message : "No fue posible actualizar el contacto." }, { status: error instanceof z.ZodError ? 400 : 403 }); } }
