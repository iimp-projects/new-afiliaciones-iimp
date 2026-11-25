import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requireApiPermission } from "@/modules/auth/context/api-authorization";
import { siteUpdateSchema } from "@/modules/afiliaciones/control-accesos/Validators/access.schemas";
import { prismaAccessRepository } from "@/modules/afiliaciones/control-accesos/Repositories/PrismaAccessRepository";
import { accessApiError } from "@/modules/afiliaciones/control-accesos/Utils/apiError";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireApiPermission("manage", "access_control");
    const id = Number((await params).id);
    if (!Number.isInteger(id) || id < 1) {
      return NextResponse.json({ success: false, message: "Identificador inválido." }, { status: 400 });
    }
    const body = await request.json().catch(() => null);
    const parsed = siteUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, message: "Datos inválidos.", errors: parsed.error.flatten() }, { status: 400 });
    }
    const data = await prismaAccessRepository.updateSite(id, parsed.data);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return NextResponse.json({ success: false, message: "Sede no encontrada." }, { status: 404 });
    }
    return accessApiError(error);
  }
}
