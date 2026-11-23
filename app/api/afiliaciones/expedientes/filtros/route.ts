import { NextResponse } from "next/server";
import { ApplicationStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { apiAuthorizationStatus, requireApiPermission } from "@/modules/auth/context/api-authorization";

const APPLICATION_WHERE = {
  deletedAt: null,
  status: { not: ApplicationStatus.DRAFT },
} satisfies Prisma.MembershipApplicationWhereInput;

const APPLICATION_EXISTS = { some: APPLICATION_WHERE } satisfies Prisma.MembershipApplicationListRelationFilter;

export async function GET() {
  try {
    await requireApiPermission("read", "applications");

    const [countries, universities, catalogCompanies, companyRows, validationUsers, areaValidationUsers] = await Promise.all([
      prisma.country.findMany({
        where: { addresses: { some: { person: { applications: APPLICATION_EXISTS } } } },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
      prisma.university.findMany({
        where: { academicInfos: { some: { person: { applications: APPLICATION_EXISTS } } } },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
      prisma.company.findMany({
        where: { isActive: true },
        select: { name: true },
        orderBy: { name: "asc" },
      }),
      prisma.$queryRaw<Array<{ name: string }>>(Prisma.sql`
        SELECT DISTINCT TRIM("draftData"->'employmentInformation'->>'companyName') AS name
        FROM membership_applications
        WHERE "deletedAt" IS NULL
          AND status::text <> 'DRAFT'
          AND "draftData"->'employmentInformation'->>'companyName' IS NOT NULL
          AND TRIM("draftData"->'employmentInformation'->>'companyName') <> ''
        ORDER BY name ASC
        LIMIT 1500
      `),
      prisma.membershipValidation.findMany({
        where: { validatedById: { not: null }, application: APPLICATION_WHERE },
        distinct: ["validatedById"],
        select: {
          validatedById: true,
          validatedBy: {
            select: { id: true, name: true, person: { select: { firstName: true, paternalLastName: true } } },
          },
        },
      }),
      prisma.membershipAreaValidation.findMany({
        where: { validatedById: { not: null }, application: APPLICATION_WHERE },
        distinct: ["validatedById"],
        select: {
          validatedById: true,
          validatedBy: {
            select: { id: true, name: true, person: { select: { firstName: true, paternalLastName: true } } },
          },
        },
      }),
    ]);

    const evaluators = new Map<number, { value: string; label: string }>();
    for (const record of [...validationUsers, ...areaValidationUsers]) {
      const user = record.validatedBy;
      if (!user?.id || evaluators.has(user.id)) continue;
      const personName = `${user.person?.firstName || ""} ${user.person?.paternalLastName || ""}`.trim();
      evaluators.set(user.id, { value: String(user.id), label: personName || user.name || `Usuario ${user.id}` });
    }

    const companyNames = new Map<string, string>();
    for (const name of [...catalogCompanies.map((company) => company.name), ...companyRows.map((row) => row.name)]) {
      const trimmed = name?.trim();
      if (!trimmed) continue;
      const key = trimmed.toLocaleLowerCase("es");
      if (!companyNames.has(key)) companyNames.set(key, trimmed);
    }

    return NextResponse.json({
      success: true,
      data: {
        countries: countries.map((country) => ({ value: String(country.id), label: country.name })),
        universities: universities.map((university) => ({ value: String(university.id), label: university.name })),
        companies: Array.from(companyNames.values())
          .sort((a, b) => a.localeCompare(b, "es"))
          .map((name) => ({ value: name, label: name })),
        evaluators: Array.from(evaluators.values()).sort((a, b) => a.label.localeCompare(b.label, "es")),
      },
    });
  } catch (error: unknown) {
    const status = apiAuthorizationStatus(error, 500);
    return NextResponse.json(
      { success: false, message: status < 500 ? "No autorizado." : "Error al obtener las opciones de filtros." },
      { status },
    );
  }
}
