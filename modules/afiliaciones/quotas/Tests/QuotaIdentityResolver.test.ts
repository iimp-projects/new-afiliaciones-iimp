import { describe, expect, it } from "vitest";
import type { NormalizedQuota } from "../Models/QuotaModels";
import { assertUniqueQuotaIdentities, normalizeDocumentType, QuotaIdentityResolver } from "../Services/QuotaIdentityResolver";

const resolver = new QuotaIdentityResolver();
const person = { provider: "SIE", documentType: "DNI", documentNumber: "00123456" };

describe("QuotaIdentityResolver", () => {
  it("preserva ceros iniciales y distingue números distintos", () => {
    const withZeros = resolver.resolvePerson(person);
    const withoutZeros = resolver.resolvePerson({ ...person, documentNumber: "123456" });
    expect(withZeros.personIdentityHash).not.toBe(withoutZeros.personIdentityHash);
    expect(withZeros.documentNumberHash).not.toBe(withoutZeros.documentNumberHash);
  });

  it("resuelve el tipo de documento SIE sin inventar valores", () => {
    expect(normalizeDocumentType("1")).toBe("DNI");
    expect(normalizeDocumentType("4")).toBe("CE");
    expect(normalizeDocumentType("7")).toBe("PASSPORT");
    expect(() => normalizeDocumentType("RUC")).toThrowError(/tipo de documento/i);
  });

  it("no incluye atributos mutables en la identidad de una cuota", () => {
    const base = { ...person, concept: "CUOTA" as const, year: 2026, quotaNumber: 1 };
    const first = resolver.resolve(base);
    const withOtherAmount = resolver.resolve(base);
    expect(first.sourceKey).toBe(withOtherAmount.sourceKey);
    expect(first.sourceKey).not.toContain("150");
    expect(first.sourceKey).not.toContain("Facturado");
  });

  it("la inscripción es única por persona y no depende del año", () => {
    const inscription = { ...person, concept: "INSCRIPCION" as const, year: 2023, quotaNumber: null };
    expect(resolver.resolve(inscription).sourceKey).toBe(resolver.resolve({ ...inscription, year: 2026 }).sourceKey);
  });

  it("distingue cuotas por año y número", () => {
    const base = { ...person, concept: "CUOTA" as const, year: 2026, quotaNumber: 1 };
    expect(resolver.resolve(base).sourceKey).not.toBe(resolver.resolve({ ...base, quotaNumber: 2 }).sourceKey);
    expect(resolver.resolve(base).sourceKey).not.toBe(resolver.resolve({ ...base, year: 2027 }).sourceKey);
  });

  it("rechaza cuotas sin número y años inválidos", () => {
    expect(() => resolver.resolve({ ...person, concept: "CUOTA", year: 2026, quotaNumber: null })).toThrowError(/número entero positivo/i);
    expect(() => resolver.resolve({ ...person, concept: "CUOTA", year: 2026, quotaNumber: 0 })).toThrowError(/número entero positivo/i);
    expect(() => resolver.resolve({ ...person, concept: "CUOTA", year: 1800, quotaNumber: 1 })).toThrowError(/año/i);
    expect(resolver.resolve({ ...person, concept: "CUOTA", year: 1967, quotaNumber: 1 }).sourceKey).toContain("1967");
  });

  it("detecta identidades ambiguas sin deduplicar", () => {
    const first = resolver.resolve({ ...person, concept: "CUOTA", year: 2026, quotaNumber: 1 });
    const normalized = { ...first, provider: "SIE", sourcePayloadHash: "hash", institutionalCode: null } as NormalizedQuota;
    expect(() => assertUniqueQuotaIdentities([normalized, { ...normalized }])).toThrowError(/duplicada/i);
    expect(() => assertUniqueQuotaIdentities([normalized])).not.toThrow();
  });

  it("normaliza el documento sin recortar ceros ni espacios internos", () => {
    expect(resolver.resolvePerson({ documentType: "dni", documentNumber: " 000123 " }).personIdentityHash).toBe(
      resolver.resolvePerson({ documentType: "DNI", documentNumber: "000123" }).personIdentityHash,
    );
  });
});
