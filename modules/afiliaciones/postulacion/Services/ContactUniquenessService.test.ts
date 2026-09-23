import { describe, expect, it } from "vitest";
import { ContactUniquenessService } from "./ContactUniquenessService";

describe("ContactUniquenessService.normalizeEmail", () => {
  it("aplica trim y lowercase", () => {
    expect(ContactUniquenessService.normalizeEmail("  QA@Example.Test ")).toBe("qa@example.test");
  });

  it("devuelve cadena vacía para valores nulos o indefinidos", () => {
    expect(ContactUniquenessService.normalizeEmail(null)).toBe("");
    expect(ContactUniquenessService.normalizeEmail(undefined)).toBe("");
  });
});

describe("ContactUniquenessService.normalizePhone", () => {
  it("conserva únicamente los dígitos", () => {
    expect(ContactUniquenessService.normalizePhone("999 999-999")).toBe("999999999");
    expect(ContactUniquenessService.normalizePhone("+51 987 654 321")).toBe("51987654321");
  });

  it("devuelve cadena vacía para valores nulos o indefinidos", () => {
    expect(ContactUniquenessService.normalizePhone(null)).toBe("");
    expect(ContactUniquenessService.normalizePhone(undefined)).toBe("");
  });
});

describe("ContactUniquenessService.blocksDuplicateReuse", () => {
  const blockingStates = ["DRAFT", "PENDING", "UNDER_EVALUACION", "OBSERVED", "RESOLVED", "READY_FOR_PAYMENT", "COMPLETED"];

  it.each(blockingStates)("bloquea la reutilización en estado %s", (status) => {
    expect(ContactUniquenessService.blocksDuplicateReuse(status)).toBe(true);
  });

  it("permite la reutilización solo en estado REJECTED", () => {
    expect(ContactUniquenessService.blocksDuplicateReuse("REJECTED")).toBe(false);
  });
});

describe("ContactUniquenessService.detectConflict", () => {
  const existing = [
    { id: 100, email: "qa@example.test", phone: "999999999" },
    { id: 101, email: "otro@example.test", phone: "988888888" },
  ];

  it("permite un correo nuevo", () => {
    expect(ContactUniquenessService.detectConflict(existing, { email: "nuevo@example.test" })).toEqual({ email: false, phone: false });
  });

  it("rechaza un correo duplicado", () => {
    expect(ContactUniquenessService.detectConflict(existing, { email: "qa@example.test" })).toEqual({ email: true, phone: false });
  });

  it("rechaza un correo duplicado con diferente casing", () => {
    expect(ContactUniquenessService.detectConflict(existing, { email: "QA@EXAMPLE.TEST" })).toEqual({ email: true, phone: false });
  });

  it("permite un celular nuevo", () => {
    expect(ContactUniquenessService.detectConflict(existing, { phone: "977777777" })).toEqual({ email: false, phone: false });
  });

  it("rechaza un celular duplicado", () => {
    expect(ContactUniquenessService.detectConflict(existing, { phone: "999999999" })).toEqual({ email: false, phone: true });
  });

  it("permite el mismo correo de la misma postulación (excludeId)", () => {
    expect(ContactUniquenessService.detectConflict(existing, { email: "qa@example.test", excludeId: 100 })).toEqual({ email: false, phone: false });
  });

  it("permite el mismo celular de la misma postulación (excludeId)", () => {
    expect(ContactUniquenessService.detectConflict(existing, { phone: "999999999", excludeId: 100 })).toEqual({ email: false, phone: false });
  });

  it("rechaza el mismo correo para otra postulación (id distinto)", () => {
    expect(ContactUniquenessService.detectConflict(existing, { email: "qa@example.test", excludeId: 101 })).toEqual({ email: true, phone: false });
  });

  it("rechaza el mismo celular para otra postulación (id distinto)", () => {
    expect(ContactUniquenessService.detectConflict(existing, { phone: "999999999", excludeId: 101 })).toEqual({ email: false, phone: true });
  });

  it("no considera duplicado un valor vacío tras normalizar", () => {
    expect(ContactUniquenessService.detectConflict(existing, { email: "  ", phone: "---" })).toEqual({ email: false, phone: false });
  });
});
