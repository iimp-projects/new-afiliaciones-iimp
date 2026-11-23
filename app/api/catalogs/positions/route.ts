import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const positions = await prisma.jobPosition.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    });
    return NextResponse.json(positions);
  } catch {
    return NextResponse.json({ message: "No se pudieron cargar los cargos." }, { status: 500 });
  }
}
