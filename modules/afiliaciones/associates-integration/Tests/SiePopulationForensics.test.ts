import { describe, expect, it } from "vitest";
import { classifyAll } from "../Services/SieIdentityDryRunService";
import { buildPopulationBreakdown } from "../Services/SiePopulationForensics";
import type { RecordContext, SieDryRunInput } from "../Services/SieIdentityDryRunService";
import type { SanitizedSieAssociate } from "../Models/SieAssociateList";

const record = (overrides: Partial<SanitizedSieAssociate> = {}): SanitizedSieAssociate => ({
  documentType: "1",
  documentNumber: "71234567",
  externalCode: "00001",
  sourceType: "A",
  sourceDescription: "Activo",
  passwordPresent: true,
  ...overrides,
});

const ctx = (overrides: Partial<RecordContext> = {}): RecordContext => ({
  person: { id: 1, documentType: "DNI", documentNumber: "71234567" },
  ambiguous: false,
  user: null,
  activePasswordCount: 0,
  candidateEmail: "a@b.c",
  emailConflict: false,
  localAffiliateType: "ACTIVE",
  ...overrides,
});

describe("SiePopulationForensics", () => {
  it("reconcilia A/E, categorías no accesibles y grupos sin residuo", () => {
    const inputs: SieDryRunInput[] = [
      { record: record({ documentNumber: "1", externalCode: "00001", sourceType: "A" }), context: ctx() },
      { record: record({ documentNumber: "2", externalCode: "00002", sourceType: "A" }), context: ctx({ candidateEmail: null }) },
      { record: record({ documentNumber: "3", externalCode: "00003", sourceType: "A" }), context: ctx({ person: null }) },
      { record: record({ documentNumber: "4", externalCode: "00004", sourceType: "E", sourceDescription: "Estudiante" }), context: ctx({ localAffiliateType: "STUDENT" }) },
      { record: record({ documentNumber: "5", externalCode: "00005", sourceType: "X", sourceDescription: "Separado" }), context: ctx({ person: null }) },
    ];
    const entries = classifyAll(inputs);
    const breakdown = buildPopulationBreakdown(entries);

    expect(breakdown.active.total).toBe(3);
    expect(breakdown.active.personMatched).toBe(2);
    expect(breakdown.active.personNotFound).toBe(1);
    expect(breakdown.student.total).toBe(1);
    expect(breakdown.student.personMatched).toBe(1);
    expect(breakdown.others.X.total).toBe(1);
    expect(breakdown.others.X.personNotFound).toBe(1);

    expect(breakdown.candidates.activeUsers).toBe(1);
    expect(breakdown.candidates.studentUsers).toBe(1);
    expect(breakdown.candidates.total).toBe(2);
    expect(breakdown.candidates.blockedActive).toBe(2);
    expect(breakdown.candidates.blockedStudent).toBe(0);

    const { readyForQaAccount, storeIdentityCategoryOnly, manualReview, unaccounted } = breakdown.groups;
    expect(readyForQaAccount).toBe(2);
    expect(storeIdentityCategoryOnly).toBe(1);
    expect(manualReview).toBe(2);
    expect(unaccounted).toBe(0);
    expect(readyForQaAccount + storeIdentityCategoryOnly + manualReview).toBe(5);
  });

  it("detecta categoría mismatch en la matriz", () => {
    const inputs: SieDryRunInput[] = [
      { record: record({ sourceType: "A" }), context: ctx({ localAffiliateType: "STUDENT" }) },
      { record: record({ documentNumber: "9", externalCode: "00009", sourceType: "A" }), context: ctx({ localAffiliateType: "ACTIVE" }) },
    ];
    const breakdown = buildPopulationBreakdown(classifyAll(inputs));
    expect(breakdown.mismatchMatrix["A->STUDENT"]).toBe(1);
    expect(breakdown.mismatchMatrix["A->ACTIVE"]).toBe(1);
    expect(breakdown.active.categoryMismatch).toBe(1);
    expect(breakdown.active.categoryMatch).toBe(1);
  });

  it("detecta personas con múltiples códigos SIE", () => {
    const inputs: SieDryRunInput[] = [
      { record: record({ externalCode: "00001", sourceType: "A" }), context: ctx() },
      { record: record({ externalCode: "00002", sourceType: "A" }), context: ctx() },
    ];
    const breakdown = buildPopulationBreakdown(classifyAll(inputs));
    expect(breakdown.multiCode.persons).toBe(1);
    expect(breakdown.multiCode.totalExternalCodes).toBe(2);
    expect(breakdown.multiCode.maxCodesPerPerson).toBe(2);
    expect(breakdown.multiCode.sameCategoryCodes).toBe(1);
    expect(breakdown.multiCode.differentCategoryCodes).toBe(0);
  });
});
