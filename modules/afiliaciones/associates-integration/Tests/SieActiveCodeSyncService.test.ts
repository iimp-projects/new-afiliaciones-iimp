import { describe, expect, it } from "vitest";
import {
  classifyActiveCodeSync,
  detectDuplicateCodes,
  maskDocument,
  namesMatch,
  normalizeName,
} from "../Services/SieActiveCodeSyncService";

const person = { id: 1, firstName: "María", paternalLastName: "Pérez", maternalLastName: "López" };

describe("classifyActiveCodeSync", () => {
  it("vincula (LINK) un código válido con identidad y documento coincidentes", () => {
    const decision = classifyActiveCodeSync(
      { documentType: "1", documentNumber: "12345678", externalCode: "CODE-1", nombres: "Maria", apellidoPaterno: "Perez", apellidoMaterno: "Lopez" },
      person,
      null,
      null,
    );
    expect(decision.kind).toBe("LINK");
    if (decision.kind === "LINK") {
      expect(decision.externalCode).toBe("CODE-1");
      expect(decision.personId).toBe(1);
    }
  });

  it("omite códigos vacíos (SKIP_EMPTY_CODE)", () => {
    const decision = classifyActiveCodeSync({ documentType: "1", documentNumber: "12345678", externalCode: "   " }, person, null, null);
    expect(decision.kind).toBe("SKIP_EMPTY_CODE");
  });

  it("omite personas locales inexistentes (SKIP_NOT_LOCAL)", () => {
    const decision = classifyActiveCodeSync({ documentType: "1", documentNumber: "999", externalCode: "CODE-1" }, null, null, null);
    expect(decision.kind).toBe("SKIP_NOT_LOCAL");
  });

  it("rechaza nombres inconsistentes (CONFLICT_NAMES)", () => {
    const decision = classifyActiveCodeSync(
      { documentType: "1", documentNumber: "12345678", externalCode: "CODE-1", nombres: "Juan", apellidoPaterno: "Perez" },
      person,
      null,
      null,
    );
    expect(decision.kind).toBe("CONFLICT_NAMES");
  });

  it("rechaza un código ya vinculado a otra persona (CONFLICT_CODE_OWNED_BY_OTHER)", () => {
    const decision = classifyActiveCodeSync(
      { documentType: "1", documentNumber: "12345678", externalCode: "CODE-1" },
      person,
      { externalCode: "CODE-1", personId: 99, linkStatus: "LINKED" },
      null,
    );
    expect(decision.kind).toBe("CONFLICT_CODE_OWNED_BY_OTHER");
  });

  it("rechaza una persona ya vinculada a otro código (CONFLICT_PERSON_ALREADY_LINKED)", () => {
    const decision = classifyActiveCodeSync(
      { documentType: "1", documentNumber: "12345678", externalCode: "CODE-2" },
      person,
      null,
      { externalCode: "CODE-OLD", personId: 1, linkStatus: "LINKED" },
    );
    expect(decision.kind).toBe("CONFLICT_PERSON_ALREADY_LINKED");
  });

  it("es idempotente: la misma vinculación previa devuelve UNCHANGED", () => {
    const decision = classifyActiveCodeSync(
      { documentType: "1", documentNumber: "12345678", externalCode: "CODE-1" },
      person,
      { externalCode: "CODE-1", personId: 1, linkStatus: "LINKED" },
      { externalCode: "CODE-1", personId: 1, linkStatus: "LINKED" },
    );
    expect(decision.kind).toBe("UNCHANGED");
  });

  it("revincula (LINK) cuando el registro previo está UNLINKED/CONFLICT", () => {
    const decision = classifyActiveCodeSync(
      { documentType: "1", documentNumber: "12345678", externalCode: "CODE-1" },
      person,
      { externalCode: "CODE-1", personId: 1, linkStatus: "UNLINKED" },
      null,
    );
    expect(decision.kind).toBe("LINK");
  });
});

describe("detectDuplicateCodes", () => {
  it("detecta un código asociado a más de un documento", () => {
    const duplicates = detectDuplicateCodes([
      { externalCode: "CODE-1", documentNumber: "111" },
      { externalCode: "CODE-1", documentNumber: "222" },
      { externalCode: "CODE-2", documentNumber: "333" },
    ]);
    expect(duplicates.has("CODE-1")).toBe(true);
    expect(duplicates.has("CODE-2")).toBe(false);
  });

  it("ignora códigos vacíos", () => {
    const duplicates = detectDuplicateCodes([{ externalCode: " ", documentNumber: "111" }]);
    expect(duplicates.size).toBe(0);
  });
});

describe("normalizeName / namesMatch", () => {
  it("normaliza acentos, mayúsculas y espacios", () => {
    expect(normalizeName("  María García ")).toBe("maria garcia");
    expect(normalizeName("PÉREZ")).toBe("perez");
  });

  it("considera coincidencia cuando un lado no tiene el campo", () => {
    expect(namesMatch({ nombres: null, apellidoPaterno: "Perez" }, { firstName: "Maria", paternalLastName: "Perez", maternalLastName: null })).toBe(true);
  });

  it("detecta diferencia de apellido materno", () => {
    expect(namesMatch({ nombres: "Maria", apellidoPaterno: "Perez", apellidoMaterno: "Diaz" }, person)).toBe(false);
  });
});

describe("maskDocument", () => {
  it("enmascara el documento conservando solo inicio y final", () => {
    expect(maskDocument("41000057")).toBe("41****57");
  });

  it("no revela documentos cortos ni vacíos", () => {
    expect(maskDocument("123")).toBe("****");
    expect(maskDocument("")).toBe("—");
    expect(maskDocument(null)).toBe("—");
  });
});
