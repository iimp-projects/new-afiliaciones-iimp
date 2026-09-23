import { describe, expect, it } from "vitest";
import { seedAcademicDegrees } from "./academic-degrees.seed";

type Degree = { id: number; code: string | null; name: string; studyLevel: string; isActive: boolean };

function createPrisma(rows: Degree[]) {
  let nextId = 521;
  const academicDegree = {
    findMany: async () => rows.map(({ id, code, name, isActive }) => ({ id, code, name, isActive })),
    update: async ({ where, data }: { where: { id: number }; data: Partial<Degree> }) => {
      const row = rows.find((item) => item.id === where.id)!;
      Object.assign(row, data);
      return row;
    },
    create: async ({ data }: { data: Omit<Degree, "id"> }) => {
      const row = { id: nextId++, ...data };
      rows.push(row);
      return row;
    },
  };

  return {
    $transaction: async (callback: (tx: { academicDegree: typeof academicDegree }) => Promise<void>) => callback({ academicDegree }),
  };
}

describe("seedAcademicDegrees", () => {
  it("normalizes the six approved records without changing IDs, levels, or creating duplicates", async () => {
    const rows: Degree[] = [
      { id: 425, code: null, name: "Bachiller", studyLevel: "BACHELOR", isActive: true },
      { id: 517, code: "TECHNICAL", name: "Técnico", studyLevel: "TECHNICAL", isActive: true },
      { id: 518, code: "PROFESSIONAL_TITLE", name: "Título profesional", studyLevel: "OTHER", isActive: true },
      { id: 32, code: null, name: "Maestría", studyLevel: "MASTER", isActive: true },
      { id: 519, code: "DOCTORATE", name: "Doctorado", studyLevel: "DOCTORATE", isActive: true },
      { id: 520, code: "OTHER", name: "Otro", studyLevel: "OTHER", isActive: true },
      { id: 1, code: null, name: "Histórico no canónico", studyLevel: "BACHELOR", isActive: true },
    ];
    const prisma = createPrisma(rows);
    const before = rows.map((row) => ({ id: row.id, name: row.name, studyLevel: row.studyLevel }));

    await seedAcademicDegrees(prisma as never);
    await seedAcademicDegrees(prisma as never);

    expect(rows).toHaveLength(7);
    expect(rows.filter((row) => ["BACH", "TECHNICAL", "PROFESSIONAL_TITLE", "MAG", "DOCTORATE", "OTHER"].includes(row.code ?? ""))).toHaveLength(6);
    expect(rows.filter((row) => row.name === "Bachiller")).toEqual([expect.objectContaining({ id: 425, code: "BACH" })]);
    expect(rows.filter((row) => row.name === "Maestría")).toEqual([expect.objectContaining({ id: 32, code: "MAG" })]);
    expect(rows.map((row) => ({ id: row.id, name: row.name, studyLevel: row.studyLevel }))).toEqual(before);
  });
});
