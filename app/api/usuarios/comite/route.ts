import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
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
  } catch (error) {
    return NextResponse.json({ success: false, error: "Error al obtener miembros del comité." }, { status: 500 });
  }
}