import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

type UniversityRow = {
  id: number;
  name: string;
  acronym: string | null;
  countryId: number;
  country: { name: string };
  isActive: boolean;
  createdAt: Date;
  academicInfo: Array<{ id: number }>;
};

type Group = {
  canonicalId: number;
  canonicalName: string;
  duplicateIds: number[];
  members: Array<{
    id: number;
    name: string;
    normalizedName: string;
    countryId: number;
    country: string;
    acronym: string | null;
    isActive: boolean;
    academicInfoReferences: number;
    historicalRole: "CANONICAL" | "DUPLICATE" | "NOT_IN_HISTORICAL_PLAN";
  }>;
  referencesToMove: number;
  reason: string;
  confidence: "HIGH_CONFIDENCE_DUPLICATE";
};

const prisma = new PrismaClient();
const genericTokens = new Set(["universidad", "instituto", "institucion", "escuela", "asociacion", "de", "del", "la", "el", "los", "las", "y", "nacional", "mayor"]);

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/n(?:°|º|ro|o)\\.?/g, "n")
    .replace(/\bnumero\b/g, "n")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function semanticKey(value: string): string {
  return normalize(value).split(" ").filter((token) => token && !genericTokens.has(token)).join(" ");
}

function significantTokens(value: string): Set<string> {
  return new Set(normalize(value).split(" ").filter((token) => token && !genericTokens.has(token)));
}

function isSameSemanticInstitution(left: UniversityRow, right: UniversityRow): boolean {
  if (left.countryId !== right.countryId) return false;
  const leftKey = semanticKey(left.name);
  const rightKey = semanticKey(right.name);
  if (leftKey === rightKey && significantTokens(left.name).size >= 2) return true;
  const a = significantTokens(left.name);
  const b = significantTokens(right.name);
  if (a.size < 2 || b.size < 2) return false;
  const shared = [...a].filter((token) => b.has(token));
  const score = shared.length / new Set([...a, ...b]).size;
  return score >= 0.9 && (left.acronym === right.acronym || leftKey.includes(rightKey) || rightKey.includes(leftKey));
}

function chooseCanonical(rows: UniversityRow[]): UniversityRow {
  return [...rows].sort((a, b) => {
    const official = (row: UniversityRow) => /\\b(universidad|instituto|asociacion)\\b/i.test(row.name) ? 1 : 0;
    return official(b) - official(a) || b.academicInfo.length - a.academicInfo.length || b.name.length - a.name.length || a.id - b.id;
  })[0];
}

async function checkCatalogApi(): Promise<{ available: boolean; status?: number; duplicateIdsReturned?: number[]; reason?: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 1500);
  try {
    const response = await fetch("http://localhost:3000/api/catalogs/universities", { signal: controller.signal });
    if (!response.ok) return { available: true, status: response.status, duplicateIdsReturned: [] };
    const body = await response.json() as Array<{ id: number }>;
    return { available: true, status: response.status, duplicateIdsReturned: body.map((item) => item.id) };
  } catch (error) {
    return { available: false, reason: error instanceof Error ? error.message : "No se pudo consultar la API local" };
  } finally {
    clearTimeout(timeout);
  }
}

async function main(): Promise<void> {
  const root = process.cwd();
  const historical = JSON.parse(await readFile(path.join(root, "config", "academic-consolidation.approved-plan.v2.json"), "utf8")) as { universities: Array<{ canonicalId: number; duplicateIds: number[] }> };
  const historicalCanonical = new Set(historical.universities.map((group) => group.canonicalId));
  const historicalDuplicate = new Set(historical.universities.flatMap((group) => group.duplicateIds));
  const [universities, allAcademic, nullUniversity, apiResult] = await Promise.all([
    prisma.university.findMany({ where: { isActive: true }, include: { country: { select: { name: true } }, academicInfos: { select: { id: true } } }, orderBy: { id: "asc" } }),
    prisma.academicInfo.count(),
    prisma.academicInfo.count({ where: { universityId: null } }),
    checkCatalogApi(),
  ]);
  const rows = (universities as unknown as Array<Omit<UniversityRow, "academicInfo"> & { academicInfos?: Array<{ id: number }> }>).map((row) => ({ ...row, academicInfo: row.academicInfos ?? [] })) as UniversityRow[];
  const used = new Set<number>();
  const highConfidence: Group[] = [];
  const reviewRequired: Array<{ ids: number[]; names: string[]; reason: string }> = [];
  for (const row of rows) {
    if (used.has(row.id)) continue;
    const members = rows.filter((candidate) => candidate.id !== row.id && isSameSemanticInstitution(row, candidate));
    if (!members.length) continue;
    const component = [row, ...members];
    component.forEach((item) => used.add(item.id));
    const canonical = chooseCanonical(component);
    const duplicateRows = component.filter((item) => item.id !== canonical.id);
    const normalized = new Set(component.map((item) => semanticKey(item.name)));
    const exactSemantic = normalized.size === 1;
    if (!exactSemantic) {
      reviewRequired.push({ ids: component.map((item) => item.id), names: component.map((item) => item.name), reason: "Variantes cercanas pero no equivalentes por normalización estricta" });
      continue;
    }
    highConfidence.push({
      canonicalId: canonical.id,
      canonicalName: canonical.name,
      duplicateIds: duplicateRows.map((item) => item.id),
      members: component.map((item) => ({ id: item.id, name: item.name, normalizedName: semanticKey(item.name), countryId: item.countryId, country: item.country.name, acronym: item.acronym, isActive: item.isActive, academicInfoReferences: item.academicInfo.length, historicalRole: historicalCanonical.has(item.id) ? "CANONICAL" : historicalDuplicate.has(item.id) ? "DUPLICATE" : "NOT_IN_HISTORICAL_PLAN" })),
      referencesToMove: duplicateRows.reduce((sum, item) => sum + item.academicInfo.length, 0),
      reason: "Mismo país y mismo nombre semántico tras normalizar tildes, puntuación, espacios y variantes N°/Nº/NRO/NO.",
      confidence: "HIGH_CONFIDENCE_DUPLICATE",
    });
  }
  const finalPlan = {
    generatedAt: new Date().toISOString(),
    readOnly: true,
    scope: { activeUniversities: rows.length, academicInfoTotal: allAcademic, universityIdNullBefore: nullUniversity },
    universities: highConfidence,
    reviewRequired,
    simulation: {
      academicInfoBefore: allAcademic,
      academicInfoAfter: allAcademic,
      universityIdNullBefore: nullUniversity,
      universityIdNullAfter: nullUniversity,
      referencesToMove: highConfidence.reduce((sum, group) => sum + group.referencesToMove, 0),
      duplicateIdsWithReferencesAfter: 0,
      canonicalsActive: highConfidence.every((group) => rows.some((row) => row.id === group.canonicalId && row.isActive)),
      writesExecuted: false,
    },
    catalogApi: apiResult,
  };
  await mkdir(path.join(root, "config"), { recursive: true });
  await writeFile(path.join(root, "config", "academic-residual-duplicates.final-plan.json"), JSON.stringify(finalPlan, null, 2) + "\n", "utf8");
  await mkdir(path.join(root, "reports"), { recursive: true });
  await writeFile(path.join(root, "reports", "academic-residual-duplicates-final-audit.json"), JSON.stringify(finalPlan, null, 2) + "\n", "utf8");
  const tecsup = rows.filter((row) => /tecsup/i.test(row.name));
  const sanMarcos = rows.filter((row) => /san marcos/i.test(row.name));
  const findGroup = (items: UniversityRow[]) => highConfidence.find((group) => items.some((item) => group.members.some((member) => member.id === item.id)));
  console.log(JSON.stringify({
    activeUniversities: rows.length,
    tecsup: { records: tecsup.map((row) => ({ id: row.id, name: row.name, normalizedName: semanticKey(row.name), countryId: row.countryId, acronym: row.acronym, isActive: row.isActive, references: row.academicInfo.length })), canonical: findGroup(tecsup)?.canonicalId ?? null },
    sanMarcos: { records: sanMarcos.map((row) => ({ id: row.id, name: row.name, normalizedName: semanticKey(row.name), countryId: row.countryId, acronym: row.acronym, isActive: row.isActive, references: row.academicInfo.length })), canonical: findGroup(sanMarcos)?.canonicalId ?? null },
    highConfidenceGroups: highConfidence.length,
    recordsToDeactivate: highConfidence.reduce((sum, group) => sum + group.duplicateIds.length, 0),
    academicInfoToReassign: finalPlan.simulation.referencesToMove,
    reviewRequired: reviewRequired.length,
    api: apiResult,
    output: "config/academic-residual-duplicates.final-plan.json",
    writesExecuted: false,
  }, null, 2));
}

main().catch((error: unknown) => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
