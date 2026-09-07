import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

type PlanGroup = { canonicalId: number; canonicalName: string; duplicateIds: number[]; referencesToMove: number };
type Plan = { universities: PlanGroup[]; reviewRequired: unknown[]; simulation: { referencesToMove: number } };

const prisma = new PrismaClient();
const PLAN = "config/academic-residual-duplicates.final-plan.json";
const REPORT = "reports/academic-residual-duplicates-execution.json";
const SNAPSHOT = "reports/academic-residual-duplicates-before.json";

function hasFlag(name: string): boolean { return process.argv.includes(name); }

async function main(): Promise<void> {
  const root = process.cwd();
  const now = new Date().toISOString();
  const writeReport = async (value: unknown) => {
    await mkdir(path.join(root, "reports"), { recursive: true });
    await writeFile(path.join(root, REPORT), JSON.stringify(value, null, 2) + "\n", "utf8");
  };
  if (!hasFlag("--execute") || !hasFlag("--confirm-academic-residual-duplicates")) {
    throw new Error("Se requieren --execute y --confirm-academic-residual-duplicates para escribir.");
  }
  const plan = JSON.parse(await readFile(path.join(root, PLAN), "utf8")) as Plan;
  const groups = plan.universities;
  const duplicateIds = groups.flatMap((group) => group.duplicateIds);
  const expectedUpdates = plan.simulation.referencesToMove;
  const expectedDeactivations = duplicateIds.length;
  const uniqueDuplicateIds = new Set(duplicateIds);
  const duplicateOverlap = duplicateIds.length !== uniqueDuplicateIds.size;
  const [totalBefore, nullBefore, allBefore, duplicateRows, canonicalRows, degreeBefore] = await Promise.all([
    prisma.academicInfo.count(),
    prisma.academicInfo.count({ where: { universityId: null } }),
    prisma.academicInfo.findMany({ select: { id: true, degreeId: true, degreeTitle: true } }),
    prisma.university.findMany({ where: { id: { in: duplicateIds } }, select: { id: true, isActive: true } }),
    prisma.university.findMany({ where: { id: { in: groups.map((group) => group.canonicalId) } }, select: { id: true, isActive: true } }),
    prisma.academicInfo.findMany({ select: { id: true, degreeId: true, degreeTitle: true } }),
  ]);
  const duplicateMap = new Map(duplicateRows.map((row) => [row.id, row]));
  const canonicalMap = new Map(canonicalRows.map((row) => [row.id, row]));
  const precheckErrors: string[] = [];
  if (groups.length !== 14) precheckErrors.push(`groups=${groups.length}, esperado=14`);
  if (duplicateIds.length !== 17 || duplicateOverlap) precheckErrors.push(`duplicateIds=${duplicateIds.length}, únicos=${uniqueDuplicateIds.size}, esperado=17`);
  if (expectedUpdates !== 69) precheckErrors.push(`expectedUpdates=${expectedUpdates}, esperado=69`);
  if (plan.reviewRequired.length !== 0) precheckErrors.push(`reviewRequired=${plan.reviewRequired.length}`);
  if (duplicateRows.length !== expectedDeactivations) precheckErrors.push("faltan duplicateIds en catálogo");
  if (canonicalRows.length !== groups.length) precheckErrors.push("faltan canonicalIds en catálogo");
  if (duplicateRows.some((row) => !row.isActive)) precheckErrors.push("hay duplicateIds ya inactivos");
  if (canonicalRows.some((row) => !row.isActive)) precheckErrors.push("hay canonicalIds inactivos");
  for (const group of groups) if (group.canonicalId === undefined || group.duplicateIds.includes(group.canonicalId)) precheckErrors.push(`grupo inválido canonical=${group.canonicalId}`);
  if (allBefore.length !== 5130) precheckErrors.push(`AcademicInfo=${allBefore.length}, esperado=5130`);
  const refsBefore = await prisma.academicInfo.groupBy({ by: ["universityId"], where: { universityId: { in: duplicateIds } }, _count: { _all: true } });
  const refsByDuplicate = new Map(refsBefore.map((row) => [row.universityId as number, row._count._all]));
  const countedRefs = duplicateIds.reduce((sum, id) => sum + (refsByDuplicate.get(id) ?? 0), 0);
  if (countedRefs !== expectedUpdates) precheckErrors.push(`referencias=${countedRefs}, esperado=${expectedUpdates}`);
  if (precheckErrors.length) {
    await writeReport({ timestamp: now, mode: "ABORTED_PRECHECK", status: "ABORTED", errors: precheckErrors, writesExecuted: false });
    throw new Error(`Precheck abortado: ${precheckErrors.join("; ")}`);
  }
  const affected = await prisma.academicInfo.findMany({ where: { universityId: { in: duplicateIds } }, select: { id: true, universityId: true } });
  await mkdir(path.join(root, "reports"), { recursive: true });
  await writeFile(path.join(root, SNAPSHOT), JSON.stringify({ timestamp: now, rows: affected.map((row) => ({ academicInfoId: row.id, universityIdBefore: row.universityId, targetCanonicalId: groups.find((group) => group.duplicateIds.includes(row.universityId as number))?.canonicalId ?? null })) }, null, 2) + "\n", "utf8");
  let updated = 0;
  let deactivated = 0;
  try {
    await prisma.$transaction(async (tx) => {
      for (const group of groups) {
        for (const duplicateId of group.duplicateIds) {
          const result = await tx.academicInfo.updateMany({ where: { universityId: duplicateId }, data: { universityId: group.canonicalId } });
          updated += result.count;
        }
      }
      if (updated !== expectedUpdates) throw new Error(`updates=${updated}, esperado=${expectedUpdates}`);
      const remaining = await tx.academicInfo.count({ where: { universityId: { in: duplicateIds } } });
      if (remaining !== 0) throw new Error(`referencias restantes=${remaining}`);
      const result = await tx.university.updateMany({ where: { id: { in: duplicateIds }, isActive: true }, data: { isActive: false } });
      deactivated = result.count;
      if (deactivated !== expectedDeactivations) throw new Error(`desactivaciones=${deactivated}, esperado=${expectedDeactivations}`);
      const activeCanonicals = await tx.university.count({ where: { id: { in: groups.map((group) => group.canonicalId) }, isActive: true } });
      if (activeCanonicals !== groups.length) throw new Error(`canonicals activos=${activeCanonicals}`);
      if (await tx.academicInfo.count() !== totalBefore) throw new Error("cambió el total de AcademicInfo");
      if (await tx.academicInfo.count({ where: { universityId: null } }) !== nullBefore) throw new Error("aumentaron universityId null");
    });
  } catch (error) {
    await writeReport({ timestamp: now, mode: "EXECUTE", status: "ROLLED_BACK", expectedUpdates, actualUpdates: updated, expectedDeactivations, actualDeactivations: deactivated, rollback: true, errors: [error instanceof Error ? error.message : String(error)] });
    throw error;
  }
  const [totalAfter, nullAfter, duplicateRefsAfter, canonicalAfter, degreeAfter] = await Promise.all([
    prisma.academicInfo.count(),
    prisma.academicInfo.count({ where: { universityId: null } }),
    prisma.academicInfo.count({ where: { universityId: { in: duplicateIds } } }),
    prisma.university.count({ where: { id: { in: groups.map((group) => group.canonicalId) }, isActive: true } }),
    prisma.academicInfo.findMany({ select: { id: true, degreeId: true, degreeTitle: true } }),
  ]);
  const degreeSignature = (rows: Array<{ id: number; degreeId: number | null; degreeTitle: string | null }>) => rows.map((row) => `${row.id}|${row.degreeId ?? ""}|${row.degreeTitle ?? ""}`).sort().join("\n");
  const degreeUnchanged = degreeSignature(allBefore) === degreeSignature(degreeAfter);
  await writeReport({ timestamp: now, mode: "EXECUTE", status: "COMMITTED", plan: PLAN, expectedUpdates, actualUpdates: updated, expectedDeactivations, actualDeactivations: deactivated, duplicateReferencesRemaining: duplicateRefsAfter, canonicalIdsActive: canonicalAfter === groups.length, academicInfoBefore: totalBefore, academicInfoAfter: totalAfter, universityIdNullBefore: nullBefore, universityIdNullAfter: nullAfter, degreeIdChanged: !degreeUnchanged, degreeTitleChanged: !degreeUnchanged, rollback: false, errors: [] });
  console.log(JSON.stringify({ status: "COMMITTED", expectedUpdates, actualUpdates: updated, expectedDeactivations, actualDeactivations: deactivated, duplicateReferencesRemaining: duplicateRefsAfter, academicInfoBefore: totalBefore, academicInfoAfter: totalAfter, universityIdNullBefore: nullBefore, universityIdNullAfter: nullAfter, canonicalsActive: canonicalAfter === groups.length, degreeIdChanged: !degreeUnchanged, degreeTitleChanged: !degreeUnchanged, report: REPORT, snapshot: SNAPSHOT }, null, 2));
}

main().catch((error: unknown) => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
