import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requireApiPermission } from "@/modules/auth/context/api-authorization";
import { siteCreateSchema } from "@/modules/afiliaciones/control-accesos/Validators/access.schemas";
import { accessQueryService } from "@/modules/afiliaciones/control-accesos/Services/AccessQueryService";
import { prismaAccessRepository } from "@/modules/afiliaciones/control-accesos/Repositories/PrismaAccessRepository";
import { accessApiError } from "@/modules/afiliaciones/control-accesos/Utils/apiError";

export async function GET() {
  try {
    await requireApiPermission("read", "access_control");
    const data = await accessQueryService.sites();
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return accessApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    await requireApiPermission("manage", "access_control");
    const body = await request.json().catch(() => null);
    const parsed = siteCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, message: "Datos inválidos.", errors: parsed.error.flatten() }, { status: 400 });
    }
    const data = await prismaAccessRepository.createSite(parsed.data);
    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ success: false, message: "Ya existe una sede con ese código." }, { status: 409 });
    }
    return accessApiError(error);
  }
}
