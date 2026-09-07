import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type Group = { canonicalCandidate: { id: number; name: string } | null; members: Array<{ id: number; name: string; acronym: string | null; country: string | null; academicInfoReferences: number; draftOccurrences: number }>; classification: string; reason: string };

async function main(): Promise<void> {
  const root = process.cwd();
  const universityReport = JSON.parse(await readFile(path.join(root, "reports", "university-consolidation-dry-run.json"), "utf8"));
  const invalidReport = JSON.parse(await readFile(path.join(root, "reports", "legacy-invalid-values.json"), "utf8"));
  const reviewGroups = (universityReport.groups as Group[]).filter((group) => group.classification === "REVIEW_REQUIRED");
  const universityDecisions = reviewGroups.map((group) => {
    const ids = group.members.map((member) => member.id);
    const santa = ids.includes(25) && ids.includes(799);
    return {
      type: "UNIVERSITY",
      ids,
      canonicalId: santa ? 25 : null,
      duplicateIds: santa ? [799] : [],
      decision: santa ? "APPROVE_MERGE" : "MANUAL_REVIEW",
      reason: santa ? "Mismo nombre normalizado, mismo país Perú y el registro 25 conserva el acrónimo UNS; el registro 799 tiene 2 referencias pero carece de acrónimo." : "País almacenado inconsistente con el nombre institucional; no se puede aprobar una consolidación sin confirmar countryId y procedencia.",
      evidence: group.members.map((member) => ({ id: member.id, name: member.name, acronym: member.acronym, country: member.country, academicInfoReferences: member.academicInfoReferences, draftOccurrences: member.draftOccurrences })),
    };
  });
  const specialtyDecisions = invalidReport.specialties.map((item: { id: number; name: string; academicInfo: Array<{ academicInfoId: number; personId: number; personName: string; applications: Array<{ id: number; applicationCode: string; status: string }> }>; academicInfoReferences: number }) => ({
    type: "SPECIALTY_INVALID",
    specialtyId: item.id,
    value: item.name,
    decision: "NEEDS_MANUAL_INPUT",
    recommendation: "KEEP_UNRESOLVED",
    reason: "El valor es un año o guion y no aporta evidencia para inferir una especialidad canónica; no se reasigna automáticamente.",
    academicInfo: item.academicInfo,
  }));
  const decisions = { generatedAt: new Date().toISOString(), readOnly: true, universities: universityDecisions, invalidSpecialties: specialtyDecisions, pending: universityDecisions.filter((item) => item.decision === "MANUAL_REVIEW").length + specialtyDecisions.length };
  const previousPlan = JSON.parse(await readFile(path.join(root, "config", "academic-consolidation.approved-plan.json"), "utf8"));
  const santa = universityDecisions.find((item) => item.canonicalId === 25);
  const planV2 = {
    generatedAt: decisions.generatedAt,
    readOnly: true,
    warning: "Propuesta v2: no ejecutar sin aprobación explícita.",
    universities: [...previousPlan.universities, ...(santa ? [{ canonicalId: 25, canonicalName: "Universidad Nacional del Santa", duplicateIds: [799], aliases: ["UNS"], academicInfoAffected: 2 }] : [])],
    specialties: previousPlan.specialties,
    excluded: { universityReviewPending: universityDecisions.filter((item) => item.decision === "MANUAL_REVIEW").map((item) => item.ids), invalidSpecialtiesPending: specialtyDecisions.map((item) => item.specialtyId), degreeTitle: true },
  };
  await mkdir(path.join(root, "config"), { recursive: true });
  await writeFile(path.join(root, "config", "academic-consolidation.manual-decisions.json"), JSON.stringify(decisions, null, 2) + "\n", "utf8");
  await writeFile(path.join(root, "config", "academic-consolidation.approved-plan.v2.json"), JSON.stringify(planV2, null, 2) + "\n", "utf8");
  console.log(JSON.stringify({ universityDecisions, invalidSpecialties: specialtyDecisions.map((item) => ({ specialtyId: item.specialtyId, decision: item.decision, recommendation: item.recommendation })), planV2: { universities: planV2.universities.length, specialties: planV2.specialties.length, expectedUpdates: planV2.universities.reduce((n, item) => n + item.academicInfoAffected, 0) + planV2.specialties.reduce((n, item) => n + item.academicInfoAffected, 0) } }, null, 2));
}

main().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
