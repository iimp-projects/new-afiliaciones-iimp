import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

type PlanItem = { canonicalId: number; duplicateIds: number[]; academicInfoAffected: number };
type Plan = { universities: PlanItem[]; specialties: PlanItem[] };
type DegreeSnapshot = { id: number; degreeId: number | null; degreeTitle: string | null };

const prisma = new PrismaClient();
const root = process.cwd();
const execute = process.argv.includes("--execute");
const confirm = process.argv.includes("--confirm-academic-consolidation");

const compareDegrees = (before: DegreeSnapshot[], after: DegreeSnapshot[]) => {
  if (before.length !== after.length) return false;
  const current = new Map(after.map((item) => [item.id, item]));
  return before.every((item) => current.get(item.id)?.degreeId === item.degreeId && current.get(item.id)?.degreeTitle === item.degreeTitle);
};

async function report(value: unknown) {
  await writeFile(path.join(root, "reports", "academic-consolidation-execution.json"), JSON.stringify(value, null, 2) + "\n", "utf8");
}

async function main(): Promise<void> {
  if (execute !== confirm) throw new Error("La escritura requiere ambos flags: --execute y --confirm-academic-consolidation");
  const plan = JSON.parse(await readFile(path.join(root, "config", "academic-consolidation.approved-plan.v2.json"), "utf8")) as Plan;
  const universityIds = plan.universities.flatMap((item) => item.duplicateIds);
  const specialtyIds = plan.specialties.flatMap((item) => item.duplicateIds);
  const expected = { universities: plan.universities.reduce((sum, item) => sum + item.academicInfoAffected, 0), specialties: plan.specialties.reduce((sum, item) => sum + item.academicInfoAffected, 0) };
  if (expected.universities !== 102 || expected.specialties !== 955 || expected.universities + expected.specialties !== 1057) throw new Error(`El plan no coincide con los conteos aprobados: ${JSON.stringify(expected)}`);
  const [beforeCount, beforeNullUniversity, beforeNullSpecialty, beforeDegrees, existingUniversities, existingSpecialties] = await Promise.all([
    prisma.academicInfo.count(),
    prisma.academicInfo.count({ where: { universityId: null } }),
    prisma.academicInfo.count({ where: { specialtyId: null } }),
    prisma.academicInfo.findMany({ select: { id: true, degreeId: true, degreeTitle: true } }),
    prisma.university.findMany({ where: { id: { in: [...new Set([...universityIds, ...plan.universities.map((item) => item.canonicalId)])] } }, select: { id: true } }),
    prisma.specialty.findMany({ where: { id: { in: [...new Set([...specialtyIds, ...plan.specialties.map((item) => item.canonicalId)])] } }, select: { id: true } }),
  ]);
  if (beforeCount !== 5130) throw new Error(`AcademicInfo total inesperado: ${beforeCount}`);
  if (new Set(universityIds).size !== universityIds.length || new Set(specialtyIds).size !== specialtyIds.length) throw new Error("duplicateId repetido en el plan");
  if (plan.universities.some((item) => item.duplicateIds.includes(item.canonicalId)) || plan.specialties.some((item) => item.duplicateIds.includes(item.canonicalId))) throw new Error("canonicalId y duplicateId coinciden");
  const universitySet = new Set(existingUniversities.map((item) => item.id));
  const specialtySet = new Set(existingSpecialties.map((item) => item.id));
  if (plan.universities.some((item) => !universitySet.has(item.canonicalId) || item.duplicateIds.some((id) => !universitySet.has(id)))) throw new Error("University ID inexistente en plan");
  if (plan.specialties.some((item) => !specialtySet.has(item.canonicalId) || item.duplicateIds.some((id) => !specialtySet.has(id)))) throw new Error("Specialty ID inexistente en plan");
  const affected = await prisma.academicInfo.findMany({ where: { OR: [{ universityId: { in: universityIds } }, { specialtyId: { in: specialtyIds } }] }, select: { id: true, universityId: true, specialtyId: true } });
  await writeFile(path.join(root, "reports", "academic-consolidation-before.json"), JSON.stringify({ generatedAt: new Date().toISOString(), readOnlySnapshot: true, rows: affected }, null, 2) + "\n", "utf8");
  const [universityRefs, specialtyRefs] = await Promise.all([
    Promise.all(plan.universities.map((item) => prisma.academicInfo.count({ where: { universityId: { in: item.duplicateIds } } }))),
    Promise.all(plan.specialties.map((item) => prisma.academicInfo.count({ where: { specialtyId: { in: item.duplicateIds } } }))),
  ]);
  const precheck = { universities: universityRefs.reduce((a, b) => a + b, 0), specialties: specialtyRefs.reduce((a, b) => a + b, 0) };
  if (precheck.universities !== expected.universities || precheck.specialties !== expected.specialties) throw new Error(`Precheck de referencias no coincide: ${JSON.stringify(precheck)} vs ${JSON.stringify(expected)}`);
  const base = { timestamp: new Date().toISOString(), mode: execute ? "EXECUTE" : "DRY_RUN", planFile: "config/academic-consolidation.approved-plan.v2.json", academicInfoBefore: beforeCount, expected: { university: 102, specialty: 955, total: 1057 }, nullsBefore: { universityId: beforeNullUniversity, specialtyId: beforeNullSpecialty }, degreeIdChanged: false, degreeTitleChanged: false };
  if (!execute) {
    await report({ ...base, academicInfoAfter: beforeCount, updated: { university: 0, specialty: 0, total: 0 }, nullsAfter: { universityId: beforeNullUniversity, specialtyId: beforeNullSpecialty }, duplicateIdsRemaining: precheck, rollback: false, status: "DRY_RUN" });
    console.log(JSON.stringify({ ...base, status: "DRY_RUN", simulated: precheck }, null, 2));
    return;
  }
  try {
    const committed = await prisma.$transaction(async (tx) => {
      let universityUpdated = 0;
      let specialtyUpdated = 0;
      for (const item of plan.universities) universityUpdated += (await tx.academicInfo.updateMany({ where: { universityId: { in: item.duplicateIds } }, data: { universityId: item.canonicalId } })).count;
      if (universityUpdated !== expected.universities) throw new Error(`University updates ${universityUpdated}/${expected.universities}`);
      for (const item of plan.specialties) specialtyUpdated += (await tx.academicInfo.updateMany({ where: { specialtyId: { in: item.duplicateIds } }, data: { specialtyId: item.canonicalId } })).count;
      if (specialtyUpdated !== expected.specialties) throw new Error(`Specialty updates ${specialtyUpdated}/${expected.specialties}`);
      const [afterCount, afterNullUniversity, afterNullSpecialty, duplicateUniversity, duplicateSpecialty, afterDegrees] = await Promise.all([
        tx.academicInfo.count(),
        tx.academicInfo.count({ where: { universityId: null } }),
        tx.academicInfo.count({ where: { specialtyId: null } }),
        tx.academicInfo.count({ where: { universityId: { in: universityIds } } }),
        tx.academicInfo.count({ where: { specialtyId: { in: specialtyIds } } }),
        tx.academicInfo.findMany({ select: { id: true, degreeId: true, degreeTitle: true } }),
      ]);
      if (afterCount !== 5130 || afterNullUniversity !== beforeNullUniversity || afterNullSpecialty !== beforeNullSpecialty || duplicateUniversity !== 0 || duplicateSpecialty !== 0 || !compareDegrees(beforeDegrees, afterDegrees)) throw new Error("Postcheck falló; rollback");
      return { afterCount, afterNullUniversity, afterNullSpecialty, duplicateUniversity, duplicateSpecialty, universityUpdated, specialtyUpdated };
    });
    await report({ ...base, academicInfoAfter: committed.afterCount, updated: { university: committed.universityUpdated, specialty: committed.specialtyUpdated, total: committed.universityUpdated + committed.specialtyUpdated }, nullsAfter: { universityId: committed.afterNullUniversity, specialtyId: committed.afterNullSpecialty }, duplicateIdsRemaining: { university: committed.duplicateUniversity, specialty: committed.duplicateSpecialty }, rollback: false, status: "COMMITTED" });
    console.log(JSON.stringify({ ...base, status: "COMMITTED", updated: { university: committed.universityUpdated, specialty: committed.specialtyUpdated, total: committed.universityUpdated + committed.specialtyUpdated } }, null, 2));
  } catch (error) {
    await report({ ...base, academicInfoAfter: null, updated: { university: 0, specialty: 0, total: 0 }, rollback: true, status: "ROLLED_BACK", errors: [error instanceof Error ? error.message : String(error)] });
    throw error;
  }
}

main().catch((error: unknown) => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
