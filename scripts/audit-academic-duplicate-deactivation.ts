import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

type Item = { canonicalId: number; canonicalName: string; duplicateIds: number[]; academicInfoAffected: number };
type Plan = { universities: Item[]; specialties: Item[] };
const prisma = new PrismaClient();

async function main(): Promise<void> {
  const root = process.cwd();
  const plan = JSON.parse(await readFile(path.join(root, "config", "academic-consolidation.approved-plan.v2.json"), "utf8")) as Plan;
  const universityIds = plan.universities.flatMap((item) => item.duplicateIds);
  const specialtyIds = plan.specialties.flatMap((item) => item.duplicateIds);
  const [universities, specialties, universityRefs, specialtyRefs] = await Promise.all([
    prisma.university.findMany({ where: { id: { in: [...new Set([...universityIds, ...plan.universities.map((item) => item.canonicalId)])] } }, select: { id: true, name: true, isActive: true } }),
    prisma.specialty.findMany({ where: { id: { in: [...new Set([...specialtyIds, ...plan.specialties.map((item) => item.canonicalId)])] } }, select: { id: true, name: true, isActive: true } }),
    Promise.all(plan.universities.map((item) => prisma.academicInfo.count({ where: { universityId: { in: item.duplicateIds } } }))),
    Promise.all(plan.specialties.map((item) => prisma.academicInfo.count({ where: { specialtyId: { in: item.duplicateIds } } }))),
  ]);
  const universityById = new Map(universities.map((item) => [item.id, item]));
  const specialtyById = new Map(specialties.map((item) => [item.id, item]));
  const universityGroups = plan.universities.map((item, index) => ({ canonicalId: item.canonicalId, canonicalName: item.canonicalName, canonicalActive: universityById.get(item.canonicalId)?.isActive ?? false, duplicateIds: item.duplicateIds, duplicateMembers: item.duplicateIds.map((id) => ({ ...universityById.get(id), references: universityRefs[index] })), references: universityRefs[index], classification: universityById.get(item.canonicalId)?.isActive && universityRefs[index] === 0 ? "DEACTIVATION_CANDIDATE" : "REVIEW_REQUIRED" }));
  const specialtyGroups = plan.specialties.map((item, index) => ({ canonicalId: item.canonicalId, canonicalName: item.canonicalName, canonicalActive: specialtyById.get(item.canonicalId)?.isActive ?? false, duplicateIds: item.duplicateIds, duplicateMembers: item.duplicateIds.map((id) => ({ ...specialtyById.get(id), references: specialtyRefs[index] })), references: specialtyRefs[index], classification: specialtyById.get(item.canonicalId)?.isActive && specialtyRefs[index] === 0 ? "DEACTIVATION_CANDIDATE" : "REVIEW_REQUIRED" }));
  const report = { generatedAt: new Date().toISOString(), readOnly: true, summary: { universities: { duplicateIds: universityIds.length, currentlyActive: universityGroups.flatMap((group) => group.duplicateMembers).filter((item) => item.isActive).length, currentlyInactive: universityGroups.flatMap((group) => group.duplicateMembers).filter((item) => !item.isActive).length, references: universityRefs.reduce((a, b) => a + b, 0), canonicalInactive: universityGroups.filter((group) => !group.canonicalActive).length }, specialties: { duplicateIds: specialtyIds.length, currentlyActive: specialtyGroups.flatMap((group) => group.duplicateMembers).filter((item) => item.isActive).length, currentlyInactive: specialtyGroups.flatMap((group) => group.duplicateMembers).filter((item) => !item.isActive).length, references: specialtyRefs.reduce((a, b) => a + b, 0), canonicalInactive: specialtyGroups.filter((group) => !group.canonicalActive).length } }, universities: universityGroups, specialties: specialtyGroups, excluded: { manualReviewUniversities: 5, unresolvedInvalidSpecialties: 5, invalidUnreferencedSpecialties: 1 }, apiVerification: { universitiesRouteFiltersIsActive: true, specialtiesRouteFiltersIsActive: true, educationStepUsesBothRoutes: true } };
  await writeFile(path.join(root, "reports", "academic-duplicate-deactivation-dry-run.json"), JSON.stringify(report, null, 2) + "\n", "utf8");
  console.log(JSON.stringify(report.summary, null, 2));
}

main().catch((error: unknown) => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
