import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ consume: vi.fn(), findMany: vi.fn() }));
vi.mock("@/modules/auth/rate-limit/VerificationTokenRateLimiter", () => ({
  verificationTokenRateLimiter: { consume: mocks.consume },
}));
vi.mock("@/lib/prisma", () => ({ prisma: { membershipApplication: { findMany: mocks.findMany } } }));

import { POST } from "./route";

const request = (body: unknown) => new Request("http://localhost/api/consulta/verification", {
  method: "POST",
  headers: { "Content-Type": "application/json", "x-forwarded-for": "192.0.2.10" },
  body: JSON.stringify(body),
});

describe("public consultation verification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("AUTH_SECRET", "test-only-public-query-secret");
    vi.stubEnv("WHATSAPP_PHONE_NUMBER_ID", "phone-id");
    vi.stubEnv("WHATSAPP_ACCESS_TOKEN", "token");
    vi.stubEnv("SMTP_HOST", "smtp.example.com");
    vi.stubEnv("SMTP_USER", "user");
    vi.stubEnv("SMTP_PASS", "pass");
    vi.stubEnv("SMTP_PORT", "587");
    vi.stubEnv("OTP_WHATSAPP_ENABLED", "true");
    vi.stubEnv("OTP_SMS_ENABLED", "true");
    vi.stubEnv("OTP_EMAIL_ENABLED", "true");
    mocks.consume.mockResolvedValue(true);
    mocks.findMany.mockResolvedValue([{ id: 7, email: "maria@example.com", phone: "999111812" }]);
  });

  it("rate-limits by IP and identity before preparing the challenge", async () => {
    mocks.consume.mockResolvedValueOnce(false).mockResolvedValueOnce(true);

    const response = await POST(request({ documentType: "DNI", documentNumber: "12345678" }));

    expect(response.status).toBe(429);
    expect(mocks.consume).toHaveBeenCalledWith("public-query:ip", "192.0.2.10", 10, 15);
    expect(mocks.consume).toHaveBeenCalledWith("public-query:identity", "DNI:12345678", 5, 15);
    expect(mocks.findMany).not.toHaveBeenCalled();
  });

  it("accepts document-only lookups and returns a constant challenge", async () => {
    const response = await POST(request({ documentType: "DNI", documentNumber: "12345678" }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(Object.keys(body).sort()).toEqual(["channels", "context", "requiresVerification"]);
    expect(body.requiresVerification).toBe(true);
    expect(body.channels).toEqual([{ channel: "WHATSAPP" }, { channel: "SMS" }, { channel: "EMAIL" }]);
    expect(body).not.toHaveProperty("hasApplication");
    expect(body).not.toHaveProperty("options");
    expect(JSON.stringify(body)).not.toContain("maria@example.com");
    expect(JSON.stringify(body)).not.toContain("999111812");
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("returns the same public shape for existing and nonexistent documents", async () => {
    const existing = await (await POST(request({ documentType: "DNI", documentNumber: "12345678" }))).json();
    mocks.findMany.mockResolvedValueOnce([]);
    const nonexistent = await (await POST(request({ documentType: "DNI", documentNumber: "00000000" }))).json();

    expect(Object.keys(existing).sort()).toEqual(Object.keys(nonexistent).sort());
    expect(existing.channels).toEqual(nonexistent.channels);
    expect(existing.requiresVerification).toBe(nonexistent.requiresVerification);
  });

  it("rejects email and extra fields", async () => {
    const withEmail = await POST(request({ documentType: "DNI", documentNumber: "12345678", email: "maria@example.com" }));
    const withTracking = await POST(request({ documentType: "DNI", documentNumber: "12345678", trackingCode: "APP-7" }));

    expect(withEmail.status).toBe(400);
    expect(withTracking.status).toBe(400);
    expect(mocks.consume).not.toHaveBeenCalled();
  });
});
