import { describe, expect, it } from "vitest";
import { ConfigurationError, getDocumentAiConfig, isDocumentAiValidationEnabled } from "@/lib/config/env";

describe("DocumentAiConfig", () => {
  it("está deshabilitada por defecto", () => {
    expect(isDocumentAiValidationEnabled({})).toBe(false);
    expect(isDocumentAiValidationEnabled({ DOCUMENT_AI_VALIDATION_ENABLED: "TRUE" })).toBe(true);
  });

  it("prioriza DOCUMENT_AI_MODEL y reutiliza GEMINI_MODEL si no existe", () => {
    expect(getDocumentAiConfig({ GEMINI_MODEL: "gemini-3.5-flash" }).model).toBe("gemini-3.5-flash");
    expect(getDocumentAiConfig({
      GEMINI_MODEL: "gemini-3.5-flash",
      DOCUMENT_AI_MODEL: "gemini-3.5-flash-lite",
    }).model).toBe("gemini-3.5-flash-lite");
  });

  it("exige clave solo cuando está habilitada", () => {
    expect(getDocumentAiConfig({}).apiKey).toBeNull();
    expect(() => getDocumentAiConfig({ DOCUMENT_AI_VALIDATION_ENABLED: "true" }))
      .toThrow(ConfigurationError);
  });

  it("rechaza un periodo institucional mal formado", () => {
    expect(() => getDocumentAiConfig({ DOCUMENT_AI_CURRENT_PERIOD: "2026-semestre" }))
      .toThrow(ConfigurationError);
    expect(getDocumentAiConfig({ DOCUMENT_AI_CURRENT_PERIOD: "2026-II" }).currentAcademicPeriod).toBe("2026-II");
  });

  it("rechaza límites fuera de rango", () => {
    expect(() => getDocumentAiConfig({ DOCUMENT_AI_TIMEOUT_MS: "1000" })).toThrow(ConfigurationError);
    expect(() => getDocumentAiConfig({ DOCUMENT_AI_MAX_PAGES: "100" })).toThrow(ConfigurationError);
  });
});
