import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

type RecordItem = { id: number; name: string; acronym: string | null; countryId: number | null; country: string | null; createdAt: Date; references: number; draftOccurrences: number };
type Candidate = { ids: number[]; records: RecordItem[]; similarityScore: number; sharedTokens: string[]; canonicalRecommended: { id: number; name: string } | null; canonicalExisting: boolean; reason: string; classification: "HIGH_CONFIDENCE_DUPLICATE" | "REVIEW_REQUIRED" | "NOT_DUPLICATE" };
const prisma = new PrismaClient();
const stopWords = new Set(["universidad", "instituto", "institucion", "escuela", "del", "de", "la", "el", "los", "las", "y", "un", "una"]);

function normalize(value: string): string { return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " "); }
function tokens(value: string): Set<string> { return new Set(normalize(value).split(" ").filter((token) => token && !stopWords.has(token))); }
function jaccard(left: Set<string>, right: Set<string>): { score: number; shared: string[] } { const shared = [...left].filter((token) => right.has(token)); const union = new Set([...left, ...right]); return { score: union.size ? shared.length / union.size : 0, shared }; }
function acronymMatch(a: RecordItem, b: RecordItem): boolean { return Boolean(a.acronym && b.acronym && normalize(a.acronym).replace(/ /g, "") === normalize(b.acronym).replace(/ /g, "")); }
function invalidReason(value: string, entity: "University" | "Specialty"): string | null {
  const trimmed = value.trim();
  if (!trimmed) return "Valor vacío o compuesto únicamente por espacios";
  if (/^e\d{5,}$/i.test(trimmed)) return "Código legacy sin nombre institucional";
  if (/^\d+$/.test(trimmed)) return "Valor numérico o año sin significado académico/institucional";
  if (/^[^a-záéíóúüñ]+$/i.test(trimmed)) return "Solo símbolos o puntuación";
  const knownAcronyms = new Set(["uni", "upc", "pucp", "tecsup", "senati", "isil", "certus"]);
  if (trimmed.length <= 2 && !(entity === "University" && knownAcronyms.has(normalize(trimmed)))) return "Valor demasiado corto para ser una opción identificable";
  return null;
}
function collectDraftCounts(value: unknown, result: { institution: Map<string, number>; specialty: Map<string, number> }): void {
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (typeof child === "string" && /institution|university|universidad/i.test(key)) result.institution.set(normalize(child), (result.institution.get(normalize(child)) ?? 0) + 1);
    if (typeof child === "string" && /specialty|especialidad/i.test(key)) result.specialty.set(normalize(child), (result.specialty.get(normalize(child)) ?? 0) + 1);
    if (typeof child === "object") collectDraftCounts(child, result);
  }
}

async function main(): Promise<void> {
  const root = process.cwd();
  const plan = JSON.parse(await readFile(path.join(root, "config", "academic-consolidation.approved-plan.v2.json"), "utf8"));
  const [universities, specialties, universityRefs, specialtyRefs, applications] = await Promise.all([
    prisma.university.findMany({ where: { isActive: true }, include: { country: { select: { name: true } } }, orderBy: { id: "asc" } }),
    prisma.specialty.findMany({ where: { isActive: true }, orderBy: { id: "asc" } }),
    prisma.academicInfo.groupBy({ by: ["universityId"], _count: { _all: true }, where: { universityId: { not: null } } }),
    prisma.academicInfo.groupBy({ by: ["specialtyId"], _count: { _all: true }, where: { specialtyId: { not: null } } }),
    prisma.membershipApplication.findMany({ select: { draftData: true } }),
  ]);
  const draftCounts = { institution: new Map<string, number>(), specialty: new Map<string, number>() };
  for (const application of applications) collectDraftCounts(application.draftData, draftCounts);
  const uRef = new Map(universityRefs.map((item) => [item.universityId as number, item._count._all]));
  const sRef = new Map(specialtyRefs.map((item) => [item.specialtyId as number, item._count._all]));
  const uItems: RecordItem[] = universities.map((item) => ({ id: item.id, name: item.name, acronym: item.acronym, countryId: item.countryId, country: item.country.name, createdAt: item.createdAt, references: uRef.get(item.id) ?? 0, draftOccurrences: draftCounts.institution.get(normalize(item.name)) ?? 0 }));
  const sItems: RecordItem[] = specialties.map((item) => ({ id: item.id, name: item.name, acronym: null, countryId: null, country: null, createdAt: item.createdAt, references: sRef.get(item.id) ?? 0, draftOccurrences: draftCounts.specialty.get(normalize(item.name)) ?? 0 }));
  const canonicalUniversities = new Set<number>((plan.universities as Array<{ canonicalId: number }>).map((item) => item.canonicalId));
  const canonicalSpecialties = new Set<number>((plan.specialties as Array<{ canonicalId: number }>).map((item) => item.canonicalId));
  const compare = (items: RecordItem[], canonicalIds: Set<number>, kind: "UNIVERSITY" | "SPECIALTY"): { high: Candidate[]; review: Candidate[]; not: Candidate[] } => {
    const high: Candidate[] = [], review: Candidate[] = [], not: Candidate[] = [];
    for (let i = 0; i < items.length; i += 1) for (let j = i + 1; j < items.length; j += 1) {
      const a = items[i], b = items[j];
      const ta = tokens(a.name), tb = tokens(b.name);
      const similarity = jaccard(ta, tb);
      const sameCountry = kind === "SPECIALTY" || a.countryId === b.countryId;
      const acronym = acronymMatch(a, b);
      if (similarity.score < 0.45 && !acronym) continue;
      const official = [a, b].sort((x, y) => y.name.length - x.name.length)[0];
      const candidate: Candidate = { ids: [a.id, b.id], records: [a, b], similarityScore: Number(similarity.score.toFixed(3)), sharedTokens: similarity.shared, canonicalRecommended: sameCountry ? { id: official.id, name: official.name } : null, canonicalExisting: canonicalIds.has(a.id) || canonicalIds.has(b.id), reason: acronym ? "Acrónimo coincidente; requiere confirmar identidad y país" : sameCountry ? `Tokens significativos compartidos (${kind}); la similitud detecta candidato, no autoriza merge` : "Alta similitud textual pero país inconsistente", classification: "NOT_DUPLICATE" };
      const exactNormalized = normalize(a.name) === normalize(b.name);
      const enoughIdentityTokens = Math.min(ta.size, tb.size) >= 2;
      if (sameCountry && ((similarity.score >= 0.9 && (exactNormalized || enoughIdentityTokens)) || (similarity.score >= 0.65 && acronym))) candidate.classification = "HIGH_CONFIDENCE_DUPLICATE";
      else if (sameCountry && similarity.score >= 0.45) candidate.classification = "REVIEW_REQUIRED";
      if (candidate.classification === "HIGH_CONFIDENCE_DUPLICATE") high.push(candidate); else if (candidate.classification === "REVIEW_REQUIRED") review.push(candidate); else not.push(candidate);
    }
    return { high, review, not: not.slice(0, 100) };
  };
  const universityResult = compare(uItems, canonicalUniversities, "UNIVERSITY");
  const specialtyResult = compare(sItems, canonicalSpecialties, "SPECIALTY");
  const invalidUniversities = uItems.flatMap((item) => { const reason = invalidReason(item.name, "University"); return reason ? [{ entity: "University", id: item.id, name: item.name, isActive: true, references: item.references, draftOccurrences: item.draftOccurrences, classification: "INVALID_ACTIVE_VALUE", recommendedAction: item.references > 0 ? "REASSIGN_MANUALLY" : item.name.trim().length <= 2 ? "REVIEW_REQUIRED" : "SAFE_TO_DEACTIVATE", reason }] : []; });
  const invalidSpecialties = sItems.flatMap((item) => { const reason = invalidReason(item.name, "Specialty"); return reason ? [{ entity: "Specialty", id: item.id, name: item.name, isActive: true, references: item.references, draftOccurrences: item.draftOccurrences, classification: "INVALID_ACTIVE_VALUE", recommendedAction: item.references > 0 ? "REASSIGN_MANUALLY" : item.name.trim().length <= 2 ? "REVIEW_REQUIRED" : "SAFE_TO_DEACTIVATE", reason }] : []; });
  const invalidSummary = (items: Array<{ recommendedAction: string }>) => ({ total: items.length, safeToDeactivate: items.filter((item) => item.recommendedAction === "SAFE_TO_DEACTIVATE").length, reassignManually: items.filter((item) => item.recommendedAction === "REASSIGN_MANUALLY").length, reviewRequired: items.filter((item) => item.recommendedAction === "REVIEW_REQUIRED").length });
  const report = { generatedAt: new Date().toISOString(), readOnly: true, scope: { universitiesActive: uItems.length, specialtiesActive: sItems.length }, universities: universityResult, specialties: specialtyResult, residualInvalidValues: { universities: invalidUniversities, specialties: invalidSpecialties, summary: { universities: invalidSummary(invalidUniversities), specialties: invalidSummary(invalidSpecialties) } }, sanMarcos: uItems.filter((item) => /san marcos/i.test(item.name)), creationPaths: { universitySeed: "prisma/seed/education/universities.seed.ts uses upsert by countryId + exact name; semantic duplicate can be created with a different name.", specialtySeed: "prisma/seed/education/specialties.seed.ts uses upsert by code; a different code can create a semantic duplicate.", runtimeRoutes: "No se encontraron rutas administrativas de create/upsert para University o Specialty fuera de seeds." }, notes: ["La comparación es detectora y conservadora; no ejecuta consolidación.", "Los ejemplos semánticos de especialidades requieren revisión académica."] };
  await mkdir(path.join(root, "reports"), { recursive: true });
  await writeFile(path.join(root, "reports", "academic-residual-duplicates-audit.json"), JSON.stringify(report, null, 2) + "\n", "utf8");
  await writeFile(path.join(root, "reports", "residual-invalid-academic-values.json"), JSON.stringify({ generatedAt: report.generatedAt, readOnly: true, universities: invalidUniversities, specialties: invalidSpecialties, summary: report.residualInvalidValues.summary }, null, 2) + "\n", "utf8");
  console.log(JSON.stringify({ scope: report.scope, sanMarcos: report.sanMarcos, universities: { highConfidence: universityResult.high.length, reviewRequired: universityResult.review.length, notDuplicate: universityResult.not.length }, specialties: { highConfidence: specialtyResult.high.length, reviewRequired: specialtyResult.review.length, notDuplicate: specialtyResult.not.length }, invalid: report.residualInvalidValues.summary }, null, 2));
}

main().catch((error: unknown) => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
