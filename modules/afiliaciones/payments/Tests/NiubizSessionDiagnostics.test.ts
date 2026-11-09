import { describe, expect, it, vi, afterEach } from "vitest";
import {
  isSessionDiagnosticsEnabled,
  redactSessionValue,
} from "../Services/Niubiz/NiubizSessionDiagnostics";

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.restoreAllMocks();
});

describe("NiubizSessionDiagnostics — redacción", () => {
  it("redacta Authorization y sessionKey pero conserva nombres de campo", () => {
    const out = redactSessionValue({
      headers: { "Content-Type": "application/json", Authorization: "Bearer super-secret" },
      body: { sessionKey: "real-session-key", amount: 300 },
    }) as { headers: Record<string, unknown>; body: Record<string, unknown> };

    expect(out.headers.Authorization).toBe("[REDACTED]");
    expect(out.body.sessionKey).toBe("[REDACTED]");
    expect(out.body.amount).toBe(300);
  });

  it("conserva MDD75/MDD77 y redacta datos personales del merchantDefineData", () => {
    const out = redactSessionValue({
      antifraud: {
        clientIp: "203.0.113.1",
        merchantDefineData: { MDD4: "applicant@example.com", MDD32: "12345678", MDD75: "Invitado", MDD77: 1 },
      },
    }) as { antifraud: { clientIp: string; merchantDefineData: Record<string, unknown> } };

    expect(out.antifraud.clientIp).toBe("[REDACTED]");
    expect(out.antifraud.merchantDefineData.MDD4).toBe("[REDACTED]");
    expect(out.antifraud.merchantDefineData.MDD32).toBe("[REDACTED]");
    expect(out.antifraud.merchantDefineData.MDD75).toBe("Invitado");
    expect(out.antifraud.merchantDefineData.MDD77).toBe(1);
  });

  it("redacta los seis campos del dataMap del titular", () => {
    const out = redactSessionValue({
      dataMap: {
        cardholderCity: "Lima",
        cardholderCountry: "PE",
        cardholderAddress: "Calle Los Canarios 155-157, La Molina",
        cardholderPostalCode: "15024",
        cardholderState: "Lima",
        cardholderPhoneNumber: "999999999",
      },
    }) as { dataMap: Record<string, unknown> };

    for (const value of Object.values(out.dataMap)) {
      expect(value).toBe("[REDACTED]");
    }
  });
});

describe("NiubizSessionDiagnostics — gating", () => {
  it("está desactivado por defecto", () => {
    expect(isSessionDiagnosticsEnabled(undefined)).toBe(false);
    expect(isSessionDiagnosticsEnabled("")).toBe(false);
  });

  it("no se activa en PRODUCTION aunque exista el flag", () => {
    process.env.NIUBIZ_TEST_SESSION_DIAGNOSTICS_ENABLED = "true";
    expect(isSessionDiagnosticsEnabled("PRODUCTION")).toBe(false);
  });

  it("no se activa en TEST sin el flag opt-in", () => {
    delete process.env.NIUBIZ_TEST_SESSION_DIAGNOSTICS_ENABLED;
    expect(isSessionDiagnosticsEnabled("TEST")).toBe(false);
  });

  it("se activa solo con TEST + flag opt-in", () => {
    process.env.NIUBIZ_TEST_SESSION_DIAGNOSTICS_ENABLED = "true";
    expect(isSessionDiagnosticsEnabled("TEST")).toBe(true);
  });
});
