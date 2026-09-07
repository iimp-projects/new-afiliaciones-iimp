import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { MasterDataRepository } from "@/modules/master-data/Repositories/MasterDataRepository";

export async function GET() {
  try {
    const result = await new MasterDataRepository(prisma).list("DEGREE", {
      page: 1, pageSize: 100, status: "ACTIVE", canonicalOnly: true,
      sortBy: "name", sortOrder: "asc",
    });
    return NextResponse.json({ data: result.data.map(degree => ({
      id: degree.id, name: degree.name,
      studyLevel: "studyLevel" in degree ? degree.studyLevel : undefined,
    })) }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ message: "No se pudieron cargar los grados académicos." }, { status: 500 });
  }
}
