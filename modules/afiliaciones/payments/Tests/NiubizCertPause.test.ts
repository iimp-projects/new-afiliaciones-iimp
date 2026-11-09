import { describe, expect, it, vi, afterEach } from "vitest";
import type { NiubizSessionRequest } from "../DTOs/Niubiz/NiubizSession.dto";
import {
  buildSessionDiagnostic,
  isCertPauseEnabled,
  redactSessionSecrets,
  verifySessionEvidence,
} from "../Services/Niubiz/NiubizSessionDiagnostics";
import { redactDiagnostic } from "../Services/Niubiz/NiubizSessionEvidence";

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.restoreAllMocks();
});

function buildRequest(): NiubizSessionRequest {
  return {
    url: "https://apisandbox.vnforappstest.com/api.ecommerce/v2/ecommerce/token/session/456879852",
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer security-token" },
    body: {
      amount: 300,
      channel: "web",
      antifraud: {
        clientIp: "127.0.0.1",
        merchantDefineData: { MDD4: "max.ichajaya2@gmail.com", MDD31: "954666409", MDD32: "61", MDD34: "41000058", MDD75: "Registrado" },
      },
      dataMap: {
        cardholderCity: "Lima",
        cardholderCountry: "PE",
        cardholderAddress: "Copacabana 220, 101",
        cardholderPostalCode: "15024",
        cardholderState: "Lima",
        cardholderPhoneNumber: "954666409",
      },
    },
  };
}

describe("isCertPauseEnabled — gating", () => {
  it("está desactivada por defecto", () => {
    expect(isCertPauseEnabled(undefined, undefined, undefined, undefined)).toBe(false);
  });

  it("no se activa en PRODUCTION aunque exista el flag", () => {
    process.env.NIUBIZ_CERT_PAUSE_AFTER_SESSION = "true";
    expect(isCertPauseEnabled("production", "TEST", "NIUBIZ", "true")).toBe(false);
  });

  it("no se activa en TEST sin el flag opt-in", () => {
    delete process.env.NIUBIZ_CERT_PAUSE_AFTER_SESSION;
    expect(isCertPauseEnabled("development", "TEST", "NIUBIZ", undefined)).toBe(false);
  });

  it("no se activa si el proveedor no es NIUBIZ", () => {
    expect(isCertPauseEnabled("development", "TEST", "MOCK", "true")).toBe(false);
  });

  it("se activa solo en desarrollo LOCAL + TEST + NIUBIZ + flag", () => {
    expect(isCertPauseEnabled("development", "TEST", "NIUBIZ", "true")).toBe(true);
  });
});

describe("verifySessionEvidence", () => {
  it("verifica MDD4, MDD32, MDD75 y los seis campos del dataMap", () => {
    const verification = verifySessionEvidence(buildRequest());
    expect(verification.mdd4).toBe(true);
    expect(verification.mdd32).toBe(true);
    expect(verification.mdd75).toBe(true);
    expect(verification.mdd77).toBe(true);
    expect(verification.mdd77Present).toBe(false);
    expect(verification.dataMapFields).toHaveLength(6);
    expect(verification.missingDataMapFields).toHaveLength(0);
    expect(verification.mdd77Note).toBeDefined();
  });

  it("reporta MDD77 = 1 para Invitado sin nota", () => {
    const request = buildRequest();
    request.body.antifraud!.merchantDefineData = { MDD4: "a@b.c", MDD32: "12345678", MDD75: "Invitado", MDD77: 1 };
    const verification = verifySessionEvidence(request);
    expect(verification.mdd77).toBe(true);
    expect(verification.mdd77Present).toBe(true);
    expect(verification.mdd77Note).toBeUndefined();
  });

  it("reporta los campos de dataMap ausentes", () => {
    const request = buildRequest();
    delete request.body.dataMap!.cardholderPostalCode;
    const verification = verifySessionEvidence(request);
    expect(verification.dataMapFields).toHaveLength(5);
    expect(verification.missingDataMapFields).toEqual(["cardholderPostalCode"]);
  });
});

describe("buildSessionDiagnostic — vista real vs redacción", () => {
  it("muestra MDD4/MDD32/dataMap reales en pantalla pero redacta Authorization y sessionKey", () => {
    const diagnostic = buildSessionDiagnostic(buildRequest(), 201, { sessionKey: "real-session-key", expirationTime: 300 }, "session-abc123");
    const request = diagnostic.request as { headers: Record<string, unknown>; body: { antifraud: { clientIp: string; merchantDefineData: Record<string, unknown> }; dataMap: Record<string, unknown> } };
    const response = diagnostic.response as { httpStatus: number; body: Record<string, unknown> };

    expect(request.headers.Authorization).toBe("[REDACTED]");
    expect(request.body.antifraud.clientIp).toBe("127.0.0.1");
    expect(request.body.antifraud.merchantDefineData.MDD4).toBe("max.ichajaya2@gmail.com");
    expect(request.body.antifraud.merchantDefineData.MDD32).toBe("61");
    expect(request.body.antifraud.merchantDefineData.MDD75).toBe("Registrado");
    expect(request.body.dataMap.cardholderAddress).toBe("Copacabana 220, 101");
    expect(response.httpStatus).toBe(201);
    expect(response.body.sessionKey).toBe("[REDACTED]");
    expect(JSON.stringify(diagnostic.request)).not.toContain("security-token");
  });

  it("expone una versión redactada para exportar sin PII", () => {
    const diagnostic = buildSessionDiagnostic(buildRequest(), 201, { sessionKey: "real-session-key" }, "session-abc123");
    const redactedRequest = diagnostic.redacted.request as { headers: Record<string, unknown>; body: { antifraud: { merchantDefineData: Record<string, unknown> }; dataMap: Record<string, unknown> } };
    const redactedResponse = diagnostic.redacted.response as { body: Record<string, unknown> };

    expect(redactedRequest.headers.Authorization).toBe("[REDACTED]");
    expect(redactedRequest.body.antifraud.merchantDefineData.MDD4).toBe("[REDACTED]");
    expect(redactedRequest.body.antifraud.merchantDefineData.MDD32).toBe("[REDACTED]");
    expect(redactedRequest.body.dataMap.cardholderAddress).toBe("[REDACTED]");
    expect(redactedResponse.body.sessionKey).toBe("[REDACTED]");
    expect(JSON.stringify(diagnostic.redacted)).not.toContain("max.ichajaya2@gmail.com");
    expect(JSON.stringify(diagnostic.redacted)).not.toContain("41000058");
    expect(JSON.stringify(diagnostic.redacted)).not.toContain("Copacabana");
    expect(JSON.stringify(diagnostic.redacted)).not.toContain("real-session-key");
    expect(JSON.stringify(diagnostic.redacted)).not.toContain("security-token");
  });
});

describe("redactSessionSecrets", () => {
  it("redacta solo tokens y conserva datos personales", () => {
    const out = redactSessionSecrets({
      headers: { Authorization: "token" },
      body: { amount: 300, antifraud: { clientIp: "127.0.0.1", merchantDefineData: { MDD4: "a@b.c", MDD32: "61", MDD75: "Registrado" } } },
    }) as { headers: Record<string, unknown>; body: { antifraud: { clientIp: string; merchantDefineData: Record<string, unknown> } } };

    expect(out.headers.Authorization).toBe("[REDACTED]");
    expect(out.body.antifraud.clientIp).toBe("127.0.0.1");
    expect(out.body.antifraud.merchantDefineData.MDD4).toBe("a@b.c");
  });
});

describe("redactDiagnostic — defensa en profundidad", () => {
  it("reaplica la redacción completa sobre la vista", () => {
    const diagnostic = buildSessionDiagnostic(buildRequest(), 201, { sessionKey: "real-session-key" }, "session-abc123");
    const redacted = redactDiagnostic(diagnostic);
    expect(JSON.stringify(redacted.redacted)).not.toContain("max.ichajaya2@gmail.com");
    expect(JSON.stringify(redacted.redacted)).not.toContain("real-session-key");
    expect(JSON.stringify(redacted.redacted)).not.toContain("security-token");
  });
});
