import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> } // <-- Tipado como Promesa
) {
  try {
    const { id } = await params; // <-- Desenvolvemos la promesa con await
    const countryId = parseInt(id, 10);
    
    if (isNaN(countryId)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

    const departments = await prisma.department.findMany({
      where: { countryId, isActive: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true }
    });
    
    return NextResponse.json(departments);
  } catch (error) {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}