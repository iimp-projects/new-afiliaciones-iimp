import { describe, expect, it } from "vitest";
import { shouldAutoIssueCard, type AutoIssuanceInput } from "../Models/autoIssuance";

const base: AutoIssuanceInput = {
  eligible: true,
  generated: false,
  revoked: false,
  issuanceEnabled: true,
  canIssue: true,
};

describe("shouldAutoIssueCard", () => {
  it("emite cuando el asociado es elegible y no tiene credencial", () => {
    expect(shouldAutoIssueCard(base)).toBe(true);
  });

  it("reutiliza una credencial existente sin volver a emitir", () => {
    expect(shouldAutoIssueCard({ ...base, generated: true })).toBe(false);
  });

  it("no emite si el asociado no es elegible", () => {
    expect(shouldAutoIssueCard({ ...base, eligible: false })).toBe(false);
  });

  it("nunca reemite una credencial revocada", () => {
    expect(shouldAutoIssueCard({ ...base, generated: true, revoked: true })).toBe(false);
  });

  it("no emite cuando la emisión está deshabilitada", () => {
    expect(shouldAutoIssueCard({ ...base, issuanceEnabled: false })).toBe(false);
  });

  it("no emite sin permiso de gestión (solo lectura)", () => {
    expect(shouldAutoIssueCard({ ...base, canIssue: false })).toBe(false);
  });
});
