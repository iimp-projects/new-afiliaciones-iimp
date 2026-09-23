import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  authorizeFromCallback: vi.fn(),
  createRestoreReference: vi.fn(),
}));

vi.mock("@/modules/afiliaciones/payments/Services/PaymentService", () => ({
  paymentService: { authorizeFromCallback: mocks.authorizeFromCallback },
  PaymentServiceError: class PaymentServiceError extends Error {
    constructor(message: string, public readonly status: number) { super(message); }
  },
}));
vi.mock("@/modules/afiliaciones/payments/Services/PaymentAuthorizationService", () => ({
  paymentAuthorizationService: {
    createRestoreReference: mocks.createRestoreReference,
    restoreCookieName: "payment_restore_session",
  },
}));
vi.mock("@/modules/afiliaciones/payments/Config/PaymentConfig", () => ({
  paymentConfig: { authorizationTtlSeconds: 600 },
}));

import { noConfirmationRedirect, POST } from "./route";

describe("Niubiz callback fallback redirect", () => {
  it("does not reflect an untrusted callback reference", () => {
    const response = noConfirmationRedirect(new Request("http://localhost:3000/api/payments/niubiz/callback?payment_callback=signed-reference"));

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toContain("/consulta/pago/no-confirmado");
    expect(response.headers.get("location")).not.toContain("signed-reference");
  });

  it("renders the generic no-confirmed route when no callback reference exists", () => {
    const response = noConfirmationRedirect(new Request("http://localhost:3000/api/payments/niubiz/callback"));

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toContain("/consulta/pago/no-confirmado");
  });
});

describe("Niubiz callback redirects use the canonical base URL", () => {
  const QA_URL = "https://afiliaciones-qa.iimp.org.pe";

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", QA_URL);
    mocks.createRestoreReference.mockReturnValue({ reference: "ref-123", session: "session-123" });
  });

  it("no-confirmado usa la URL pública canónica (nunca 0.0.0.0)", () => {
    const response = noConfirmationRedirect(new Request("https://0.0.0.0:3000/api/payments/niubiz/callback"));
    const location = response.headers.get("location") ?? "";
    expect(location).toBe(`${QA_URL}/consulta/pago/no-confirmado`);
    expect(location).not.toContain("0.0.0.0");
  });

  it("redirige a /consulta tras pago exitoso usando la URL pública canónica", async () => {
    mocks.authorizeFromCallback.mockResolvedValue({ status: "PAID", id: 1, applicationId: 2 });
    const formData = new FormData();
    formData.set("transactionToken", "A".repeat(32));
    formData.set("channel", "web");
    const request = new NextRequest("https://0.0.0.0:3000/api/payments/niubiz/callback", { method: "POST", body: formData });
    const response = await POST(request);
    const location = response.headers.get("location") ?? "";
    expect(location).toBe(`${QA_URL}/consulta?payment_restore=ref-123`);
    expect(location).not.toContain("0.0.0.0");
  });

  it("redirige a no-confirmado cuando el callback no trae token válido", async () => {
    const formData = new FormData();
    formData.set("transactionToken", "bad");
    formData.set("channel", "web");
    const request = new NextRequest("https://0.0.0.0:3000/api/payments/niubiz/callback", { method: "POST", body: formData });
    const response = await POST(request);
    const location = response.headers.get("location") ?? "";
    expect(location).toBe(`${QA_URL}/consulta/pago/no-confirmado`);
    expect(location).not.toContain("0.0.0.0");
  });
});
