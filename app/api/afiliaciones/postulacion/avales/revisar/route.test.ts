import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({ consume: vi.fn(), execute: vi.fn() }));

vi.mock("@/modules/auth/rate-limit/VerificationTokenRateLimiter", () => ({
  verificationTokenRateLimiter: { consume: mocks.consume },
}));
vi.mock("@/modules/afiliaciones/postulacion/Services/ReviewEndorsementService", () => ({
  ReviewEndorsementService: class { execute = mocks.execute; },
}));

import { POST } from "./route";

const request = (body: unknown) => new NextRequest("http://localhost/api/afiliaciones/postulacion/avales/revisar", {
  method: "POST",
  headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.5" },
  body: JSON.stringify(body),
});

describe("endorsement review route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.consume.mockResolvedValue(true);
    mocks.execute.mockResolvedValue(undefined);
  });

  it("rate-limits requests before processing", async () => {
    mocks.consume.mockResolvedValue(false);
    const response = await POST(request({ token: "token", action: "APPROVE" }));

    expect(response.status).toBe(429);
    expect(mocks.execute).not.toHaveBeenCalled();
  });

  it("rejects invalid parameters", async () => {
    const response = await POST(request({ token: "", action: "NOPE" }));
    expect(response.status).toBe(400);
  });

  it("returns 400 for an invalid or expired token", async () => {
    mocks.execute.mockRejectedValue(new Error("El enlace es inválido o no posee un formato correcto."));
    const response = await POST(request({ token: "token", action: "APPROVE" }));
    expect(response.status).toBe(400);
  });

  it("processes a valid request", async () => {
    const response = await POST(request({ token: "token", action: "APPROVE" }));
    expect(response.status).toBe(200);
    expect(mocks.execute).toHaveBeenCalledWith("token", "APPROVE");
  });
});
