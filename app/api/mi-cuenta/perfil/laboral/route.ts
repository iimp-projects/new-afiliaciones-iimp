import { NextResponse } from "next/server";
import { z } from "zod";
import { contextService } from "@/modules/auth/context/service";
import { AssociateProfileService } from "@/modules/afiliaciones/portal/Services/AssociateProfileService";
import { prisma } from "@/lib/prisma";
const text = z.string().trim().max(255).nullable();
const schema = z.object({ companyId: z.number().int().positive(), positionId: z.number().int().positive().nullable(), area: text, workingAddress: text, workPhone: z.string().trim().max(50).nullable(), workExtension: z.string().trim().max(20).nullable(), workEmail: z.string().trim().email().max(150).nullable() }).strict();
export async function PATCH(request: Request) { try { const user = await contextService.requireAffiliate(); const data = await new AssociateProfileService().updateEmployment(user.id, schema.parse(await request.json())); return NextResponse.json({ success: true, data }); } catch (error) { return NextResponse.json({ success: false, message: error instanceof z.ZodError ? "Verifica la información laboral." : error instanceof Error ? error.message : "No fue posible actualizar la información laboral." }, { status: error instanceof z.ZodError ? 400 : 403 }); } }
export async function GET() { try { await contextService.requireAffiliate(); const [companies, positions] = await Promise.all([prisma.company.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }), prisma.jobPosition.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } })]); return NextResponse.json({ success: true, data: { companies, positions } }); } catch { return NextResponse.json({ success: false, message: "No autorizado." }, { status: 403 }); } }
