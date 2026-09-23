import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiAuthorizationStatus, requireApiPermission } from "@/modules/auth/context/api-authorization";

export async function GET() {
  try {
    await requireApiPermission("read", "memberships");
    const comiteUsers = await prisma.user.findMany({
      where: { 
        role: { slug: "COMITE_EVALUADOR" }, 
        status: "ACTIVE" 
      },
      select: {
        id: true,
        email: true,
        person: { select: { firstName: true, paternalLastName: true } }
      }
    });

    const formattedData = comiteUsers.map(u => ({
      id: u.id,
      name: `${u.person?.firstName} ${u.person?.paternalLastName}`,
      email: u.email
    }));

    return NextResponse.json({ success: true, data: formattedData });
  } catch (error: unknown) {
    const status = apiAuthorizationStatus(error, 500);
    return NextResponse.json({ success: false, error: status < 500 ? "No autorizado." : "Error al obtener miembros del comité." }, { status });
  }
}
