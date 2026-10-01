import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  universityFindMany: vi.fn(),
  specialtyFindMany: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    university: { findMany: mocks.universityFindMany },
    specialty: { findMany: mocks.specialtyFindMany },
  },
}));

import { GET as getSpecialties } from "@/app/api/catalogs/specialties/route";
import { GET as getUniversities } from "@/app/api/catalogs/universities/route";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("catálogo de especialidades para Estudiante", () => {
  it("devuelve únicamente las 3 especialidades canónicas por código", async () => {
    mocks.specialtyFindMany.mockResolvedValue([
      { id: 1, code: "ESP-MIN", name: "Ingeniería de Minas" },
      { id: 2, code: "ESP-GEO", name: "Ingeniería Geológica" },
      { id: 3, code: "ESP-MET", name: "Ingeniería Metalúrgica" },
    ]);

    const response = await getSpecialties(new NextRequest("http://localhost/api/catalogs/specialties?student=true"));
    const body = await response.json();

    expect(body).toHaveLength(3);
    expect(mocks.specialtyFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { code: { in: ["ESP-MIN", "ESP-GEO", "ESP-MET"] } } }),
    );
  });

  it("sin ?student=true conserva el listado de especialidades activas", async () => {
    mocks.specialtyFindMany.mockResolvedValue([{ id: 9, name: "Derecho" }]);

    await getSpecialties(new NextRequest("http://localhost/api/catalogs/specialties"));

    expect(mocks.specialtyFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { isActive: true } }),
    );
  });
});

describe("catálogo de instituciones para Estudiante", () => {
  it("filtra institutos y entidades no universitarias para Estudiante", async () => {
    mocks.universityFindMany.mockResolvedValue([
      { id: 2, name: "Universidad Nacional de Ingeniería" },
      { id: 91, name: "SENATI" },
      { id: 92, name: "TECSUP" },
      { id: 94, name: "CIBERTEC" },
      { id: 106, name: "IESTP República Federal de Alemania" },
    ]);

    const response = await getUniversities(new NextRequest("http://localhost/api/catalogs/universities?student=true"));
    const body = await response.json();

    expect(body.map((item: { name: string }) => item.name)).toEqual([
      "Universidad Nacional de Ingeniería",
    ]);
  });

  it("sin ?student=true conserva el listado completo de instituciones activas", async () => {
    mocks.universityFindMany.mockResolvedValue([
      { id: 2, name: "Universidad Nacional de Ingeniería" },
      { id: 91, name: "SENATI" },
    ]);

    const response = await getUniversities(new NextRequest("http://localhost/api/catalogs/universities"));
    const body = await response.json();

    expect(body).toHaveLength(2);
  });
});
