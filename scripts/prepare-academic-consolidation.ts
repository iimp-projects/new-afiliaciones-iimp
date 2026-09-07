import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

type Group = {
  normalizedValue: string;
  canonicalCandidate: { id: number; name: string } | null;
  members: Array<{ id: number; name: string; acronym: string | null; country: string | null; countryId?: number; categoryId?: number | null; description?: string | null; academicInfoReferences: number; draftOccurrences: number; isActive?: boolean }>;
  classification: string;
  confidence: string;
  reason: string;
};

const prisma = new PrismaClient();

function normalize(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim().replace(/[.,;:/_\\()[\]{}'"`´’‘-]+/g, " ").replace(/\s+/g, " ");
}

function hasAmbiguousAcronym(value: string | null): boolean {
  if (!value) return false;
  return ["uns", "unfs", "upc", "puc", "uni"].includes(normalize(value).replace(/\s/g, ""));
}

function classifyDuplicate(group: Group): "SAFE_TO_MERGE" | "REVIEW_REQUIRED" | "DO_NOT_MERGE" {
  if (!group.canonicalCandidate || group.members.some((member) => /^e\d{6,}$/i.test(member.name.trim()) || /^\d{2,4}$/.test(member.name.trim()) || /^[-–—]+$/.test(member.name.trim()))) return "DO_NOT_MERGE";
  const countries = new Set(group.members.map((member) => member.country).filter(Boolean));
  if (countries.size > 1 || group.members.some((member) => hasAmbiguousAcronym(member.acronym))) return "REVIEW_REQUIRED";
  return "SAFE_TO_MERGE";
}

function degreeReview(item: { value: string; occurrences: number; category: string }) {
  const normalized = normalize(item.value);
  const explicitReview = ["mba", "diplomado", "especializacion", "ingeniero de minas", "ingeniero geologo", "economista", "derecho", "administracion de empresas", "titulado", "egresado"].includes(normalized);
  const category = item.category;
  const reason = explicitReview
    ? "Requiere decisión semántica del negocio antes de crear o usar AcademicDegree"
    : category === "COMBINED"
      ? "Combina título/grado con especialidad o campo"
      : category === "UNKNOWN"
        ? "No coincide con una categoría controlada"
        : category === "INVALID"
          ? "Valor vacío, guion o placeholder"
          : "Clasificación heurística; requiere validación antes de cualquier backfill";
  return { ...item, suggestedCategory: category, reason, confidence: explicitReview || category === "UNKNOWN" || category === "COMBINED" ? "REVIEW_REQUIRED" : "CANDIDATE", reviewRequired: explicitReview || ["UNKNOWN", "COMBINED"].includes(category) };
}

function classifyAlias(value: string, canonicalIdsByAlias: Map<string, Set<number>>): "SAFE_ALIAS" | "REVIEW_ALIAS" | "INVALID_ALIAS" {
  const normalized = normalize(value);
  if (!normalized || /^e\d{6,}$/i.test(value.trim()) || /^\d{2,4}$/.test(value.trim()) || /^[-–—]+$/.test(value.trim())) return "INVALID_ALIAS";
  const targets = canonicalIdsByAlias.get(normalized) ?? new Set<number>();
  if (targets.size !== 1) return "REVIEW_ALIAS";
  if (normalized.length < 4 || ["universidad", "ingenieria", "minas", "geologia", "especialidad"].includes(normalized)) return "REVIEW_ALIAS";
  return "SAFE_ALIAS";
}

async function main(): Promise<void> {
  const root = process.cwd();
  const [audit, universityReport, specialtyReport] = await Promise.all([
    readFile(path.join(root, "reports", "legacy-academic-audit.json"), "utf8").then(JSON.parse),
    readFile(path.join(root, "reports", "canonical-university-candidates.json"), "utf8").then(JSON.parse),
    readFile(path.join(root, "reports", "canonical-specialty-candidates.json"), "utf8").then(JSON.parse),
  ]);
  const universities = universityReport.groups as Group[];
  const specialties = specialtyReport.groups as Group[];
  const universityDuplicateGroups = universities.filter((group) => group.classification === "DUPLICATE_CANDIDATE");
  const specialtyDuplicateGroups = specialties.filter((group) => group.classification === "DUPLICATE_CANDIDATE");
  const buildPlan = (groups: Group[]) => groups.map((group) => {
    const classification = classifyDuplicate(group);
    const canonicalId = group.canonicalCandidate?.id ?? null;
    const duplicateMembers = group.members.filter((member) => member.id !== canonicalId);
    return {
      canonicalCandidate: group.canonicalCandidate,
      classification,
      duplicateIds: duplicateMembers.map((member) => member.id),
      duplicateNames: duplicateMembers.map((member) => member.name),
      members: group.members,
      affectedAcademicInfo: duplicateMembers.reduce((total, member) => total + member.academicInfoReferences, 0),
      totalReferencesToCanonicalAfterDryRun: group.members.reduce((total, member) => total + member.academicInfoReferences, 0),
      countryIdsOrNames: [...new Set(group.members.map((member) => member.country))],
      acronyms: [...new Set(group.members.map((member) => member.acronym).filter(Boolean))],
      metadataComparison: group.members.map((member) => ({ id: member.id, name: member.name, academicInfoReferences: member.academicInfoReferences, draftOccurrences: member.draftOccurrences, hasAcronym: Boolean(member.acronym), active: member.isActive ?? null })),
      reason: group.reason,
      risk: classification === "SAFE_TO_MERGE" ? "Requiere transacción, validación de FKs y aprobación explícita" : classification === "REVIEW_REQUIRED" ? "Ambigüedad de país, acrónimo o calidad de registro" : "No existe destino canónico seguro",
    };
  });
  const universityPlan = buildPlan(universityDuplicateGroups);
  const specialtyPlan = buildPlan(specialtyDuplicateGroups);
  const invalid = {
    universities: universities.filter((group) => group.classification === "INVALID").flatMap((group) => group.members.map((member) => ({ ...member, recommendation: member.academicInfoReferences > 0 ? "REASSIGN_MANUALLY" : "UNUSED_AND_REMOVABLE_FUTURE" }))),
    specialties: specialties.filter((group) => group.classification === "INVALID").flatMap((group) => group.members.map((member) => ({ ...member, recommendation: member.academicInfoReferences > 0 ? "REASSIGN_MANUALLY" : "UNUSED_AND_REMOVABLE_FUTURE" }))),
  };
  const manualReview = {
    universities: [...universities.filter((group) => group.classification === "REVIEW_REQUIRED"), ...universityPlan.filter((group) => group.classification === "REVIEW_REQUIRED")],
    specialties: [...specialties.filter((group) => group.classification === "REVIEW_REQUIRED"), ...specialtyPlan.filter((group) => group.classification === "REVIEW_REQUIRED")],
    degreeTitle: (audit.degreeTitle as Array<{ value: string; occurrences: number; category: string }>).map(degreeReview).filter((item) => item.reviewRequired),
  };
  const safeUniversities = universityPlan.filter((group) => group.classification === "SAFE_TO_MERGE");
  const safeSpecialties = specialtyPlan.filter((group) => group.classification === "SAFE_TO_MERGE");
  const aliases = {
    generatedAt: new Date().toISOString(),
    readOnly: true,
    institutions: safeUniversities.map((group) => ({ canonicalId: group.canonicalCandidate?.id, canonicalName: group.canonicalCandidate?.name, aliases: [...new Set(group.members.flatMap((member) => [member.name, member.acronym].filter((value): value is string => Boolean(value))).filter((value) => value !== group.canonicalCandidate?.name))] })),
    specialties: safeSpecialties.map((group) => ({ canonicalId: group.canonicalCandidate?.id, canonicalName: group.canonicalCandidate?.name, aliases: group.members.map((member) => member.name).filter((value) => value !== group.canonicalCandidate?.name) })),
  };
  const aliasTargets = new Map<string, Set<number>>();
  for (const item of [...aliases.institutions, ...aliases.specialties]) {
    for (const alias of item.aliases) aliasTargets.set(normalize(alias), new Set([...(aliasTargets.get(normalize(alias)) ?? new Set<number>()), item.canonicalId ?? -1]));
  }
  const aliasAudit = [...aliases.institutions.flatMap((item) => item.aliases.map((alias) => ({ type: "UNIVERSITY", canonicalId: item.canonicalId, canonicalName: item.canonicalName, alias, classification: classifyAlias(alias, aliasTargets) }))), ...aliases.specialties.flatMap((item) => item.aliases.map((alias) => ({ type: "SPECIALTY", canonicalId: item.canonicalId, canonicalName: item.canonicalName, alias, classification: classifyAlias(alias, aliasTargets) })) )];
  const safeAliases = aliasAudit.filter((item) => item.classification === "SAFE_ALIAS");
  const reviewAliases = aliasAudit.filter((item) => item.classification === "REVIEW_ALIAS");
  const invalidAliases = aliasAudit.filter((item) => item.classification === "INVALID_ALIAS");
  const invalidSpecialtyIds = invalid.specialties.map((item) => item.id);
  const invalidSpecialtyInfo = invalidSpecialtyIds.length === 0 ? [] : await prisma.academicInfo.findMany({ where: { specialtyId: { in: invalidSpecialtyIds } }, select: { id: true, personId: true, specialtyId: true, person: { select: { id: true, firstName: true, paternalLastName: true, maternalLastName: true, applications: { select: { id: true, applicationCode: true, status: true } } } } } });
  const invalidSpecialtyDetails = invalid.specialties.map((item) => ({ ...item, academicInfo: invalidSpecialtyInfo.filter((academic) => academic.specialtyId === item.id).map((academic) => ({ academicInfoId: academic.id, personId: academic.personId, personName: [academic.person.firstName, academic.person.paternalLastName, academic.person.maternalLastName].filter(Boolean).join(" "), applications: academic.person.applications })), candidateSpecialty: null, recommendation: item.academicInfoReferences > 0 ? "REASSIGN_MANUALLY" : item.recommendation }));
  const approvedPlan = { generatedAt: new Date().toISOString(), readOnly: true, warning: "Propuesta: no ejecutar sin aprobación explícita.", universities: safeUniversities.map((group) => ({ canonicalId: group.canonicalCandidate?.id, canonicalName: group.canonicalCandidate?.name, duplicateIds: group.duplicateIds, aliases: safeAliases.filter((alias) => alias.type === "UNIVERSITY" && alias.canonicalId === group.canonicalCandidate?.id).map((alias) => alias.alias), academicInfoAffected: group.affectedAcademicInfo })), specialties: safeSpecialties.map((group) => ({ canonicalId: group.canonicalCandidate?.id, canonicalName: group.canonicalCandidate?.name, duplicateIds: group.duplicateIds, aliases: safeAliases.filter((alias) => alias.type === "SPECIALTY" && alias.canonicalId === group.canonicalCandidate?.id).map((alias) => alias.alias), academicInfoAffected: group.affectedAcademicInfo })) };
  const relationReview = {
    universityForeignKeys: [{ model: "AcademicInfo", field: "universityId", relation: "University", onDelete: "Restrict", onUpdate: "database default/not explicitly specified" }],
    specialtyForeignKeys: [{ model: "AcademicInfo", field: "specialtyId", relation: "Specialty", onDelete: "Restrict", onUpdate: "database default/not explicitly specified" }],
    note: "La revisión de schema.prisma no encontró otras relaciones que apunten directamente a University o Specialty.",
  };
  const dryRunSummary = {
    generatedAt: new Date().toISOString(),
    readOnly: true,
    summary: { totalGroups: universityPlan.length, safeToMerge: safeUniversities.length, reviewRequired: universityPlan.filter((group) => group.classification === "REVIEW_REQUIRED").length, doNotMerge: universityPlan.filter((group) => group.classification === "DO_NOT_MERGE").length, academicInfoAffected: safeUniversities.reduce((total, group) => total + group.affectedAcademicInfo, 0), duplicateIdsInvolved: [...new Set(safeUniversities.flatMap((group) => group.duplicateIds))].length },
    groups: universityPlan,
    proposedTransactionalPlan: ["BEGIN", "actualizar FKs duplicados hacia canonicalId", "validar conteos y foreign keys", "marcar duplicados inactivos o conservarlos como alias", "no eliminar inmediatamente", "COMMIT"],
    relationReview,
  };
  const specialtyDryRunSummary = {
    generatedAt: new Date().toISOString(),
    readOnly: true,
    summary: { totalGroups: specialtyPlan.length, safeToMerge: safeSpecialties.length, reviewRequired: specialtyPlan.filter((group) => group.classification === "REVIEW_REQUIRED").length, doNotMerge: specialtyPlan.filter((group) => group.classification === "DO_NOT_MERGE").length, academicInfoAffected: safeSpecialties.reduce((total, group) => total + group.affectedAcademicInfo, 0), duplicateIdsInvolved: [...new Set(safeSpecialties.flatMap((group) => group.duplicateIds))].length },
    groups: specialtyPlan,
    proposedTransactionalPlan: ["BEGIN", "actualizar FKs duplicados hacia canonicalId", "validar conteos y foreign keys", "marcar duplicados inactivos o conservarlos como alias", "no eliminar inmediatamente", "COMMIT"],
    relationReview,
  };
  await mkdir(path.join(root, "reports"), { recursive: true });
  await mkdir(path.join(root, "config"), { recursive: true });
  await writeFile(path.join(root, "reports", "university-consolidation-dry-run.json"), JSON.stringify(dryRunSummary, null, 2) + "\n", "utf8");
  await writeFile(path.join(root, "reports", "specialty-consolidation-dry-run.json"), JSON.stringify(specialtyDryRunSummary, null, 2) + "\n", "utf8");
  await writeFile(path.join(root, "reports", "legacy-invalid-values.json"), JSON.stringify({ generatedAt: dryRunSummary.generatedAt, readOnly: true, ...invalid }, null, 2) + "\n", "utf8");
  await writeFile(path.join(root, "reports", "legacy-manual-review.json"), JSON.stringify({ generatedAt: dryRunSummary.generatedAt, readOnly: true, ...manualReview }, null, 2) + "\n", "utf8");
  await writeFile(path.join(root, "reports", "legacy-invalid-values.json"), JSON.stringify({ generatedAt: dryRunSummary.generatedAt, readOnly: true, universities: invalid.universities, specialties: invalidSpecialtyDetails }, null, 2) + "\n", "utf8");
  await writeFile(path.join(root, "reports", "legacy-manual-review.json"), JSON.stringify({ generatedAt: dryRunSummary.generatedAt, readOnly: true, ...manualReview, aliases: { safe: safeAliases, review: reviewAliases, invalid: invalidAliases } }, null, 2) + "\n", "utf8");
  await writeFile(path.join(root, "config", "canonical-aliases.candidate.json"), JSON.stringify({ ...aliases, audit: { safe: safeAliases, review: reviewAliases, invalid: invalidAliases } }, null, 2) + "\n", "utf8");
  await writeFile(path.join(root, "config", "academic-consolidation.approved-plan.json"), JSON.stringify(approvedPlan, null, 2) + "\n", "utf8");
  console.log(JSON.stringify({ universities: dryRunSummary.summary, specialties: specialtyDryRunSummary.summary, invalidWithReferences: { universities: invalid.universities.filter((item) => item.academicInfoReferences > 0).length, specialties: invalidSpecialtyDetails.filter((item) => item.academicInfoReferences > 0).length }, invalidSpecialtyDetails, aliases: { safe: safeAliases.length, review: reviewAliases.length, invalid: invalidAliases.length }, foreignKeys: relationReview }, null, 2));
}

main().catch((error: unknown) => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
