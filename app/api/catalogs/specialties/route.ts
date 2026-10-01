import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { STUDENT_ALLOWED_SPECIALTY_CODES } from '@/modules/afiliaciones/postulacion/StudentAcademicRules';

export async function GET(request: NextRequest) {
  try {
    const student = request.nextUrl.searchParams.get('student') === 'true';

    if (student) {
      const specialties = await prisma.specialty.findMany({
        where: { code: { in: [...STUDENT_ALLOWED_SPECIALTY_CODES] } },
        orderBy: { code: 'asc' },
        select: { id: true, name: true, code: true },
      });
      return NextResponse.json(specialties);
    }

    const specialties = await prisma.specialty.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true }
    });
    return NextResponse.json(specialties);
  } catch (error) {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
