import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

type Classification = "CANONICAL" | "DUPLICATE" | "PROFESSIONAL_TITLE" | "SPECIALTY_OR_FIELD" | "INVALID" | "REVIEW_REQUIRED";

const prisma = new PrismaClient();

function normalize(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim().replace(/[.,;:/_\\()[\]{}'\"-]+/g, " ").replace(/\s+/g, " ");
}

function classify(name: string): { classification: Classification; reason: string } {
  const normalized = normalize(name);
  if (!normalized || /^[\d\s]+$/.test(normalized) || /^[^a-z]+$/i.test(normalized)) return { classification: "INVALID", reason: "Vacío, numérico o compuesto únicamente por símbolos." };
  if (/^(tecnico|bachiller|maestria|magister|doctorado|doctor|titulo profesional|otro)$/.test(normalized)) return { classification: "CANONICAL", reason: "Coincide con un grado académico controlado." };
  if (/^(bach|bachillerato|master|magister|phd)$/.test(normalized)) return { classification: "REVIEW_REQUIRED", reason: "Posible alias de un grado canónico; requiere consolidación explícita." };
  if (/\b(abogad[oa]|ingenier[oa]|licenciad[oa]|arquitect[oa]|contador|economista|odontolog[oa]|medic[oa])\b/.test(normalized)) return { classification: "PROFESSIONAL_TITLE", reason: "Describe un título profesional, no un grado académico." };
  if (/\b(ingenieria|derecho|administracion|geologia|minas|contabilidad|economia)\b/.test(normalized)) return { classification: "SPECIALTY_OR_FIELD", reason: "Parece una especialidad o campo profesional." };
  if (/^(segunda especialidad|diplomado|especializacion|egresado|titulado)$/.test(normalized)) return { classification: "REVIEW_REQUIRED", reason: "Uso académico ambiguo; revisar referencias antes de clasificar." };
  return { classification: "REVIEW_REQUIRED", reason: "Valor no reconocido como grado canónico; requiere revisión." };
}

async function main(): Promise<void> {
  const [rows, academicInfoRows] = await Promise.all([
    prisma.academicDegree.findMany({ orderBy: { id: "asc" } }),
    prisma.academicInfo.findMany({ select: { degreeId: true } }),
  ]);
  const referenceCounts = new Map<number, number>();
  for (const item of academicInfoRows) if (item.degreeId !== null) referenceCounts.set(item.degreeId, (referenceCounts.get(item.degreeId) ?? 0) + 1);
  const byNormalized = new Map<string, typeof rows>();
  for (const row of rows) byNormalized.set(normalize(row.name), [...(byNormalized.get(normalize(row.name)) ?? []), row]);
  const records = rows.map((row) => {
    const base = classify(row.name);
    const group = byNormalized.get(normalize(row.name)) ?? [];
    const duplicate = group.length > 1 && base.classification !== "INVALID";
    return { id: row.id, code: row.code, name: row.name, abbreviation: row.abbreviation, studyLevel: row.studyLevel, isActive: row.isActive, academicInfoReferences: referenceCounts.get(row.id) ?? 0, normalizedName: normalize(row.name), classification: duplicate ? "DUPLICATE" as Classification : base.classification, reason: duplicate ? "Comparte valor normalizado con otros registros del catálogo." : base.reason };
  });
  const canonicalGroups = [...byNormalized.entries()].filter(([, group]) => group.length > 1).map(([normalizedName, group]) => ({ normalizedName, canonicalCandidate: group.find((row) => classify(row.name).classification === "CANONICAL")?.id ?? null, members: group.map((row) => ({ id: row.id, name: row.name, references: referenceCounts.get(row.id) ?? 0 })) }));
  const counts = records.reduce<Record<Classification, number>>((acc, row) => { acc[row.classification] = (acc[row.classification] ?? 0) + 1; return acc; }, {} as Record<Classification, number>);
  const report = { generatedAt: new Date().toISOString(), readOnly: true, summary: { total: rows.length, classifications: counts, referenced: records.filter((row) => row.academicInfoReferences > 0).length, academicInfoReferences: records.reduce((sum, row) => sum + row.academicInfoReferences, 0), canonicalGroups: canonicalGroups.length }, records, canonicalGroups, notes: ["No se ejecutan UPDATE ni DELETE.", "Los grupos y aliases son candidatos para revisión; no constituyen un plan ejecutable."] };
  await mkdir(path.join(process.cwd(), "reports"), { recursive: true });
  await writeFile(path.join(process.cwd(), "reports", "academic-degree-audit.json"), JSON.stringify(report, null, 2) + "\n", "utf8");
  const proposals = [
    { key: "TECHNICAL", name: "Técnico", canonicalId: null, studyLevel: "TECHNICAL", action: "CREATE_CANONICAL", matcher: /\btecnico\b/i },
    { key: "BACHELOR", name: "Bachiller", canonicalId: 425, studyLevel: "BACHELOR", action: "KEEP_CANONICAL", matcher: /\bbachiller\b|\bbach\b/i },
    { key: "PROFESSIONAL_TITLE", name: "Título profesional", canonicalId: null, studyLevel: "OTHER", action: "CREATE_CANONICAL", matcher: /abogad|ingenier|licenciad|arquitect|contador|economista|titulo profesional/i },
    { key: "MASTER", name: "Maestría", canonicalId: 32, studyLevel: "MASTER", action: "KEEP_CANONICAL", matcher: /maestr|magister|master|mba/i },
    { key: "DOCTORATE", name: "Doctorado", canonicalId: null, studyLevel: "DOCTORATE", action: "CREATE_CANONICAL", matcher: /doctor|ph\.d|phd/i },
    { key: "OTHER", name: "Otro", canonicalId: null, studyLevel: "OTHER", action: "CREATE_CANONICAL", matcher: null },
  ] as const;
  const canonicalPlan = {
    generatedAt: report.generatedAt,
    readOnly: true,
    status: "PROPOSAL_ONLY",
    expectedActiveCanonicalCount: proposals.length,
    studyLevelNote: "El enum StudyLevel no contiene PROFESSIONAL_TITLE; Título profesional se propone temporalmente como OTHER hasta aprobación.",
    excludedFromAutomaticCreation: ["Segunda especialidad", "Diplomado"],
    canonicals: proposals.map((proposal) => ({ canonicalId: proposal.canonicalId, name: proposal.name, code: null, abbreviation: null, studyLevel: proposal.studyLevel, description: null, action: proposal.action, aliases: proposal.matcher ? records.filter((record) => proposal.matcher!.test(record.name) && record.classification !== "CANONICAL").map((record) => record.name) : [], legacyRecords: records.filter((record) => proposal.matcher?.test(record.name) && record.id !== proposal.canonicalId).map((record) => ({ id: record.id, name: record.name, classification: record.classification, references: record.academicInfoReferences })) })),
    proposedDeactivation: records.filter((record) => ["DUPLICATE", "PROFESSIONAL_TITLE", "SPECIALTY_OR_FIELD", "INVALID"].includes(record.classification) && record.id !== 32 && record.id !== 425).map((record) => ({ id: record.id, name: record.name, classification: record.classification, references: record.academicInfoReferences })),
    reviewRequired: records.filter((record) => record.classification === "REVIEW_REQUIRED").map((record) => ({ id: record.id, name: record.name, references: record.academicInfoReferences })),
    notes: ["No se ejecutan UPDATE ni DELETE.", "Los 174 casos REVIEW_REQUIRED quedan fuera de la desactivación propuesta.", "Los aliases son candidatos y requieren aprobación humana."],
  };
  await writeFile(path.join(process.cwd(), "reports", "academic-degree-canonical-plan.json"), JSON.stringify(canonicalPlan, null, 2) + "\n", "utf8");
  console.log(JSON.stringify(report.summary, null, 2));
}

main().catch((error: unknown) => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
