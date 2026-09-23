import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const root = process.cwd();
const execute = process.argv.includes("--execute");
const confirm = process.argv.includes("--confirm-deactivate-safe-invalids");

function normalize(value: string): string { return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " "); }
function extractAcademicDraft(value: unknown): unknown {
  if (!value || typeof value !== "object") return null;
  const data = value as Record<string, unknown>;
  const studies = data.academicStudies;
  return Array.isArray(studies) ? studies : null;
}

async function main(): Promise<void> {
  if (execute !== confirm) throw new Error("La desactivación requiere --execute y --confirm-deactivate-safe-invalids");
  const invalidReport = JSON.parse(await readFile(path.join(root, "reports", "residual-invalid-academic-values.json"), "utf8"));
  const plan = JSON.parse(await readFile(path.join(root, "config", "academic-consolidation.approved-plan.v2.json"), "utf8"));
  const safeUniversities = invalidReport.universities.filter((item: { recommendedAction: string }) => item.recommendedAction === "SAFE_TO_DEACTIVATE");
  const safeSpecialties = invalidReport.specialties.filter((item: { recommendedAction: string }) => item.recommendedAction === "SAFE_TO_DEACTIVATE");
  if (safeUniversities.length !== 32 || safeSpecialties.length !== 1 || safeSpecialties[0]?.id !== 412) throw new Error("Los candidatos SAFE no coinciden con 32 universidades y specialty 412");
  const universityIds: number[] = safeUniversities.map((item: { id: number }) => item.id);
  const specialtyIds: number[] = safeSpecialties.map((item: { id: number }) => item.id);
  const canonicalIds = new Set<number>([...plan.universities.map((item: { canonicalId: number }) => item.canonicalId), ...plan.specialties.map((item: { canonicalId: number }) => item.canonicalId)]);
  if (universityIds.some((id) => canonicalIds.has(id)) || specialtyIds.some((id) => canonicalIds.has(id))) throw new Error("Un inválido SAFE coincide con canonical aprobado");
  const [universities, specialties, universityRefs, specialtyRefs, excludedUniversity, excludedSpecialties] = await Promise.all([
    prisma.university.findMany({ where: { id: { in: universityIds } }, select: { id: true, name: true, isActive: true } }),
    prisma.specialty.findMany({ where: { id: { in: specialtyIds } }, select: { id: true, name: true, isActive: true } }),
    prisma.academicInfo.count({ where: { universityId: { in: universityIds } } }),
    prisma.academicInfo.count({ where: { specialtyId: { in: specialtyIds } } }),
    prisma.university.findUnique({ where: { id: 911 }, select: { id: true, name: true, isActive: true } }),
    prisma.specialty.findMany({ where: { id: { in: [254,267,279,284,298,361,368,387,390,412,418,462,485,506,526,528,561,573,588,595,607,610,617,674,685,687,711,732,738,756,802,833,834,856,863,904,920] } }, select: { id: true, name: true, isActive: true } }),
  ]);
  if (universities.length !== 32 || specialties.length !== 1 || universities.some((item) => !item.isActive) || specialties.some((item) => !item.isActive) || universityRefs !== 0 || specialtyRefs !== 0) throw new Error("Precheck SAFE inválido falló");
  if (!excludedUniversity?.isActive || excludedSpecialties.some((item) => item.id !== 412 && !item.isActive)) throw new Error("Un caso excluido no está activo");

  const referencedAcademic = await prisma.academicInfo.findMany({ where: { OR: [{ universityId: 911 }, { specialtyId: { in: excludedSpecialties.filter((item) => item.id !== 412).map((item) => item.id) } }] }, select: { id: true, personId: true, universityId: true, specialtyId: true, degreeTitle: true, studyLevel: true, university: { select: { id: true, name: true } }, specialty: { select: { id: true, name: true } }, person: { select: { id: true, firstName: true, paternalLastName: true, maternalLastName: true, applications: { select: { id: true, applicationCode: true, status: true, draftData: true } } } } } });
  const activeSpecialties = await prisma.specialty.findMany({ where: { isActive: true }, select: { id: true, name: true } });
  const manualRecords = referencedAcademic.map((academic) => {
    const studies = academic.person.applications.flatMap((application) => (extractAcademicDraft(application.draftData) as Array<Record<string, unknown>> | null) ?? []);
    const draftSpecialties = studies.map((study) => typeof study.specialty === "string" ? study.specialty : null).filter((value): value is string => Boolean(value));
    const candidate = draftSpecialties.map((value) => activeSpecialties.find((item) => normalize(item.name) === normalize(value) && normalize(value) !== normalize(academic.specialty?.name ?? ""))).find(Boolean) ?? null;
    return { entityType: academic.universityId === 911 ? "University" : "Specialty", invalidId: academic.universityId === 911 ? 911 : academic.specialtyId, invalidValue: academic.universityId === 911 ? "." : academic.specialty?.name, academicInfoId: academic.id, personId: academic.personId, universityId: academic.universityId, specialtyId: academic.specialtyId, degreeTitle: academic.degreeTitle, studyLevel: academic.studyLevel, personName: [academic.person.firstName, academic.person.paternalLastName, academic.person.maternalLastName].filter(Boolean).join(" "), applications: academic.person.applications.map((application) => ({ id: application.id, applicationCode: application.applicationCode, status: application.status, academicStudies: extractAcademicDraft(application.draftData) })), candidateCanonical: candidate, confidence: candidate ? "HIGH_CONFIDENCE_REASSIGN" : "UNRESOLVED", recommendedAction: candidate ? "REASSIGN_MANUALLY" : "KEEP_UNRESOLVED" };
  });
  await writeFile(path.join(root, "reports", "manual-reassignment-invalid-academic-values.json"), JSON.stringify({ generatedAt: new Date().toISOString(), readOnly: true, records: manualRecords, summary: { highConfidenceReassign: manualRecords.filter((item) => item.confidence === "HIGH_CONFIDENCE_REASSIGN").length, reviewRequired: manualRecords.filter((item) => item.confidence === "REVIEW_REQUIRED").length, unresolved: manualRecords.filter((item) => item.confidence === "UNRESOLVED").length } }, null, 2) + "\n", "utf8");
  const base = { timestamp: new Date().toISOString(), mode: "EXECUTE", expected: { university: 32, specialty: 1 }, referencesBefore: { university: 0, specialty: 0 } };
  const committed = await prisma.$transaction(async (tx) => {
    const universityUpdated = (await tx.university.updateMany({ where: { id: { in: universityIds }, isActive: true }, data: { isActive: false } })).count;
    if (universityUpdated !== 32) throw new Error(`Universidades actualizadas ${universityUpdated}/32`);
    const specialtyUpdated = (await tx.specialty.updateMany({ where: { id: { in: specialtyIds }, isActive: true }, data: { isActive: false } })).count;
    if (specialtyUpdated !== 1) throw new Error(`Especialidades actualizadas ${specialtyUpdated}/1`);
    const [activeU, activeS, refsU, refsS, excludedUAfter, excludedSAfter] = await Promise.all([tx.university.count({ where: { id: { in: universityIds }, isActive: true } }), tx.specialty.count({ where: { id: { in: specialtyIds }, isActive: true } }), tx.academicInfo.count({ where: { universityId: { in: universityIds } } }), tx.academicInfo.count({ where: { specialtyId: { in: specialtyIds } } }), tx.university.findUnique({ where: { id: 911 }, select: { isActive: true } }), tx.specialty.count({ where: { id: { in: [254,267,279,284,298,361,368,387,390,412,418,462,485,506,526,528,561,573,588,595,607,610,617,674,685,687,711,732,738,756,802,833,834,856,863,904,920] }, isActive: true } })]);
    if (activeU !== 0 || activeS !== 0 || refsU !== 0 || refsS !== 0 || !excludedUAfter?.isActive || excludedSAfter !== 36) throw new Error("Postcheck de inválidos SAFE falló");
    return { universityUpdated, specialtyUpdated, activeU, activeS, refsU, refsS };
  });
  await writeFile(path.join(root, "reports", "residual-invalid-deactivation-execution.json"), JSON.stringify({ ...base, updated: committed, rollback: false, status: "COMMITTED", manualRecords: manualRecords.length }, null, 2) + "\n", "utf8");
  console.log(JSON.stringify({ ...base, updated: committed, manual: { highConfidenceReassign: manualRecords.filter((item) => item.confidence === "HIGH_CONFIDENCE_REASSIGN").length, reviewRequired: manualRecords.filter((item) => item.confidence === "REVIEW_REQUIRED").length, unresolved: manualRecords.filter((item) => item.confidence === "UNRESOLVED").length } }, null, 2));
}

main().catch((error: unknown) => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
