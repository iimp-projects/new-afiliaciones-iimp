import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma'; // Asegúrate de que esta ruta apunte a tu instancia de Prisma

export async function GET() {
  try {
    const countries = await prisma.country.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, isoCode: true }
    });
    
    return NextResponse.json(countries);
  } catch (error) {
    console.error("Error fetching countries:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}