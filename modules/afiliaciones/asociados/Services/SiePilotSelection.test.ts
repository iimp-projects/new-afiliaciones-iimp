import { describe, expect, it } from "vitest";
import {
  parsePilotSelectionArgs,
  requireExplicitSelectionForExecute,
  resolveSelection,
} from "./SiePilotSelection";

describe("parsePilotSelectionArgs", () => {
  it("extrae --user-id válido", () => {
    expect(parsePilotSelectionArgs(["node", "x", "--user-id", "123"])).toEqual({ userId: 123, externalCode: null });
  });

  it("extrae --external-code válido", () => {
    expect(parsePilotSelectionArgs(["node", "x", "--external-code", "00012"])).toEqual({ userId: null, externalCode: "00012" });
  });

  it("extrae ambos filtros juntos", () => {
    expect(parsePilotSelectionArgs(["node", "x", "--user-id", "123", "--external-code", "00012"])).toEqual({ userId: 123, externalCode: "00012" });
  });

  it("ignora valores inválidos de --user-id", () => {
    expect(parsePilotSelectionArgs(["node", "x", "--user-id", "abc"])).toEqual({ userId: null, externalCode: null });
    expect(parsePilotSelectionArgs(["node", "x", "--user-id", "-5"])).toEqual({ userId: null, externalCode: null });
  });

  it("ignora --external-code vacío", () => {
    expect(parsePilotSelectionArgs(["node", "x", "--external-code", "  "])).toEqual({ userId: null, externalCode: null });
  });
});

describe("resolveSelection", () => {
  it("resuelve por --user-id cuando coincide", () => {
    expect(resolveSelection({ userId: 123, externalCode: null }, [123], [])).toEqual({ ok: true, userId: 123 });
  });

  it("resuelve por --external-code cuando coincide", () => {
    expect(resolveSelection({ userId: null, externalCode: "00012" }, [], [123])).toEqual({ ok: true, userId: 123 });
  });

  it("rechaza usuario inexistente", () => {
    expect(resolveSelection({ userId: 999, externalCode: null }, [], [])).toEqual({ ok: false, reason: "USER_NOT_FOUND" });
  });

  it("rechaza código externo inexistente", () => {
    expect(resolveSelection({ userId: null, externalCode: "99999" }, [], [])).toEqual({ ok: false, reason: "EXTERNAL_CODE_NOT_FOUND" });
  });

  it("rechaza código externo ambiguo (varias coincidencias)", () => {
    expect(resolveSelection({ userId: null, externalCode: "00012" }, [], [1, 2])).toEqual({ ok: false, reason: "AMBIGUOUS_EXTERNAL_CODE" });
  });

  it("rechaza conflicto entre filtros (resuelven usuarios distintos)", () => {
    expect(resolveSelection({ userId: 123, externalCode: "00012" }, [123], [456])).toEqual({ ok: false, reason: "SELECTION_MISMATCH" });
  });

  it("acepta cuando ambos filtros identifican al mismo usuario", () => {
    expect(resolveSelection({ userId: 123, externalCode: "00012" }, [123], [123])).toEqual({ ok: true, userId: 123 });
  });

  it("rechaza cuando uno de los filtros no resuelve nada (ambos presentes)", () => {
    expect(resolveSelection({ userId: 123, externalCode: "00012" }, [123], [])).toEqual({ ok: false, reason: "SELECTION_NOT_FOUND" });
  });

  it("sin selección no resuelve usuario", () => {
    expect(resolveSelection({ userId: null, externalCode: null }, [], [])).toEqual({ ok: false, reason: "NO_SELECTION" });
  });
});

describe("requireExplicitSelectionForExecute", () => {
  it("exige selección explícita en modo execute", () => {
    expect(requireExplicitSelectionForExecute("execute", { userId: null, externalCode: null })).toMatch(/requiere selección explícita/);
  });

  it("permite execute con --user-id", () => {
    expect(requireExplicitSelectionForExecute("execute", { userId: 123, externalCode: null })).toBeNull();
  });

  it("permite execute con --external-code", () => {
    expect(requireExplicitSelectionForExecute("execute", { userId: null, externalCode: "00012" })).toBeNull();
  });

  it("dry-run no exige selección", () => {
    expect(requireExplicitSelectionForExecute("dry-run", { userId: null, externalCode: null })).toBeNull();
  });

  it("--limit 1 no cuenta como selección: execute sin filtro sigue rechazado", () => {
    // --limit no aparece en la selección; por tanto, execute sin --user-id/--external-code se rechaza.
    expect(requireExplicitSelectionForExecute("execute", { userId: null, externalCode: null })).not.toBeNull();
  });
});
