import { describe, expect, it } from "vitest";
import { buildReport, classifyAll, classifyRecord, mapSieCategory } from "../Services/SieIdentityDryRunService";
import type { RecordContext, SieDryRunInput } from "../Services/SieIdentityDryRunService";
import type { SanitizedSieAssociate } from "../Models/SieAssociateList";

const record = (overrides: Partial<SanitizedSieAssociate> = {}): SanitizedSieAssociate => ({
  documentType: "1",
  documentNumber: "71234567",
  externalCode: "00012",
  sourceType: "A",
  sourceDescription: "Activo",
  passwordPresent: true,
  ...overrides,
});

const personContext = (overrides: Partial<RecordContext> = {}): RecordContext => ({
  person: { id: 1, documentType: "DNI", documentNumber: "71234567" },
  ambiguous: false,
  user: null,
  activePasswordCount: 0,
  candidateEmail: "associate@example.com",
  emailConflict: false,
  localAffiliateType: "ACTIVE",
  ...overrides,
});

const existingUser = () => ({ id: 2, type: "AFFILIATE", status: "ACTIVE", roleSlug: "ASOCIADO_ACTIVO" });

describe("SieIdentityDryRunService", () => {
  it("A / Activo se mapea a ASOCIADO_ACTIVO y clasifica WOULD_CREATE_USER_AND_CREDENTIAL", () => {
    const classification = classifyRecord(record({ sourceType: "A", sourceDescription: "Activo" }), personContext());
    expect(classification.identity).toBe("PERSON_MATCHED");
    expect(classification.categoryMapped).toBe(true);
    expect(classification.userClass).toBe("NO_USER");
    expect(classification.credentialClass).toBe("NO_ACTIVE_PASSWORD");
    expect(classification.emailClass).toBe("EMAIL_AVAILABLE");
    expect(classification.action).toBe("WOULD_CREATE_USER_AND_CREDENTIAL");
    expect(classification.wouldLinkExternalIdentity).toBe(true);
    expect(classification.wouldLinkCategory).toBe(true);
  });

  it("E / Estudiante se mapea a ASOCIADO_ESTUDIANTE sin mismatch", () => {
    expect(mapSieCategory("E")?.roleSlug).toBe("ASOCIADO_ESTUDIANTE");
    const classification = classifyRecord(record({ sourceType: "E", sourceDescription: "Estudiante" }), personContext({ localAffiliateType: "STUDENT" }));
    expect(classification.categoryMapped).toBe(true);
    expect(classification.categoryMismatch).toBe(false);
  });

  it("categoría desconocida (V/Vitalicio) queda UNMAPPED y MANUAL_REVIEW", () => {
    const classification = classifyRecord(record({ sourceType: "V", sourceDescription: "Vitalicio" }), personContext());
    expect(classification.categoryMapped).toBe(false);
    expect(classification.action).toBe("MANUAL_REVIEW");
    expect(classification.reviewReasons).toContain("UNMAPPED_CATEGORY");
  });

  it("document type desconocido (6/RUC) → DOCUMENT_TYPE_UNMAPPED", () => {
    const classification = classifyRecord(record({ documentType: "6" }), personContext({ person: null }));
    expect(classification.identity).toBe("DOCUMENT_TYPE_UNMAPPED");
    expect(classification.action).toBe("MANUAL_REVIEW");
    expect(classification.reviewReasons).toContain("DOCUMENT_TYPE_UNMAPPED");
  });

  it("Person inexistente → PERSON_NOT_FOUND", () => {
    const classification = classifyRecord(record(), personContext({ person: null }));
    expect(classification.identity).toBe("PERSON_NOT_FOUND");
    expect(classification.action).toBe("MANUAL_REVIEW");
  });

  it("Person sin User → NO_USER", () => {
    const classification = classifyRecord(record(), personContext({ user: null }));
    expect(classification.userClass).toBe("NO_USER");
  });

  it("User sin Credential activa → NO_ACTIVE_PASSWORD y WOULD_CREATE_CREDENTIAL", () => {
    const classification = classifyRecord(record(), personContext({ user: existingUser(), activePasswordCount: 0 }));
    expect(classification.credentialClass).toBe("NO_ACTIVE_PASSWORD");
    expect(classification.action).toBe("WOULD_CREATE_CREDENTIAL");
  });

  it("User con una Credential activa → WOULD_PRESERVE_EXISTING", () => {
    const classification = classifyRecord(record(), personContext({ user: existingUser(), activePasswordCount: 1 }));
    expect(classification.credentialClass).toBe("ONE_ACTIVE_PASSWORD");
    expect(classification.action).toBe("WOULD_PRESERVE_EXISTING");
  });

  it("User con múltiples Credential activas → MANUAL_REVIEW", () => {
    const classification = classifyRecord(record(), personContext({ user: existingUser(), activePasswordCount: 2 }));
    expect(classification.credentialClass).toBe("MULTIPLE_ACTIVE_PASSWORDS");
    expect(classification.action).toBe("MANUAL_REVIEW");
    expect(classification.reviewReasons).toContain("MULTIPLE_ACTIVE_PASSWORDS");
  });

  it("email faltante → EMAIL_MISSING y MANUAL_REVIEW", () => {
    const classification = classifyRecord(record(), personContext({ candidateEmail: null }));
    expect(classification.emailClass).toBe("EMAIL_MISSING");
    expect(classification.action).toBe("MANUAL_REVIEW");
  });

  it("email conflictivo → EMAIL_CONFLICT y MANUAL_REVIEW", () => {
    const classification = classifyRecord(record(), personContext({ candidateEmail: "other@example.com", emailConflict: true }));
    expect(classification.emailClass).toBe("EMAIL_CONFLICT");
    expect(classification.action).toBe("MANUAL_REVIEW");
  });

  it("Codigo con ceros a la izquierda se preserva y se cuenta", () => {
    const entries = classifyAll([{ record: record({ externalCode: "00012" }), context: personContext() }]);
    expect(entries[0].record.externalCode).toBe("00012");
    expect(buildReport(entries).sieCodesWithLeadingZeros).toBe(1);
  });

  it("Codigo duplicado → MANUAL_REVIEW y no linkea identidad", () => {
    const inputs: SieDryRunInput[] = [
      { record: record({ externalCode: "00012" }), context: personContext() },
      { record: record({ externalCode: "00012" }), context: personContext({ person: { id: 2, documentType: "DNI", documentNumber: "99999999" } }) },
    ];
    const entries = classifyAll(inputs);
    expect(entries[0].classification.action).toBe("MANUAL_REVIEW");
    expect(entries[0].classification.reviewReasons).toContain("DUPLICATE_SIE_CODE");
    expect(entries[0].classification.wouldLinkExternalIdentity).toBe(false);
    expect(buildReport(entries).duplicateSieCodes).toBe(1);
  });

  it("Clave presente → passwordPresent=true habilita la creación", () => {
    const classification = classifyRecord(record({ passwordPresent: true }), personContext());
    expect(classification.action).toBe("WOULD_CREATE_USER_AND_CREDENTIAL");
  });

  it("Clave ausente → WOULD_SKIP cuando la acción depende de la contraseña", () => {
    const classification = classifyRecord(record({ passwordPresent: false }), personContext());
    expect(classification.action).toBe("WOULD_SKIP");
  });

  it("detecta ROLE_MISMATCH y USER_TYPE_MISMATCH", () => {
    const classification = classifyRecord(record(), personContext({ user: { id: 2, type: "VALIDATOR", status: "ACTIVE", roleSlug: "LOGISTICA" }, activePasswordCount: 1 }));
    expect(classification.roleMismatch).toBe(true);
    expect(classification.userTypeMismatch).toBe(true);
    expect(classification.action).toBe("MANUAL_REVIEW");
  });

  it("detecta CATEGORY_MISMATCH entre SIE y datos locales", () => {
    const classification = classifyRecord(record({ sourceType: "A" }), personContext({ localAffiliateType: "STUDENT" }));
    expect(classification.categoryMismatch).toBe(true);
    expect(classification.action).toBe("MANUAL_REVIEW");
  });

  it("el reporte serializado no contiene claves ni secretos", () => {
    const inputs: SieDryRunInput[] = [record(), record({ sourceType: "V", sourceDescription: "Vitalicio" })].map((r) => ({ record: r, context: personContext() }));
    const report = buildReport(classifyAll(inputs));
    const json = JSON.stringify(report);
    expect(json).not.toContain("Clave");
    expect(json).not.toContain("secret");
    expect(json).not.toContain("plaintext");
    expect(report.totalSieRecords).toBe(2);
    expect(report.topManualReviewReasons).toBeDefined();
  });
});
