import type { ClassifiedEntry } from "./SieIdentityDryRunService";

export type CategorySlice = {
  total: number;
  personMatched: number;
  personNotFound: number;
  documentUnmapped: number;
  emailAvailable: number;
  emailMissing: number;
  emailConflict: number;
  categoryMatch: number;
  categoryMismatch: number;
};

export type OtherCategorySlice = {
  description: string;
  total: number;
  personMatched: number;
  personNotFound: number;
  documentUnmapped: number;
  emailAvailable: number;
  emailMissing: number;
};

export type MultiCodeSummary = {
  persons: number;
  totalExternalCodes: number;
  maxCodesPerPerson: number;
  sameCategoryCodes: number;
  differentCategoryCodes: number;
};

export type CandidateSummary = {
  activeUsers: number;
  studentUsers: number;
  total: number;
  blockedActive: number;
  blockedStudent: number;
  blockedReasons: Record<string, number>;
};

export type GroupSummary = {
  readyForQaAccount: number;
  storeIdentityCategoryOnly: number;
  manualReview: number;
  unaccounted: number;
};

export type PopulationBreakdown = {
  active: CategorySlice;
  student: CategorySlice;
  others: Record<string, OtherCategorySlice>;
  mismatchMatrix: Record<string, number>;
  multiCode: MultiCodeSummary;
  candidates: CandidateSummary;
  groups: GroupSummary;
};

const OTHER_TYPES = ["X", "R", "U", "F", "V", "H", "T"];

function emptySlice(): CategorySlice {
  return {
    total: 0,
    personMatched: 0,
    personNotFound: 0,
    documentUnmapped: 0,
    emailAvailable: 0,
    emailMissing: 0,
    emailConflict: 0,
    categoryMatch: 0,
    categoryMismatch: 0,
  };
}

function sliceFor(entries: ClassifiedEntry[], sourceType: "A" | "E"): CategorySlice {
  const slice = emptySlice();
  for (const { record, classification } of entries) {
    if (record.sourceType !== sourceType) continue;
    slice.total += 1;
    if (classification.identity === "PERSON_MATCHED") slice.personMatched += 1;
    else if (classification.identity === "PERSON_NOT_FOUND") slice.personNotFound += 1;
    else if (classification.identity === "DOCUMENT_TYPE_UNMAPPED") slice.documentUnmapped += 1;

    if (classification.identity === "PERSON_MATCHED") {
      if (classification.emailClass === "EMAIL_AVAILABLE") slice.emailAvailable += 1;
      else if (classification.emailClass === "EMAIL_MISSING") slice.emailMissing += 1;
      else if (classification.emailClass === "EMAIL_CONFLICT") slice.emailConflict += 1;
      if (classification.categoryMismatch) slice.categoryMismatch += 1;
      else slice.categoryMatch += 1;
    }
  }
  return slice;
}

export function buildPopulationBreakdown(entries: ClassifiedEntry[]): PopulationBreakdown {
  const active = sliceFor(entries, "A");
  const student = sliceFor(entries, "E");

  const others: Record<string, OtherCategorySlice> = {};
  for (const type of OTHER_TYPES) {
    others[type] = { description: "", total: 0, personMatched: 0, personNotFound: 0, documentUnmapped: 0, emailAvailable: 0, emailMissing: 0 };
  }

  const mismatchMatrix: Record<string, number> = {};

  for (const { record, context, classification } of entries) {
    if (record.sourceType === "A" || record.sourceType === "E") {
      if (classification.identity === "PERSON_MATCHED") {
        const local = context.localAffiliateType ?? "NONE";
        const key = `${record.sourceType}->${local}`;
        mismatchMatrix[key] = (mismatchMatrix[key] ?? 0) + 1;
      }
      continue;
    }

    const bucket = others[record.sourceType];
    if (!bucket) continue;
    bucket.description = record.sourceDescription;
    bucket.total += 1;
    if (classification.identity === "PERSON_MATCHED") {
      bucket.personMatched += 1;
      if (classification.emailClass === "EMAIL_AVAILABLE") bucket.emailAvailable += 1;
      else if (classification.emailClass === "EMAIL_MISSING") bucket.emailMissing += 1;
    } else if (classification.identity === "PERSON_NOT_FOUND") {
      bucket.personNotFound += 1;
    } else if (classification.identity === "DOCUMENT_TYPE_UNMAPPED") {
      bucket.documentUnmapped += 1;
    }
  }

  const codesByPerson = new Map<number, Map<string, string>>();
  for (const { record, context } of entries) {
    if (!context.person || !record.externalCode) continue;
    const codes = codesByPerson.get(context.person.id) ?? new Map<string, string>();
    codes.set(record.externalCode, record.sourceType);
    codesByPerson.set(context.person.id, codes);
  }

  const multiCode: MultiCodeSummary = { persons: 0, totalExternalCodes: 0, maxCodesPerPerson: 0, sameCategoryCodes: 0, differentCategoryCodes: 0 };
  for (const codes of codesByPerson.values()) {
    if (codes.size <= 1) continue;
    multiCode.persons += 1;
    multiCode.totalExternalCodes += codes.size;
    if (codes.size > multiCode.maxCodesPerPerson) multiCode.maxCodesPerPerson = codes.size;
    const categories = new Set(codes.values());
    if (categories.size > 1) multiCode.differentCategoryCodes += 1;
    else multiCode.sameCategoryCodes += 1;
  }

  let candidateActive = 0;
  let candidateStudent = 0;
  const blockedReasons: Record<string, number> = {};
  for (const { record, classification } of entries) {
    if (record.sourceType !== "A" && record.sourceType !== "E") continue;
    if (classification.action === "WOULD_CREATE_USER_AND_CREDENTIAL") {
      if (record.sourceType === "A") candidateActive += 1;
      else candidateStudent += 1;
    } else {
      const reason = primaryBlockReason(classification);
      blockedReasons[reason] = (blockedReasons[reason] ?? 0) + 1;
    }
  }

  const candidates: CandidateSummary = {
    activeUsers: candidateActive,
    studentUsers: candidateStudent,
    total: candidateActive + candidateStudent,
    blockedActive: active.total - candidateActive,
    blockedStudent: student.total - candidateStudent,
    blockedReasons,
  };

  const otherTotal = Object.values(others).reduce((sum, bucket) => sum + bucket.total, 0);
  const readyForQaAccount = candidates.total;
  const manualReview = entries.length - readyForQaAccount - otherTotal;
  const groups: GroupSummary = {
    readyForQaAccount,
    storeIdentityCategoryOnly: otherTotal,
    manualReview,
    unaccounted: entries.length - readyForQaAccount - otherTotal - manualReview,
  };

  return { active, student, others, mismatchMatrix, multiCode, candidates, groups };
}

function primaryBlockReason(classification: ClassifiedEntry["classification"]): string {
  if (classification.identity === "DOCUMENT_TYPE_UNMAPPED") return "DOCUMENT_TYPE_UNMAPPED";
  if (classification.identity === "PERSON_NOT_FOUND") return "PERSON_NOT_FOUND";
  if (classification.reviewReasons.includes("DUPLICATE_SIE_CODE")) return "IDENTITY_CONFLICT";
  if (classification.categoryMismatch) return "CATEGORY_MISMATCH";
  if (classification.emailClass === "EMAIL_CONFLICT") return "EMAIL_CONFLICT";
  if (classification.emailClass === "EMAIL_MISSING") return "EMAIL_MISSING";
  if (classification.reviewReasons.includes("UNMAPPED_CATEGORY")) return "UNMAPPED_CATEGORY";
  return "OTHER";
}
