import { NextResponse } from "next/server";
import { z } from "zod";
import { contextService } from "@/modules/auth/context/service";
import { AssociateProfileService } from "@/modules/afiliaciones/portal/Services/AssociateProfileService";
const id = z.number().int().positive().nullable(); const schema = z.object({ street: z.string().trim().min(3).max(255), reference: z.string().trim().max(255).nullable(), countryId: id, districtId: id }).strict();
export async function PATCH(request: Request) { try { const user = await contextService.requireAffiliate(); const data = await new AssociateProfileService().updateAddress(user.id, schema.parse(await request.json())); return NextResponse.json({ success: true, data }); } catch (error) { return NextResponse.json({ success: false, message: error instanceof z.ZodError ? "Verifica los datos de dirección." : error instanceof Error ? error.message : "No fue posible actualizar la dirección." }, { status: error instanceof z.ZodError ? 400 : 403 }); } }
