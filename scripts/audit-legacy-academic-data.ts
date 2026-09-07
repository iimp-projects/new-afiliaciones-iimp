import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

type Confidence = "HIGH_CONFIDENCE" | "REVIEW_REQUIRED" | "UNMATCHED";
type DegreeCategory =
  | "ACADEMIC_DEGREE"
  | "PROFESSIONAL_TITLE"
  | "ACADEMIC_STATUS"
  | "SPECIALTY_OR_FIELD"
  | "COMBINED"
  | "INVALID"
  | "UNKNOWN";

type Candidate = {
  legacyValue: string;
  occurrences: number;
  canonicalId: number | null;
  canonicalName: string | null;
  normalizedValue: string;
  confidence: Confidence;
  reason: string;
  country: string | null;
  acronym: string | null;
};

const prisma = new PrismaClient();

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[.,;:/_\\()[\]{}'"`´’‘-]+/g, " ")
    .replace(/\s+/g, " ");
}

function isInvalid(value: string): boolean {
  const trimmed = value.trim();
  return (
    trimmed.length === 0 ||
    /^e\d{6,}$/i.test(trimmed) ||
    /^\d{2,4}$/.test(trimmed) ||
    /^[-–—]+$/.test(trimmed)
  );
}

function isAmbiguousAcronym(value: string): boolean {
  return ["uns", "unfs", "upc", "puc", "uni"].includes(normalize(value).replace(/\s/g, ""));
}

function classifyDegreeTitle(value: string): DegreeCategory {
  const normalized = normalize(value);
  if (!normalized || isInvalid(value)) return "INVALID";
  if (/\b(en|de)\b/.test(normalized) && /\b(bachiller|magister|maestro|doctor|ingeniero|licenciado)\b/.test(normalized)) {
    return "COMBINED";
  }
  if (/^(bachiller|magister|maestro|doctor|postdoctorado|diplomado|especializacion|mba)$/.test(normalized)) {
    return "ACADEMIC_DEGREE";
  }
  if (/^(ingeniero|ingeniera|licenciado|licenciada|abogado|abogada|arquitecto|arquitecta|contador|contadora|profesor|profesora)$/.test(normalized) || /^ingeniero /.test(normalized)) {
    return "PROFESSIONAL_TITLE";
  }
  if (/^(egresado|egresada|titulado|titulada|aun no tengo|sin grado|estudiante)$/.test(normalized)) {
    return "ACADEMIC_STATUS";
  }
  if (/^(ingenieria|geologia|minas|metalurgica|civil|industrial|quimica|mecanica|mecatronica|electrica|geofisica)\b/.test(normalized)) {
    return "SPECIALTY_OR_FIELD";
  }
  return "UNKNOWN";
}

function collectDraftValues(value: unknown, result: { institution: string[]; specialty: string[]; degreeTitle: string[] }): void {
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (typeof child === "string") {
      if (/institution|university|universidad/i.test(key)) result.institution.push(child);
      if (/specialty|especialidad/i.test(key)) result.specialty.push(child);
      if (/degree(title)?|grado|titulo/i.test(key)) result.degreeTitle.push(child);
    } else {
      collectDraftValues(child, result);
    }
  }
}

function candidateFor(
  value: string,
  occurrences: number,
  catalogs: Array<{ id: number; name: string; country: string | null; acronym: string | null }>,
): Candidate {
  const normalizedValue = normalize(value);
  if (isInvalid(value)) {
    return { legacyValue: value, occurrences, canonicalId: null, canonicalName: null, normalizedValue, confidence: "UNMATCHED", reason: "Valor vacío, numérico, guion o código legacy no identificable", country: null, acronym: null };
  }
  const exact = catalogs.filter((item) => normalize(item.name) === normalizedValue);
  if (exact.length === 1 && !isAmbiguousAcronym(value)) {
    return { legacyValue: value, occurrences, canonicalId: exact[0].id, canonicalName: exact[0].name, normalizedValue, confidence: "HIGH_CONFIDENCE", reason: "Coincidencia inequívoca por nombre normalizado", country: exact[0].country, acronym: exact[0].acronym };
  }
  const acronym = catalogs.filter((item) => item.acronym && normalize(item.acronym).replace(/\s/g, "") === normalizedValue.replace(/\s/g, ""));
  if (acronym.length === 1 && !isAmbiguousAcronym(value)) {
    return { legacyValue: value, occurrences, canonicalId: acronym[0].id, canonicalName: acronym[0].name, normalizedValue, confidence: "HIGH_CONFIDENCE", reason: "Acrónimo único en el catálogo canónico", country: acronym[0].country, acronym: acronym[0].acronym };
  }
  if (exact.length > 1 || acronym.length > 1 || isAmbiguousAcronym(value)) {
    return { legacyValue: value, occurrences, canonicalId: null, canonicalName: null, normalizedValue, confidence: "REVIEW_REQUIRED", reason: "Coincidencia ambigua o acrónimo no inequívoco", country: null, acronym: null };
  }
  return { legacyValue: value, occurrences, canonicalId: null, canonicalName: null, normalizedValue, confidence: "UNMATCHED", reason: "No existe coincidencia canónica segura", country: null, acronym: null };
}

type CatalogItem = { id: number; name: string; acronym: string | null; country: string | null; countryId?: number; categoryId?: number | null; description?: string | null; code?: string | null; isActive?: boolean };
type CatalogMember = CatalogItem & { academicInfoReferences: number; draftOccurrences: number };

function qualityScore(item: CatalogMember): number {
  let score = item.academicInfoReferences * 10 + item.draftOccurrences * 5;
  if (item.name.trim() === item.name) score += 2;
  if (item.acronym) score += 2;
  if (item.code) score += 1;
  if (item.isActive) score += 1;
  if (isInvalid(item.name)) score -= 1000;
  if (/\d{4}|E\d{6,}/i.test(item.name)) score -= 500;
  return score;
}

function auditCatalog(items: CatalogItem[], references: Map<number, number>, draftValues: string[], kind: "UNIVERSITY" | "SPECIALTY") {
  const draftCounts = new Map<string, number>();
  for (const value of draftValues) draftCounts.set(normalize(value), (draftCounts.get(normalize(value)) ?? 0) + 1);
  const groups = new Map<string, CatalogMember[]>();
  for (const item of items) {
    const member: CatalogMember = { ...item, academicInfoReferences: references.get(item.id) ?? 0, draftOccurrences: draftCounts.get(normalize(item.name)) ?? 0 };
    const key = normalize(item.name);
    groups.set(key, [...(groups.get(key) ?? []), member]);
  }
  return [...groups.entries()].map(([normalizedValue, members]) => {
    const invalid = members.every((member) => isInvalid(member.name));
    const ranked = [...members].sort((a, b) => qualityScore(b) - qualityScore(a));
    const best = ranked[0];
    const tied = ranked.length > 1 && qualityScore(ranked[0]) === qualityScore(ranked[1]);
    const classification = invalid ? "INVALID" : tied ? "REVIEW_REQUIRED" : members.length > 1 ? "DUPLICATE_CANDIDATE" : "CANONICAL";
    return {
      normalizedValue,
      canonicalCandidate: invalid || tied ? null : { id: best.id, name: best.name },
      members,
      classification,
      confidence: classification === "CANONICAL" ? "HIGH_CONFIDENCE" : classification === "DUPLICATE_CANDIDATE" ? "REVIEW_REQUIRED" : "UNMATCHED",
      reason: invalid ? "Todos los registros del grupo son códigos, números, guiones o valores no institucionales" : tied ? "No existe una diferencia objetiva suficiente para elegir un canónico" : members.length > 1 ? `Variantes equivalentes agrupadas; se propone el registro con mayor calidad/uso (${kind})` : "Registro único con nombre válido y sin variante equivalente detectada",
    };
  }).sort((a, b) => a.normalizedValue.localeCompare(b.normalizedValue));
}

function topDegreeTitles(degreeTitle: Array<{ value: string; occurrences: number; category: DegreeCategory }>) {
  const categories = new Map<DegreeCategory, Array<{ value: string; occurrences: number }>>();
  for (const item of degreeTitle) categories.set(item.category, [...(categories.get(item.category) ?? []), { value: item.value, occurrences: item.occurrences }]);
  return Object.fromEntries([...categories.entries()].map(([category, values]) => [category, values.sort((a, b) => b.occurrences - a.occurrences).slice(0, 30)]));
}

async function main(): Promise<void> {
  const [universities, specialties, degrees, academics, applications] = await Promise.all([
    prisma.university.findMany({ include: { country: { select: { name: true } } }, orderBy: { id: "asc" } }),
    prisma.specialty.findMany({ orderBy: { id: "asc" } }),
    prisma.academicDegree.findMany({ orderBy: { id: "asc" } }),
    prisma.academicInfo.findMany({ select: { universityId: true, specialtyId: true, degreeId: true, degreeTitle: true } }),
    prisma.membershipApplication.findMany({ select: { draftData: true } }),
  ]);

  const drafts = { institution: [] as string[], specialty: [] as string[], degreeTitle: [] as string[] };
  for (const application of applications) collectDraftValues(application.draftData, drafts);

  const universityCatalog = universities.map((item) => ({ id: item.id, name: item.name, country: item.country?.name ?? null, countryId: item.countryId, acronym: item.acronym, code: item.code, isActive: item.isActive }));
  const specialtyCatalog = specialties.map((item) => ({ id: item.id, name: item.name, country: null, acronym: null, categoryId: item.specialtyCategoryId, description: item.description, code: item.code, isActive: item.isActive }));
  const degreeCatalog = degrees.map((item) => ({ id: item.id, name: item.name, country: null, acronym: item.abbreviation }));
  const universityReferences = new Map<number, number>();
  const specialtyReferences = new Map<number, number>();
  for (const academic of academics) {
    if (academic.universityId !== null) universityReferences.set(academic.universityId, (universityReferences.get(academic.universityId) ?? 0) + 1);
    if (academic.specialtyId !== null) specialtyReferences.set(academic.specialtyId, (specialtyReferences.get(academic.specialtyId) ?? 0) + 1);
  }

  const buildValues = (values: string[]): Array<{ value: string; occurrences: number }> => {
    const counts = new Map<string, { value: string; occurrences: number }>();
    for (const value of values) {
      const key = value;
      const current = counts.get(key);
      counts.set(key, { value, occurrences: (current?.occurrences ?? 0) + 1 });
    }
    return [...counts.values()].sort((a, b) => a.value.localeCompare(b.value));
  };

  const universityValues = [...universities.map((item) => item.name), ...drafts.institution];
  const specialtyValues = [...specialties.map((item) => item.name), ...drafts.specialty];
  const degreeTitleValues = buildValues(academics.map((item) => item.degreeTitle ?? ""));
  const institutions = buildValues(universityValues).map(({ value, occurrences }) => candidateFor(value, occurrences, universityCatalog));
  const specialtyCandidates = buildValues(specialtyValues).map(({ value, occurrences }) => candidateFor(value, occurrences, specialtyCatalog));

  const degreeTitle = degreeTitleValues.map(({ value, occurrences }) => ({ value, occurrences, category: classifyDegreeTitle(value), normalizedValue: normalize(value) }));
  const universityGroups = auditCatalog(universityCatalog, universityReferences, drafts.institution, "UNIVERSITY");
  const specialtyGroups = auditCatalog(specialtyCatalog, specialtyReferences, drafts.specialty, "SPECIALTY");
  const canonicalUniversityIds = new Set(universityGroups.filter((group) => group.classification === "CANONICAL").map((group) => group.canonicalCandidate?.id).filter((id): id is number => id !== undefined));
  const canonicalSpecialtyIds = new Set(specialtyGroups.filter((group) => group.classification === "CANONICAL").map((group) => group.canonicalCandidate?.id).filter((id): id is number => id !== undefined));
  const revisedHighConfidence = {
    institutions: institutions.filter((item) => item.confidence === "HIGH_CONFIDENCE" && item.canonicalId !== null && canonicalUniversityIds.has(item.canonicalId)),
    specialties: specialtyCandidates.filter((item) => item.confidence === "HIGH_CONFIDENCE" && item.canonicalId !== null && canonicalSpecialtyIds.has(item.canonicalId)),
  };
  const highConfidence = { institutions: institutions.filter((item) => item.confidence === "HIGH_CONFIDENCE"), specialties: specialtyCandidates.filter((item) => item.confidence === "HIGH_CONFIDENCE") };
  const reviewRequired = { institutions: institutions.filter((item) => item.confidence === "REVIEW_REQUIRED"), specialties: specialtyCandidates.filter((item) => item.confidence === "REVIEW_REQUIRED") };
  const unmatched = { institutions: institutions.filter((item) => item.confidence === "UNMATCHED"), specialties: specialtyCandidates.filter((item) => item.confidence === "UNMATCHED") };
  const categoryCounts = degreeTitle.reduce<Record<DegreeCategory, number>>((counts, item) => { counts[item.category] = (counts[item.category] ?? 0) + item.occurrences; return counts; }, {} as Record<DegreeCategory, number>);

  const report = {
    generatedAt: new Date().toISOString(),
    readOnly: true,
    summary: {
      sourceCounts: { universities: universities.length, specialties: specialties.length, academicDegrees: degrees.length, academicInfo: academics.length, membershipApplications: applications.length },
      relationCoverage: { academicInfoWithoutUniversity: academics.filter((item) => item.universityId === null).length, academicInfoWithoutSpecialty: academics.filter((item) => item.specialtyId === null).length, academicInfoWithoutDegree: academics.filter((item) => item.degreeId === null).length, academicInfoWithEmptyDegreeTitle: academics.filter((item) => !item.degreeTitle?.trim()).length },
      confidenceCounts: { institutions: { highConfidence: highConfidence.institutions.length, reviewRequired: reviewRequired.institutions.length, unmatched: unmatched.institutions.length }, specialties: { highConfidence: highConfidence.specialties.length, reviewRequired: reviewRequired.specialties.length, unmatched: unmatched.specialties.length }, revisedHighConfidenceExcludingContaminatedCatalogs: { institutions: revisedHighConfidence.institutions.length, specialties: revisedHighConfidence.specialties.length } },
      canonicalCatalogs: { universities: { total: universities.length, groups: universityGroups.length, canonical: universityGroups.filter((group) => group.classification === "CANONICAL").length, duplicateCandidates: universityGroups.filter((group) => group.classification === "DUPLICATE_CANDIDATE").length, invalid: universityGroups.filter((group) => group.classification === "INVALID").length, reviewRequired: universityGroups.filter((group) => group.classification === "REVIEW_REQUIRED").length }, specialties: { total: specialties.length, groups: specialtyGroups.length, canonical: specialtyGroups.filter((group) => group.classification === "CANONICAL").length, duplicateCandidates: specialtyGroups.filter((group) => group.classification === "DUPLICATE_CANDIDATE").length, invalid: specialtyGroups.filter((group) => group.classification === "INVALID").length, reviewRequired: specialtyGroups.filter((group) => group.classification === "REVIEW_REQUIRED").length } },
      degreeTitleCategories: categoryCounts,
    },
    institutions,
    specialties: specialtyCandidates,
    degreeTitle,
    highConfidence,
    reviewRequired,
    unmatched,
    canonicalCatalogs: { universities: universityGroups, specialties: specialtyGroups },
    degreeTitleTopExamples: topDegreeTitles(degreeTitle),
    notes: ["La clasificación se ejecuta únicamente en memoria.", "degreeTitle no se transforma en AcademicDegree automáticamente.", "Los alias ambiguos y valores legacy requieren aprobación humana."],
  };

  const root = process.cwd();
  await mkdir(path.join(root, "reports"), { recursive: true });
  await mkdir(path.join(root, "config"), { recursive: true });
  await writeFile(path.join(root, "reports", "legacy-academic-audit.json"), JSON.stringify(report, null, 2) + "\n", "utf8");
  await writeFile(path.join(root, "reports", "legacy-academic-review.json"), JSON.stringify({ generatedAt: report.generatedAt, institutions: reviewRequired.institutions, specialties: reviewRequired.specialties, degreeTitle: degreeTitle.filter((item) => ["UNKNOWN", "COMBINED"].includes(item.category)) }, null, 2) + "\n", "utf8");
  await writeFile(path.join(root, "reports", "canonical-university-candidates.json"), JSON.stringify({ generatedAt: report.generatedAt, readOnly: true, groups: universityGroups }, null, 2) + "\n", "utf8");
  await writeFile(path.join(root, "reports", "canonical-specialty-candidates.json"), JSON.stringify({ generatedAt: report.generatedAt, readOnly: true, groups: specialtyGroups }, null, 2) + "\n", "utf8");
  await writeFile(path.join(root, "config", "legacy-academic-mapping.candidate.json"), JSON.stringify({ generatedAt: report.generatedAt, readOnly: true, warning: "Propuesta no aplicable automáticamente; excluye grupos contaminados/ambiguos.", institutions: revisedHighConfidence.institutions, specialties: revisedHighConfidence.specialties, degreeTitle: [] }, null, 2) + "\n", "utf8");

  console.log(JSON.stringify(report.summary, null, 2));
}

main().catch((error: unknown) => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
