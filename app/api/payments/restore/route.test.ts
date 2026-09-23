import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  verifyRestoreReference: vi.fn(),
  findPaymentConfirmationDetails: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => ({ value: "restore-session" }) }),
}));
vi.mock("@/modules/afiliaciones/payments/Services/PaymentAuthorizationService", () => ({
  paymentAuthorizationService: {
    restoreCookieName: "iimp_payment_restore",
    verifyRestoreReference: mocks.verifyRestoreReference,
  },
}));
vi.mock("@/modules/afiliaciones/payments/Repositories/PaymentRepository", () => ({
  PaymentRepository: class { findPaymentConfirmationDetails = mocks.findPaymentConfirmationDetails; },
}));
vi.mock("@/modules/afiliaciones/payments/Services/Niubiz/NiubizActionCodes", () => ({
  getNiubizActionCode: () => undefined,
}));

import { GET } from "./route";

const payment = {
  id: 99,
  applicationId: 42,
  status: "PAID",
  totalAmount: 300,
  registrationAmount: 150,
  membershipFeeAmount: 150,
  currency: "PEN",
  gateway: "NIUBIZ",
  transactionId: "tx-1",
  authorizationCode: "auth-1",
  paymentDate: new Date("2026-01-01T00:00:00Z"),
  gatewayTransactionDate: null,
  cardBrand: "VISA",
  maskedCard: "411111******1111",
  cardType: "CREDIT",
  paymentChannel: "web",
  traceNumber: "trace-1",
  actionCode: null,
  failureCode: null,
  failureReason: null,
  billing: null,
  application: {
    id: 42,
    status: "COMPLETED",
    applicationCode: "APP-42",
    trackingCode: "track-42",
    documentType: "DNI",
    documentNumber: "12345678",
    email: "ana@example.com",
    phone: "999999999",
    affiliateType: "ACTIVE",
    submittedAt: new Date("2026-01-01T00:00:00Z"),
    createdAt: new Date("2026-01-01T00:00:00Z"),
    draftData: { personalInformation: { firstName: "Ana" } },
    person: { firstName: "Ana", paternalLastName: "Pérez", maternalLastName: null },
  },
};

const request = () => new Request("http://localhost/api/payments/restore?payment_restore=reference");

describe("payment restore route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.verifyRestoreReference.mockReturnValue({ paymentId: 99, applicationId: 42 });
    mocks.findPaymentConfirmationDetails.mockResolvedValue(payment);
  });

  it("rejects an invalid restore reference", async () => {
    mocks.verifyRestoreReference.mockReturnValue(null);
    const response = await GET(request());
    expect(response.status).toBe(403);
  });

  it("sets Cache-Control: no-store on the PII response", async () => {
    const response = await GET(request());
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("keeps draftData because the consultation view depends on it", async () => {
    const response = await GET(request());
    const body = await response.json();
    expect(body.application.draftData).toEqual({ personalInformation: { firstName: "Ana" } });
  });
});
