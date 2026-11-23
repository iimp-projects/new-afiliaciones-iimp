import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const companies = await prisma.company.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    });
    return NextResponse.json(companies);
  } catch {
    return NextResponse.json({ message: "No se pudieron cargar las empresas." }, { status: 500 });
  }
}
