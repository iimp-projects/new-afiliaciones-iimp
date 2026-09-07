import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

type Item = { canonicalId: number; duplicateIds: number[] };
type Plan = { universities: Item[]; specialties: Item[] };
const prisma = new PrismaClient();
const root = process.cwd();
const execute = process.argv.includes("--execute");
const confirm = process.argv.includes("--confirm-deactivate-academic-duplicates");

function fingerprint(rows: Array<{ id: number; universityId: number | null; specialtyId: number | null; degreeId: number | null; degreeTitle: string | null }>): string {
  return createHash("sha256").update(JSON.stringify(rows.sort((a, b) => a.id - b.id))).digest("hex");
}

async function writeReport(value: unknown) {
  await writeFile(path.join(root, "reports", "academic-duplicate-deactivation-execution.json"), JSON.stringify(value, null, 2) + "\n", "utf8");
}

async function main(): Promise<void> {
  if (execute !== confirm) throw new Error("La desactivación requiere --execute y --confirm-deactivate-academic-duplicates");
  const plan = JSON.parse(await readFile(path.join(root, "config", "academic-consolidation.approved-plan.v2.json"), "utf8")) as Plan;
  const universities = plan.universities;
  const specialties = plan.specialties;
  const universityDuplicateIds = universities.flatMap((item) => item.duplicateIds);
  const specialtyDuplicateIds = specialties.flatMap((item) => item.duplicateIds);
  if (universityDuplicateIds.length !== 65 || specialtyDuplicateIds.length !== 121) throw new Error("El plan no coincide con 65/121 duplicateIds aprobados");
  if (new Set(universityDuplicateIds).size !== 65 || new Set(specialtyDuplicateIds).size !== 121) throw new Error("duplicateId repetido en el plan");
  const [duplicateUniversities, duplicateSpecialties, academicBefore] = await Promise.all([
    prisma.university.findMany({ where: { id: { in: universityDuplicateIds } }, select: { id: true, isActive: true } }),
    prisma.specialty.findMany({ where: { id: { in: specialtyDuplicateIds } }, select: { id: true, isActive: true } }),
    prisma.academicInfo.findMany({ select: { id: true, universityId: true, specialtyId: true, degreeId: true, degreeTitle: true } }),
  ]);
  if (duplicateUniversities.length !== 65 || duplicateSpecialties.length !== 121) throw new Error("Faltan registros duplicateId en la base");
  if (duplicateUniversities.some((item) => !item.isActive) || duplicateSpecialties.some((item) => !item.isActive)) throw new Error("Hay duplicateIds ya inactivos; se aborta para evitar conteos parciales");
  const [universityRefs, specialtyRefs] = await Promise.all([prisma.academicInfo.count({ where: { universityId: { in: universityDuplicateIds } } }), prisma.academicInfo.count({ where: { specialtyId: { in: specialtyDuplicateIds } } })]);
  if (universityRefs !== 0 || specialtyRefs !== 0) throw new Error(`Referencias inesperadas: universities=${universityRefs}, specialties=${specialtyRefs}`);
  const canonicalUniversityIds = universities.map((item) => item.canonicalId);
  const canonicalSpecialtyIds = specialties.map((item) => item.canonicalId);
  const [canonicalUniversities, canonicalSpecialties] = await Promise.all([prisma.university.findMany({ where: { id: { in: canonicalUniversityIds } }, select: { id: true, isActive: true } }), prisma.specialty.findMany({ where: { id: { in: canonicalSpecialtyIds } }, select: { id: true, isActive: true } })]);
  if (canonicalUniversities.length !== canonicalUniversityIds.length || canonicalSpecialties.length !== canonicalSpecialtyIds.length || canonicalUniversities.some((item) => !item.isActive) || canonicalSpecialties.some((item) => !item.isActive)) throw new Error("Canonical inactivo o inexistente");
  const beforeSnapshot = { generatedAt: new Date().toISOString(), rows: [...duplicateUniversities.map((item) => ({ entity: "University", duplicateId: item.id, canonicalId: universities.find((group) => group.duplicateIds.includes(item.id))?.canonicalId ?? null, isActiveBefore: item.isActive, references: 0 })), ...duplicateSpecialties.map((item) => ({ entity: "Specialty", duplicateId: item.id, canonicalId: specialties.find((group) => group.duplicateIds.includes(item.id))?.canonicalId ?? null, isActiveBefore: item.isActive, references: 0 }))] };
  await writeFile(path.join(root, "reports", "academic-duplicate-deactivation-before.json"), JSON.stringify(beforeSnapshot, null, 2) + "\n", "utf8");
  const base = { timestamp: new Date().toISOString(), mode: "EXECUTE", expected: { universities: 65, specialties: 121 }, referencesBefore: { universities: universityRefs, specialties: specialtyRefs }, academicInfoBefore: academicBefore.length };
  try {
    const committed = await prisma.$transaction(async (tx) => {
      const universityUpdated = (await tx.university.updateMany({ where: { id: { in: universityDuplicateIds }, isActive: true }, data: { isActive: false } })).count;
      if (universityUpdated !== 65) throw new Error(`Universities actualizadas ${universityUpdated}/65`);
      const specialtyUpdated = (await tx.specialty.updateMany({ where: { id: { in: specialtyDuplicateIds }, isActive: true }, data: { isActive: false } })).count;
      if (specialtyUpdated !== 121) throw new Error(`Especialidades actualizadas ${specialtyUpdated}/121`);
      const [activeUniversities, activeSpecialties, refsUniversityAfter, refsSpecialtyAfter, canonU, canonS, academicAfter] = await Promise.all([
        tx.university.count({ where: { id: { in: universityDuplicateIds }, isActive: true } }),
        tx.specialty.count({ where: { id: { in: specialtyDuplicateIds }, isActive: true } }),
        tx.academicInfo.count({ where: { universityId: { in: universityDuplicateIds } } }),
        tx.academicInfo.count({ where: { specialtyId: { in: specialtyDuplicateIds } } }),
        tx.university.count({ where: { id: { in: canonicalUniversityIds }, isActive: true } }),
        tx.specialty.count({ where: { id: { in: canonicalSpecialtyIds }, isActive: true } }),
        tx.academicInfo.findMany({ select: { id: true, universityId: true, specialtyId: true, degreeId: true, degreeTitle: true } }),
      ]);
      if (activeUniversities !== 0 || activeSpecialties !== 0 || refsUniversityAfter !== 0 || refsSpecialtyAfter !== 0 || canonU !== canonicalUniversityIds.length || canonS !== canonicalSpecialtyIds.length || academicAfter.length !== academicBefore.length || fingerprint(academicAfter) !== fingerprint(academicBefore)) throw new Error("Postcheck falló; rollback");
      return { universityUpdated, specialtyUpdated, activeUniversities, activeSpecialties, refsUniversityAfter, refsSpecialtyAfter, canonU, canonS, academicAfter: academicAfter.length };
    });
    await writeReport({ ...base, updated: { universities: committed.universityUpdated, specialties: committed.specialtyUpdated, total: committed.universityUpdated + committed.specialtyUpdated }, activeDuplicateIdsAfter: { universities: committed.activeUniversities, specialties: committed.activeSpecialties }, referencesAfter: { universities: committed.refsUniversityAfter, specialties: committed.refsSpecialtyAfter }, canonicalsActive: { universities: committed.canonU, specialties: committed.canonS }, academicInfoAfter: committed.academicAfter, academicInfoModified: false, rollback: false, status: "COMMITTED", errors: [] });
    console.log(JSON.stringify({ ...base, status: "COMMITTED", updated: { universities: committed.universityUpdated, specialties: committed.specialtyUpdated, total: committed.universityUpdated + committed.specialtyUpdated } }, null, 2));
  } catch (error) {
    await writeReport({ ...base, updated: { universities: 0, specialties: 0, total: 0 }, rollback: true, status: "ROLLED_BACK", errors: [error instanceof Error ? error.message : String(error)] });
    throw error;
  }
}

main().catch((error: unknown) => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
