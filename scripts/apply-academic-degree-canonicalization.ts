import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { PrismaClient, StudyLevel } from "@prisma/client";

type Plan = {
  generatedAt: string;
  expectedActiveCanonicalCount: number;
  canonicals: Array<{ canonicalId: number | null; name: string; code: string | null; studyLevel: StudyLevel; description: string | null; action: string }>;
  proposedDeactivation: Array<{ id: number; name: string; classification: string; references: number }>;
  reviewRequired: Array<{ id: number; name: string; references: number }>;
};

const prisma = new PrismaClient();
const ROOT = process.cwd();
const PLAN_FILE = path.join(ROOT, "reports", "academic-degree-canonical-plan.json");
const BEFORE_FILE = path.join(ROOT, "reports", "academic-degree-canonicalization-before.json");
const EXECUTION_FILE = path.join(ROOT, "reports", "academic-degree-canonicalization-execution.json");
const EXPECTED_TOTAL = 512;

async function loadPlan(): Promise<Plan> {
  return JSON.parse(await readFile(PLAN_FILE, "utf8")) as Plan;
}

function normalize(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim().replace(/\s+/g, " ");
}

async function main(): Promise<void> {
  const execute = process.argv.includes("--execute");
  const confirmed = process.argv.includes("--confirm-academic-degree-canonicalization");
  const mode = execute && confirmed ? "EXECUTE" : "DRY_RUN";
  const plan = await loadPlan();
  const deactivateIds = plan.proposedDeactivation.map((item) => item.id);
  const reviewIds = plan.reviewRequired.map((item) => item.id);
  if (new Set(deactivateIds).size !== deactivateIds.length || new Set(reviewIds).size !== reviewIds.length) throw new Error("El plan contiene IDs duplicados.");
  if (deactivateIds.some((id) => reviewIds.includes(id))) throw new Error("Un REVIEW_REQUIRED aparece en desactivación.");
  if (deactivateIds.length !== 336 || reviewIds.length !== 174) throw new Error("Los conteos del plan no coinciden con el plan aprobado.");

  const before = await prisma.academicDegree.findMany({ orderBy: { id: "asc" } });
  const academicBefore = await prisma.academicInfo.findMany({ select: { id: true, degreeId: true, degreeTitle: true } });
  const byId = new Map(before.map((item) => [item.id, item]));
  if (before.length !== EXPECTED_TOTAL) throw new Error(`AcademicDegree esperado ${EXPECTED_TOTAL}, actual ${before.length}.`);
  for (const id of [32, 425, ...deactivateIds, ...reviewIds]) if (!byId.has(id)) throw new Error(`ID ${id} no existe.`);
  if (![32, 425].every((id) => byId.get(id)?.isActive)) throw new Error("Los canonicales existentes no están activos.");
  if (deactivateIds.some((id) => !byId.get(id)?.isActive)) throw new Error("Un registro seguro ya estaba inactivo.");
  if (academicBefore.some((item) => item.degreeId !== null && deactivateIds.includes(item.degreeId))) throw new Error("Existe una referencia AcademicInfo inesperada.");
  await mkdir(path.join(ROOT, "reports"), { recursive: true });
  await writeFile(BEFORE_FILE, JSON.stringify({ timestamp: new Date().toISOString(), total: before.length, canonicalIds: [32, 425], deactivateIds, reviewIds, academicInfoDegreeSnapshot: academicBefore }, null, 2) + "\n", "utf8");

  if (mode === "DRY_RUN") {
    console.log(JSON.stringify({ mode, academicDegreeBefore: before.length, expectedCreates: 4, expectedDeactivations: deactivateIds.length, reviewRequiredPreserved: reviewIds.length, academicInfoReferences: academicBefore.filter((item) => item.degreeId !== null).length, requiresFlags: ["--execute", "--confirm-academic-degree-canonicalization"] }, null, 2));
    return;
  }
  if (!execute || !confirmed) throw new Error("La escritura requiere ambos flags explícitos.");

  const timestamp = new Date().toISOString();
  let createdIds: number[] = [];
  try {
    await prisma.$transaction(async (tx) => {
      const current = await tx.academicDegree.findMany({ orderBy: { id: "asc" } });
      if (current.length !== EXPECTED_TOTAL) throw new Error("El total cambió antes de iniciar la transacción.");
      const currentById = new Map(current.map((item) => [item.id, item]));
      if (deactivateIds.some((id) => !currentById.get(id)?.isActive)) throw new Error("Cambió el estado de un registro a desactivar.");
      const refs = await tx.academicInfo.findMany({ where: { degreeId: { in: deactivateIds } }, select: { id: true } });
      if (refs.length > 0) throw new Error(`Hay ${refs.length} referencias inesperadas.`);
      await tx.academicDegree.update({ where: { id: 425 }, data: { name: "Bachiller", studyLevel: StudyLevel.BACHELOR, isActive: true } });
      await tx.academicDegree.update({ where: { id: 32 }, data: { name: "Maestría", studyLevel: StudyLevel.MASTER, isActive: true } });
      const definitions = [
        { name: "Técnico", code: "TECHNICAL", studyLevel: StudyLevel.TECHNICAL, description: "Grado técnico." },
        { name: "Título profesional", code: "PROFESSIONAL_TITLE", studyLevel: StudyLevel.OTHER, description: "Título profesional; se usa OTHER por compatibilidad con el enum StudyLevel actual." },
        { name: "Doctorado", code: "DOCTORATE", studyLevel: StudyLevel.DOCTORATE, description: "Grado de doctorado." },
        { name: "Otro", code: "OTHER", studyLevel: StudyLevel.OTHER, description: "Grado no incluido en las categorías principales." },
      ];
      for (const definition of definitions) {
        const existing = await tx.academicDegree.findFirst({ where: { OR: [{ code: definition.code }, { name: definition.name }] }, select: { id: true } });
        if (existing) throw new Error(`Ya existe un registro equivalente para ${definition.name} (id ${existing.id}).`);
        const created = await tx.academicDegree.create({ data: { name: definition.name, code: definition.code, studyLevel: definition.studyLevel, description: definition.description, isActive: true } });
        createdIds.push(created.id);
      }
      const deactivated = await tx.academicDegree.updateMany({ where: { id: { in: deactivateIds }, isActive: true }, data: { isActive: false } });
      if (deactivated.count !== deactivateIds.length) throw new Error(`Se esperaban ${deactivateIds.length} desactivaciones, se obtuvieron ${deactivated.count}.`);
      const finalRows = await tx.academicDegree.findMany({ orderBy: { id: "asc" } });
      const approvedCanonicalIds = [32, 425, ...createdIds];
      const activeApprovedCanonicals = finalRows.filter((item) => approvedCanonicalIds.includes(item.id) && item.isActive);
      if (finalRows.length !== EXPECTED_TOTAL + definitions.length || activeApprovedCanonicals.length !== 6) throw new Error("El estado final no coincide con el plan aprobado.");
      if (reviewIds.some((id) => !finalRows.find((item) => item.id === id)?.isActive)) throw new Error("Se modificó un REVIEW_REQUIRED.");
      const refsAfter = await tx.academicInfo.findMany({ select: { id: true, degreeId: true, degreeTitle: true } });
      if (JSON.stringify(refsAfter) !== JSON.stringify(academicBefore)) throw new Error("AcademicInfo cambió durante la transacción.");
    });
    await writeFile(EXECUTION_FILE, JSON.stringify({ timestamp, mode, status: "COMMITTED", academicDegreeBefore: before.length, academicDegreeAfter: before.length + 4, canonicalExisting: [32, 425], canonicalCreatedIds: createdIds, expectedCreated: 4, expectedDeactivated: deactivateIds.length, actualDeactivated: deactivateIds.length, reviewRequiredPreserved: reviewIds.length, academicInfoReferencesBefore: academicBefore.filter((item) => item.degreeId !== null).length, academicInfoReferencesAfter: academicBefore.filter((item) => item.degreeId !== null).length, degreeTitleChanged: false, rollback: false, errors: [] }, null, 2) + "\n", "utf8");
    console.log(JSON.stringify({ status: "COMMITTED", createdIds, deactivated: deactivateIds.length, reviewRequiredPreserved: reviewIds.length }, null, 2));
  } catch (error) {
    await writeFile(EXECUTION_FILE, JSON.stringify({ timestamp, mode, status: "ROLLED_BACK", academicDegreeBefore: before.length, canonicalCreatedIds: createdIds, rollback: true, error: error instanceof Error ? error.message : String(error) }, null, 2) + "\n", "utf8");
    throw error;
  }
}

main().catch((error: unknown) => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
