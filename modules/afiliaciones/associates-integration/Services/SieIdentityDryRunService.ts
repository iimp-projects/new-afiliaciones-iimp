import type { SanitizedSieAssociate } from "../Models/SieAssociateList";
import { mapSieDocumentType } from "../Mappers/SieAssociateListMapper";

export type IdentityClass =
  | "PERSON_MATCHED"
  | "PERSON_NOT_FOUND"
  | "DOCUMENT_TYPE_UNMAPPED"
  | "AMBIGUOUS"
  | "INVALID_RECORD";

export type UserClass = "NO_USER" | "EXISTING_USER";
export type CredentialClass = "NO_ACTIVE_PASSWORD" | "ONE_ACTIVE_PASSWORD" | "MULTIPLE_ACTIVE_PASSWORDS";
export type EmailClass = "EMAIL_AVAILABLE" | "EMAIL_MISSING" | "EMAIL_CONFLICT";
export type ActionClass =
  | "WOULD_CREATE_USER_AND_CREDENTIAL"
  | "WOULD_CREATE_CREDENTIAL"
  | "WOULD_PRESERVE_EXISTING"
  | "WOULD_SKIP"
  | "MANUAL_REVIEW";

export type SieCategoryMapping = {
  sourceType: "A" | "E";
  affiliateType: "ACTIVE" | "STUDENT";
  roleSlug: "ASOCIADO_ACTIVO" | "ASOCIADO_ESTUDIANTE";
};

const SIE_CATEGORY_MAP: Record<string, SieCategoryMapping> = {
  A: { sourceType: "A", affiliateType: "ACTIVE", roleSlug: "ASOCIADO_ACTIVO" },
  E: { sourceType: "E", affiliateType: "STUDENT", roleSlug: "ASOCIADO_ESTUDIANTE" },
};

export function mapSieCategory(sourceType: string): SieCategoryMapping | null {
  return SIE_CATEGORY_MAP[sourceType] ?? null;
}

export type RecordContext = {
  person: { id: number; documentType: string; documentNumber: string } | null;
  ambiguous: boolean;
  user: { id: number; type: string; status: string; roleSlug: string | null } | null;
  activePasswordCount: number;
  candidateEmail: string | null;
  emailConflict: boolean;
  localAffiliateType: "ACTIVE" | "STUDENT" | null;
};

export type ClassifiedRecord = {
  identity: IdentityClass;
  userClass: UserClass | null;
  credentialClass: CredentialClass | null;
  emailClass: EmailClass | null;
  categoryMapped: boolean;
  categoryMismatch: boolean;
  roleMismatch: boolean;
  userTypeMismatch: boolean;
  action: ActionClass;
  wouldLinkExternalIdentity: boolean;
  wouldLinkCategory: boolean;
  reviewReasons: string[];
};

export function classifyRecord(
  record: SanitizedSieAssociate,
  context: RecordContext,
  codeConflict = false,
): ClassifiedRecord {
  const reviewReasons: string[] = [];
  const category = mapSieCategory(record.sourceType);
  const categoryMapped = category !== null;

  let identity: IdentityClass;
  if (!record.documentNumber) {
    identity = "INVALID_RECORD";
  } else if (!mapSieDocumentType(record.documentType)) {
    identity = "DOCUMENT_TYPE_UNMAPPED";
    reviewReasons.push("DOCUMENT_TYPE_UNMAPPED");
  } else if (context.ambiguous) {
    identity = "AMBIGUOUS";
    reviewReasons.push("AMBIGUOUS");
  } else if (!context.person) {
    identity = "PERSON_NOT_FOUND";
    reviewReasons.push("PERSON_NOT_FOUND");
  } else {
    identity = "PERSON_MATCHED";
  }

  let userClass: UserClass | null = null;
  let credentialClass: CredentialClass | null = null;
  let emailClass: EmailClass | null = null;
  let categoryMismatch = false;
  let roleMismatch = false;
  let userTypeMismatch = false;

  if (identity === "PERSON_MATCHED") {
    userClass = context.user ? "EXISTING_USER" : "NO_USER";
    if (context.user) {
      credentialClass =
        context.activePasswordCount === 0
          ? "NO_ACTIVE_PASSWORD"
          : context.activePasswordCount === 1
            ? "ONE_ACTIVE_PASSWORD"
            : "MULTIPLE_ACTIVE_PASSWORDS";
      if (credentialClass === "MULTIPLE_ACTIVE_PASSWORDS") reviewReasons.push("MULTIPLE_ACTIVE_PASSWORDS");
      if (category && context.user.roleSlug && context.user.roleSlug !== category.roleSlug) {
        roleMismatch = true;
        reviewReasons.push("ROLE_MISMATCH");
      }
      if (context.user.type !== "AFFILIATE") {
        userTypeMismatch = true;
        reviewReasons.push("USER_TYPE_MISMATCH");
      }
    } else {
      credentialClass = "NO_ACTIVE_PASSWORD";
    }

    if (!context.candidateEmail) {
      emailClass = "EMAIL_MISSING";
      reviewReasons.push("EMAIL_MISSING");
    } else if (context.emailConflict) {
      emailClass = "EMAIL_CONFLICT";
      reviewReasons.push("EMAIL_CONFLICT");
    } else {
      emailClass = "EMAIL_AVAILABLE";
    }

    if (category && context.localAffiliateType && context.localAffiliateType !== category.affiliateType) {
      categoryMismatch = true;
      reviewReasons.push("CATEGORY_MISMATCH");
    }
    if (!categoryMapped) reviewReasons.push("UNMAPPED_CATEGORY");
  }

  let action: ActionClass;
  if (identity === "INVALID_RECORD") {
    action = "WOULD_SKIP";
  } else if (identity === "DOCUMENT_TYPE_UNMAPPED" || identity === "PERSON_NOT_FOUND" || identity === "AMBIGUOUS") {
    action = "MANUAL_REVIEW";
  } else if (!categoryMapped) {
    action = "MANUAL_REVIEW";
  } else if (categoryMismatch || roleMismatch || userTypeMismatch) {
    action = "MANUAL_REVIEW";
  } else if (credentialClass === "MULTIPLE_ACTIVE_PASSWORDS") {
    action = "MANUAL_REVIEW";
  } else if (credentialClass === "ONE_ACTIVE_PASSWORD") {
    action = "WOULD_PRESERVE_EXISTING";
  } else if (emailClass === "EMAIL_MISSING" || emailClass === "EMAIL_CONFLICT") {
    action = "MANUAL_REVIEW";
  } else if (!record.passwordPresent) {
    action = "WOULD_SKIP";
  } else {
    action = userClass === "NO_USER" ? "WOULD_CREATE_USER_AND_CREDENTIAL" : "WOULD_CREATE_CREDENTIAL";
  }

  if (codeConflict && identity === "PERSON_MATCHED") {
    reviewReasons.push("DUPLICATE_SIE_CODE");
    if (action !== "MANUAL_REVIEW") action = "MANUAL_REVIEW";
  }

  const wouldLinkExternalIdentity = record.externalCode !== "" && identity === "PERSON_MATCHED" && !codeConflict;
  const wouldLinkCategory = record.sourceType !== "" && record.sourceDescription !== "" && identity === "PERSON_MATCHED";

  return {
    identity,
    userClass,
    credentialClass,
    emailClass,
    categoryMapped,
    categoryMismatch,
    roleMismatch,
    userTypeMismatch,
    action,
    wouldLinkExternalIdentity,
    wouldLinkCategory,
    reviewReasons,
  };
}

export type SieDryRunInput = { record: SanitizedSieAssociate; context: RecordContext };

export type ClassifiedEntry = { record: SanitizedSieAssociate; context: RecordContext; classification: ClassifiedRecord };

export function classifyAll(inputs: SieDryRunInput[]): ClassifiedEntry[] {
  const frequencies = new Map<string, number>();
  for (const input of inputs) {
    const code = input.record.externalCode;
    if (code) frequencies.set(code, (frequencies.get(code) ?? 0) + 1);
  }
  return inputs.map((input) => {
    const code = input.record.externalCode;
    const codeConflict = code !== "" && (frequencies.get(code) ?? 0) > 1;
    return {
      record: input.record,
      context: input.context,
      classification: classifyRecord(input.record, input.context, codeConflict),
    };
  });
}

export type DryRunReport = {
  totalSieRecords: number;
  passwordPresentCount: number;
  passwordMissingCount: number;
  documentTypeCounts: Record<string, number>;
  sieTypeCounts: Record<string, number>;
  sieTypesFound: string[];
  sieTypeDescriptionsFound: string[];
  typeACount: number;
  typeECount: number;
  otherTypeCount: number;
  matchedPersons: number;
  personNotFound: number;
  documentTypeUnmapped: number;
  ambiguousPersons: number;
  invalidRecords: number;
  personsWithExistingUser: number;
  personsWithoutUser: number;
  usersWithNoActivePassword: number;
  usersWithOneActivePassword: number;
  usersWithMultipleActivePasswords: number;
  emailAvailable: number;
  emailMissing: number;
  emailConflicts: number;
  sieCodesPresent: number;
  sieCodesMissing: number;
  sieCodesUnique: number;
  duplicateSieCodes: number;
  sieCodesWithLeadingZeros: number;
  personsWithMultipleSieCodes: number;
  categoryMismatch: number;
  roleMismatch: number;
  userTypeMismatch: number;
  unmappedCategoryCount: number;
  wouldCreateUserAndCredential: number;
  wouldCreateCredential: number;
  wouldPreserveExisting: number;
  wouldLinkExternalIdentity: number;
  wouldLinkCategory: number;
  wouldSkip: number;
  manualReview: number;
  topManualReviewReasons: Array<{ reason: string; count: number }>;
};

export function buildReport(entries: ClassifiedEntry[]): DryRunReport {
  const documentTypeCounts: Record<string, number> = {};
  const sieTypeCounts: Record<string, number> = {};
  const sieTypesFound = new Set<string>();
  const sieTypeDescriptionsFound = new Set<string>();
  let passwordPresentCount = 0;
  let typeACount = 0;
  let typeECount = 0;
  let otherTypeCount = 0;

  const codeFrequency = new Map<string, number>();
  const codesByPerson = new Map<number, Set<string>>();
  let sieCodesPresent = 0;
  let sieCodesWithLeadingZeros = 0;

  for (const { record, context } of entries) {
    const documentTypeKey = record.documentType || "(sin tipo)";
    documentTypeCounts[documentTypeKey] = (documentTypeCounts[documentTypeKey] ?? 0) + 1;
    const typeKey = record.sourceType ? `${record.sourceType}|${record.sourceDescription}` : "(sin tipo)";
    sieTypeCounts[typeKey] = (sieTypeCounts[typeKey] ?? 0) + 1;
    if (record.sourceType) sieTypesFound.add(record.sourceType);
    if (record.sourceDescription) sieTypeDescriptionsFound.add(record.sourceDescription);
    if (record.passwordPresent) passwordPresentCount += 1;
    if (record.sourceType === "A") typeACount += 1;
    else if (record.sourceType === "E") typeECount += 1;
    else otherTypeCount += 1;

    const code = record.externalCode;
    if (code) {
      sieCodesPresent += 1;
      codeFrequency.set(code, (codeFrequency.get(code) ?? 0) + 1);
      if (code.length > 1 && code.startsWith("0")) sieCodesWithLeadingZeros += 1;
      if (context.person) {
        const codes = codesByPerson.get(context.person.id) ?? new Set<string>();
        codes.add(code);
        codesByPerson.set(context.person.id, codes);
      }
    }
  }

  const uniqueCodes = codeFrequency.size;
  const duplicateSieCodes = sieCodesPresent - uniqueCodes;
  let personsWithMultipleSieCodes = 0;
  for (const codes of codesByPerson.values()) {
    if (codes.size > 1) personsWithMultipleSieCodes += 1;
  }

  const counts: DryRunReport = {
    totalSieRecords: entries.length,
    passwordPresentCount,
    passwordMissingCount: entries.length - passwordPresentCount,
    documentTypeCounts,
    sieTypeCounts,
    sieTypesFound: [...sieTypesFound].sort(),
    sieTypeDescriptionsFound: [...sieTypeDescriptionsFound].sort(),
    typeACount,
    typeECount,
    otherTypeCount,
    matchedPersons: 0,
    personNotFound: 0,
    documentTypeUnmapped: 0,
    ambiguousPersons: 0,
    invalidRecords: 0,
    personsWithExistingUser: 0,
    personsWithoutUser: 0,
    usersWithNoActivePassword: 0,
    usersWithOneActivePassword: 0,
    usersWithMultipleActivePasswords: 0,
    emailAvailable: 0,
    emailMissing: 0,
    emailConflicts: 0,
    sieCodesPresent,
    sieCodesMissing: entries.length - sieCodesPresent,
    sieCodesUnique: uniqueCodes,
    duplicateSieCodes,
    sieCodesWithLeadingZeros,
    personsWithMultipleSieCodes,
    categoryMismatch: 0,
    roleMismatch: 0,
    userTypeMismatch: 0,
    unmappedCategoryCount: otherTypeCount,
    wouldCreateUserAndCredential: 0,
    wouldCreateCredential: 0,
    wouldPreserveExisting: 0,
    wouldLinkExternalIdentity: 0,
    wouldLinkCategory: 0,
    wouldSkip: 0,
    manualReview: 0,
    topManualReviewReasons: [],
  };

  const reviewCounts = new Map<string, number>();

  for (const { classification } of entries) {
    switch (classification.identity) {
      case "PERSON_MATCHED":
        counts.matchedPersons += 1;
        break;
      case "PERSON_NOT_FOUND":
        counts.personNotFound += 1;
        break;
      case "DOCUMENT_TYPE_UNMAPPED":
        counts.documentTypeUnmapped += 1;
        break;
      case "AMBIGUOUS":
        counts.ambiguousPersons += 1;
        break;
      case "INVALID_RECORD":
        counts.invalidRecords += 1;
        break;
    }

    if (classification.identity === "PERSON_MATCHED") {
      if (classification.userClass === "EXISTING_USER") {
        counts.personsWithExistingUser += 1;
        if (classification.credentialClass === "NO_ACTIVE_PASSWORD") counts.usersWithNoActivePassword += 1;
        else if (classification.credentialClass === "ONE_ACTIVE_PASSWORD") counts.usersWithOneActivePassword += 1;
        else if (classification.credentialClass === "MULTIPLE_ACTIVE_PASSWORDS") counts.usersWithMultipleActivePasswords += 1;
      } else {
        counts.personsWithoutUser += 1;
      }
      if (classification.emailClass === "EMAIL_AVAILABLE") counts.emailAvailable += 1;
      else if (classification.emailClass === "EMAIL_MISSING") counts.emailMissing += 1;
      else if (classification.emailClass === "EMAIL_CONFLICT") counts.emailConflicts += 1;
    }

    if (classification.categoryMismatch) counts.categoryMismatch += 1;
    if (classification.roleMismatch) counts.roleMismatch += 1;
    if (classification.userTypeMismatch) counts.userTypeMismatch += 1;

    if (classification.wouldLinkExternalIdentity) counts.wouldLinkExternalIdentity += 1;
    if (classification.wouldLinkCategory) counts.wouldLinkCategory += 1;

    switch (classification.action) {
      case "WOULD_CREATE_USER_AND_CREDENTIAL":
        counts.wouldCreateUserAndCredential += 1;
        break;
      case "WOULD_CREATE_CREDENTIAL":
        counts.wouldCreateCredential += 1;
        break;
      case "WOULD_PRESERVE_EXISTING":
        counts.wouldPreserveExisting += 1;
        break;
      case "WOULD_SKIP":
        counts.wouldSkip += 1;
        break;
      case "MANUAL_REVIEW":
        counts.manualReview += 1;
        break;
    }

    for (const reason of classification.reviewReasons) {
      reviewCounts.set(reason, (reviewCounts.get(reason) ?? 0) + 1);
    }
  }

  counts.topManualReviewReasons = [...reviewCounts.entries()]
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return counts;
}
