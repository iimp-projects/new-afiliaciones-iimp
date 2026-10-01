import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isLikelyUniversityName } from '@/modules/afiliaciones/postulacion/StudentAcademicRules';

export async function GET(request: NextRequest) {
  try {
    const student = request.nextUrl.searchParams.get('student') === 'true';

    const universities = await prisma.university.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true }
    });

    if (student) {
      const filtered = universities.filter((u) => isLikelyUniversityName(u.name));
      return NextResponse.json(filtered);
    }

    return NextResponse.json(universities);
  } catch (error) {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
