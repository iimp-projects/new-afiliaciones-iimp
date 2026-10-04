import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({ send: vi.fn(), consume: vi.fn() }));
vi.mock("@/modules/afiliaciones/postulacion/Services/OtpRecoveryService", () => ({ OtpRecoveryService: class { generateAndSendOtp = mocks.send; } }));
vi.mock("@/modules/auth/rate-limit/VerificationTokenRateLimiter", () => ({
  verificationTokenRateLimiter: { consume: mocks.consume },
}));

import { POST } from "./route";
import { queryAuthorization } from "@/modules/afiliaciones/consulta/Services/QueryAuthorizationService";

const request = (body: unknown) => new NextRequest("http://localhost/api/afiliaciones/postulacion/send-otp", {
  method: "POST",
  headers: { "Content-Type": "application/json", "x-forwarded-for": "192.0.2.10" },
  body: JSON.stringify(body),
});

describe("send-otp public contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("AUTH_SECRET", "test-only-send-otp-secret");
    mocks.consume.mockResolvedValue(true);
  });

  it("allows the first OTP request and rate-limits by IP and identity", async () => {
    const context = queryAuthorization.createDocumentChallenge("DNI", "12345678");
    const response = await POST(request({ purpose: "APPLICATION_QUERY", context, channel: "EMAIL" }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(mocks.consume).toHaveBeenCalledWith("otp-send:ip", "192.0.2.10", 10, 15);
    expect(mocks.consume).toHaveBeenCalledWith("otp-send:identity", "document:DNI:12345678", 5, 15);
    expect(mocks.send).toHaveBeenCalledWith(expect.objectContaining({ kind: "document" }), "EMAIL", "APPLICATION_QUERY");
  });

  it("blocks when the IP limit is exhausted", async () => {
    mocks.consume.mockResolvedValueOnce(false).mockResolvedValueOnce(true);

    const context = queryAuthorization.createDocumentChallenge("DNI", "12345678");
    const response = await POST(request({ purpose: "APPLICATION_QUERY", context, channel: "SMS" }));

    expect(response.status).toBe(429);
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it("blocks when the identity limit is exhausted", async () => {
    mocks.consume.mockResolvedValueOnce(true).mockResolvedValueOnce(false);

    const context = queryAuthorization.createDocumentChallenge("DNI", "12345678");
    const response = await POST(request({ purpose: "APPLICATION_QUERY", context, channel: "SMS" }));

    expect(response.status).toBe(429);
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it.each(["EMAIL", "SMS", "WHATSAPP"] as const)("preserves the %s channel when allowed", async (channel) => {
    const context = queryAuthorization.createDocumentChallenge("DNI", "12345678");
    const response = await POST(request({ purpose: "APPLICATION_QUERY", context, channel }));

    expect(response.status).toBe(200);
    expect(mocks.send).toHaveBeenCalledWith(expect.objectContaining({ kind: "document" }), channel, "APPLICATION_QUERY");
  });

  it("rate-limits the tracking-code flow by identity without a document", async () => {
    mocks.consume.mockResolvedValueOnce(true).mockResolvedValueOnce(false);

    const response = await POST(request({ trackingCode: "APP-7", channel: "EMAIL" }));

    expect(response.status).toBe(429);
    expect(mocks.consume).toHaveBeenCalledWith("otp-send:identity", "tracking:APP-7", 5, 15);
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it("stays equivalent when the decoy resolution fails internally", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.send.mockRejectedValueOnce(new Error("provider details"));
    const context = queryAuthorization.createDocumentChallenge("DNI", "00000000");
    const response = await POST(request({ purpose: "APPLICATION_QUERY", context, channel: "SMS" }));

    expect(response.status).toBe(200);
    expect((await response.json()).success).toBe(true);
    errorSpy.mockRestore();
  });

  it("rejects client-supplied destinations and extra fields before rate limiting", async () => {
    const context = queryAuthorization.createDocumentChallenge("DNI", "12345678");
    const withEmail = await POST(request({ purpose: "APPLICATION_QUERY", context, channel: "EMAIL", email: "attacker@example.com" }));
    const withDestination = await POST(request({ purpose: "APPLICATION_QUERY", context, channel: "EMAIL", destination: "x@y.z" }));
    const withApplicationId = await POST(request({ purpose: "APPLICATION_QUERY", context, channel: "EMAIL", applicationId: 7 }));

    expect(withEmail.status).toBe(400);
    expect(withDestination.status).toBe(400);
    expect(withApplicationId.status).toBe(400);
    expect(mocks.send).not.toHaveBeenCalled();
    expect(mocks.consume).not.toHaveBeenCalled();
  });
});
