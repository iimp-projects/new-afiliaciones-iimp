import { ApplicationStatus } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import type { CreatePaymentInput } from "../DTOs/create-payment.schema";
import type { NiubizTestConfig } from "../Config/PaymentConfig";
import { NiubizPaymentProvider } from "../Providers/NiubizPaymentProvider";
import type { IPaymentRepository, PaymentApplicationSnapshot } from "../Repositories/Interfaces/IPaymentRepository";
import { PaymentService } from "../Services/PaymentService";

const config: NiubizTestConfig = {
  merchantId: "123456789",
  username: "test-user",
  password: "test-password",
  securityUrl: "https://sandbox.example/security",
  sessionUrl: "https://sandbox.example/session",
  authorizationUrl: "https://sandbox.example/authorization",
  checkoutUrl: "https://sandbox.example/checkout.js",
  callbackUrl: "http://localhost:3000/api/payments/niubiz/callback",
  timeoutUrl: "http://localhost:3000/consulta",
  merchantName: "IIMP",
  formButtonColor: "#C5A059",
  cardholderFallbackEnabled: false,
  authorizationDataMap: {
    urlAddress: "https://sandbox.example",
    serviceLocationCityName: "Lima",
    serviceLocationCountrySubdivisionCode: "LIM",
    serviceLocationCountryCode: "PE",
    serviceLocationPostalCode: "15024",
  },
};

const input: CreatePaymentInput = {
  applicationId: 42,
  billingData: {
    tipoDocumento: "DNI",
    numeroDocumento: "12345678",
    razonSocial: "Postulante de prueba",
    direccionFiscal: "Av. Prueba 123",
    responsable: "Postulante de prueba",
    emailFacturacion: "applicant@example.com",
  },
  billingConfirmed: true,
  termsAccepted: true,
  majorityAccepted: true,
};

const snapshot: PaymentApplicationSnapshot = {
  id: 42,
  personId: 7,
  status: ApplicationStatus.READY_FOR_PAYMENT,
  deletedAt: null,
  email: "applicant@example.com",
  phone: "999999999",
  documentNumber: "12345678",
  person: {
    firstName: "Ana",
    paternalLastName: "Pérez",
    createdAt: new Date("2026-01-15T12:00:00Z"),
    address: {
      street: "Av. Prueba 123",
      city: "",
      state: "Lima",
      countryCode: "PER",
      postalCode: null,
    },
  },
};

const authorization = {
  verify: () => true,
  createCallbackReference: vi.fn(),
  verifyCallbackReference: vi.fn(),
  consumeCallbackReference: vi.fn(),
};

function makeService(application: PaymentApplicationSnapshot) {
  const repository = {
    findApplicationById: vi.fn().mockResolvedValue(application),
    createPendingPayment: vi.fn(),
  };
  const service = new PaymentService(
    {} as never,
    new NiubizPaymentProvider(config, "TEST"),
    repository as unknown as IPaymentRepository,
    {} as never,
    authorization as never,
    false,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );
  return { service, repository };
}

describe("PaymentService — completitud del titular", () => {
  it("bloquea el pago con 422 y lista los datos faltantes antes de crear el pago", async () => {
    const { service, repository } = makeService(snapshot);

    await expect(service.initiate(input, "authorization", "127.0.0.1")).rejects.toMatchObject({
      status: 422,
      code: "PAYMENT_CARDHOLDER_DATA_INCOMPLETE",
      message: expect.stringContaining("distrito/ciudad"),
    });
    expect(repository.createPendingPayment).not.toHaveBeenCalled();
  });

  it("bloquea cuando falta toda la dirección del titular", async () => {
    const { service } = makeService({
      ...snapshot,
      person: { ...snapshot.person!, address: null },
    });

    await expect(service.initiate(input, "authorization", "127.0.0.1")).rejects.toMatchObject({
      message: expect.stringContaining("dirección, distrito/ciudad, departamento y país"),
    });
  });
});
