import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({ send: vi.fn() }));
vi.mock("@/modules/afiliaciones/postulacion/Services/OtpRecoveryService", () => ({ OtpRecoveryService: class { generateAndSendOtp = mocks.send; } }));

import { POST } from "./route";
import { queryAuthorization } from "@/modules/afiliaciones/consulta/Services/QueryAuthorizationService";

const request = (body: unknown) => new NextRequest("http://localhost/api/afiliaciones/postulacion/send-otp", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

describe("send-otp public contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("AUTH_SECRET", "test-only-send-otp-secret");
  });

  it("returns a constant generic success for a document challenge", async () => {
    const context = queryAuthorization.createDocumentChallenge("DNI", "12345678");
    const response = await POST(request({ purpose: "APPLICATION_QUERY", context, channel: "EMAIL" }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.message).toContain("Si el canal seleccionado está disponible");
    expect(mocks.send).toHaveBeenCalledWith(expect.objectContaining({ kind: "document" }), "EMAIL", "APPLICATION_QUERY");
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

  it("rejects client-supplied destinations and extra fields", async () => {
    const context = queryAuthorization.createDocumentChallenge("DNI", "12345678");
    const withEmail = await POST(request({ purpose: "APPLICATION_QUERY", context, channel: "EMAIL", email: "attacker@example.com" }));
    const withDestination = await POST(request({ purpose: "APPLICATION_QUERY", context, channel: "EMAIL", destination: "x@y.z" }));
    const withApplicationId = await POST(request({ purpose: "APPLICATION_QUERY", context, channel: "EMAIL", applicationId: 7 }));

    expect(withEmail.status).toBe(400);
    expect(withDestination.status).toBe(400);
    expect(withApplicationId.status).toBe(400);
    expect(mocks.send).not.toHaveBeenCalled();
  });
});
