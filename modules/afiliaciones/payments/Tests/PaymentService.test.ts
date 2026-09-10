import { ApplicationStatus, PaymentGateway, PaymentStatus, Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

vi.mock("../../postulacion/Services/ApplicationStatusCalculatorService", () => ({
  ApplicationStatusCalculatorService: class {
    recalculate = vi.fn();
  },
}));

import type { CreatePaymentInput } from "../DTOs/create-payment.schema";
import { MockPaymentProvider } from "../Providers/MockPaymentProvider";
import { NiubizPaymentProvider } from "../Providers/NiubizPaymentProvider";
import type { PaymentProvider } from "../Providers/PaymentProvider";
import type { IPaymentRepository, PaymentGatewayResult, PaymentTransaction, PendingPaymentData, PersistedPayment } from "../Repositories/Interfaces/IPaymentRepository";
import { PaymentAmountResolver } from "../Services/PaymentAmountResolver";
import { PaymentService, PaymentServiceError } from "../Services/PaymentService";
import { NiubizAuthorizationHttpError, NiubizAuthorizationNetworkError } from "../Services/Niubiz/NiubizAuthorizationService";

const input: CreatePaymentInput = {
  applicationId: 42,
  billingData: {
    tipoDocumento: "RUC",
    numeroDocumento: "10123456789",
    razonSocial: "Empresa de prueba SAC",
    direccionFiscal: "Av. Prueba 123",
    responsable: "Responsable de prueba",
    emailFacturacion: "facturacion@example.com",
  },
};

const authorizedPayment = {
  verify: () => true,
  createCallbackReference: () => "callback-reference",
  verifyCallbackReference: () => ({ paymentId: 99, applicationId: input.applicationId, expiresAt: Date.now() + 60_000 }),
};

const niubizAuthorizationConfig = {
  merchantId: "merchant-test", username: "username-test", password: "password-test",
  securityUrl: "https://sandbox.example/security", sessionUrl: "https://sandbox.example/session",
  authorizationUrl: "https://sandbox.example/authorization", checkoutUrl: "https://sandbox.example/checkout.js",
  callbackUrl: "http://localhost:3000/api/payments/niubiz/callback", timeoutUrl: "http://localhost:3000/consulta",
  merchantName: "IIMP", formButtonColor: "#C5A059",
  authorizationDataMap: { urlAddress: "https://sandbox.example", serviceLocationCityName: "Lima", serviceLocationCountrySubdivisionCode: "LIM", serviceLocationCountryCode: "PE", serviceLocationPostalCode: "15024" },
};

class PaymentRepositoryFake implements IPaymentRepository {
  created?: PendingPaymentData;
  paymentCreateCalls = 0;
  billingCreateCalls = 0;
  result?: PaymentGatewayResult;
  activePayment: PersistedPayment | null = null;
  paymentForAuthorization: PersistedPayment | null = null;

  async withTransaction<T>(callback: (tx: PaymentTransaction) => Promise<T>): Promise<T> {
    return callback({} as Prisma.TransactionClient);
  }

  async findApplicationById() {
    return {
      id: input.applicationId,
      personId: 7,
      status: ApplicationStatus.READY_FOR_PAYMENT,
      deletedAt: null,
      email: "applicant@example.com",
      phone: "999999999",
      documentNumber: "12345678",
      person: { firstName: "Ana", paternalLastName: "Pérez" },
    };
  }

  async findActivePayment() {
    return this.activePayment;
  }

  async findPaymentByIdForApplication() {
    return this.paymentForAuthorization;
  }

  async claimPendingNiubizPayment(paymentId: number) {
    const payment = this.paymentForAuthorization;
    return payment && payment.id === paymentId ? { ...payment, status: PaymentStatus.PROCESSING } : null;
  }

  async createPendingPayment(data: PendingPaymentData) {
    this.created = data;
    this.paymentCreateCalls += 1;
    this.billingCreateCalls += 1;
    return { id: 99, applicationId: data.applicationId, totalAmount: data.totalAmount, registrationAmount: data.registrationAmount, membershipFeeAmount: data.membershipFeeAmount, currency: "PEN" as const, gateway: data.gateway, status: PaymentStatus.PENDING };
  }

  async updatePaymentResult(paymentId: number, result: PaymentGatewayResult) {
    this.result = result;
    const payment = { id: paymentId, applicationId: input.applicationId, totalAmount: this.created?.totalAmount ?? 0, registrationAmount: this.created?.registrationAmount ?? null, membershipFeeAmount: this.created?.membershipFeeAmount ?? null, currency: "PEN" as const, gateway: "MOCK" as const, status: result.status };
    if (result.status === PaymentStatus.PENDING) this.activePayment = payment;
    return payment;
  }

  async findActivePaymentIntegrationSource() { return null; }

  async findPaymentConfirmationDetails() { return null; }
  async markConfirmationEmailSent() { return false; }
}

describe("PaymentService", () => {
  it("processes a STUDENT_COMPLETION integration captured from recalculation only after the payment transaction", async () => {
    const repository = new PaymentRepositoryFake();
    const transactionEvents: string[] = [];
    repository.withTransaction = async (callback) => {
      transactionEvents.push("begin");
      const result = await callback({} as Prisma.TransactionClient);
      transactionEvents.push("commit");
      return result;
    };
    const statusCalculator = { recalculate: vi.fn(async (_applicationId: number, _tx: Prisma.TransactionClient, onIntegrationPrepared?: (id: number) => void) => { onIntegrationPrepared?.(701); return ApplicationStatus.COMPLETED; }) };
    const associates = { prepareActivePayment: vi.fn(), processAfterCommit: vi.fn(async () => { transactionEvents.push("http"); }) };
    const settings = { getRegistrationPrice: vi.fn().mockResolvedValue({ amount: new Prisma.Decimal("150") }), getMonthlyFee: vi.fn().mockResolvedValue({ value: new Prisma.Decimal("150") }) };
    const service = new PaymentService(new PaymentAmountResolver(settings as never), new MockPaymentProvider("PAID"), repository, statusCalculator as never, authorizedPayment, false, undefined, undefined, undefined, associates as never);

    await service.initiate(input, "authorized");

    expect(associates.prepareActivePayment).not.toHaveBeenCalled();
    expect(associates.processAfterCommit).toHaveBeenCalledOnce();
    expect(associates.processAfterCommit).toHaveBeenCalledWith(701);
    expect(transactionEvents).toEqual(["begin", "commit", "begin", "commit", "http"]);
  });

  it.each(["PAID", "FAILED", "PENDING"] as const)("persiste y devuelve el resultado MOCK %s", async (scenario) => {
    const repository = new PaymentRepositoryFake();
    const recalculate = vi.fn().mockResolvedValue(ApplicationStatus.COMPLETED);
    const registrationPrice = new Prisma.Decimal("150.00");
    const settings = { getRegistrationPrice: vi.fn().mockResolvedValue({ amount: registrationPrice }), getMonthlyFee: vi.fn().mockResolvedValue({ value: new Prisma.Decimal("150.00") }) };
    const amountResolver = new PaymentAmountResolver(settings as never);
    const service = new PaymentService(
      amountResolver,
      new MockPaymentProvider(scenario),
      repository,
      { recalculate },
      authorizedPayment,
    );

    const result = await service.initiate(input, "authorized");

    expect(settings.getRegistrationPrice).toHaveBeenCalledOnce();
    expect(repository.created).toMatchObject({ applicationId: 42, registrationAmount: 150, membershipFeeAmount: 150, totalAmount: 300, currency: "PEN" });
    expect(repository.created?.billingData.numeroDocumento).toBe("10123456789");
    expect(result).toMatchObject({ paymentId: 99, status: scenario, amount: 300, registrationAmount: 150, membershipFeeAmount: 150, currency: "PEN" });
    expect(repository.result?.status).toBe(scenario);
    expect(recalculate).toHaveBeenCalledTimes(scenario === "PAID" ? 1 : 0);
  });

  it("rechaza un segundo intento cuando ya hay un pago pendiente", async () => {
    const repository = new PaymentRepositoryFake();
    const service = new PaymentService(undefined, new MockPaymentProvider("PENDING"), repository, { recalculate: vi.fn() }, authorizedPayment);

    await service.initiate(input, "authorized");

    await expect(service.initiate(input, "authorized")).rejects.toMatchObject({ status: 409 } satisfies Partial<PaymentServiceError>);
  });

  it("no persiste un pago cuando Niubiz TEST no está configurado", async () => {
    const repository = new PaymentRepositoryFake();
    const service = new PaymentService(undefined, new NiubizPaymentProvider({}), repository, { recalculate: vi.fn() }, authorizedPayment);

    await expect(service.initiate(input, "authorized")).rejects.toMatchObject({ status: 503 } satisfies Partial<PaymentServiceError>);
    expect(repository.created).toBeUndefined();
  });

  it("mantiene PENDING si faltan datos obligatorios de Authorization", async () => {
    const repository = new PaymentRepositoryFake();
    repository.paymentForAuthorization = {
      id: 99,
      applicationId: 42,
      totalAmount: 300,
      currency: "PEN",
      gateway: "NIUBIZ",
      status: PaymentStatus.PENDING,
    };
    const service = new PaymentService(
      undefined,
      new NiubizPaymentProvider({
        merchantId: "merchant-test",
        username: "username-test",
        password: "password-test",
        securityUrl: "https://sandbox.example/security",
        sessionUrl: "https://sandbox.example/session",
        authorizationUrl: "https://sandbox.example/authorization",
        checkoutUrl: "https://sandbox.example/checkout.js",
        callbackUrl: "http://localhost:3000/api/payments/niubiz/callback",
        timeoutUrl: "http://localhost:3000/consulta",
        merchantName: "IIMP",
        formButtonColor: "#C5A059",
      }, "TEST"),
      repository,
      { recalculate: vi.fn() },
      authorizedPayment,
    );

    await expect(service.authorize({ applicationId: 42, paymentId: 99, transactionToken: "checkout-token" }, "authorized"))
      .rejects.toMatchObject({ status: 503 } satisfies Partial<PaymentServiceError>);
    expect(repository.result).toBeUndefined();
  });

  it.each([
    ["timeout/red", new NiubizAuthorizationNetworkError("timeout")],
    ...[500, 502, 503, 504].map((status) => [`HTTP ${status}`, new NiubizAuthorizationHttpError(status, { errorCode: "400", ACTION_DESCRIPTION: "Denegada" })] as const),
    ["body vacÃ­o", new NiubizAuthorizationHttpError(400)],
  ] as const)("mantiene PENDING ante %s", async (_caseName, error) => {
    const repository = new PaymentRepositoryFake();
    repository.paymentForAuthorization = { id: 99, applicationId: 42, totalAmount: 300, currency: "PEN", gateway: PaymentGateway.NIUBIZ, status: PaymentStatus.PENDING };
    const provider = new NiubizPaymentProvider(niubizAuthorizationConfig, "TEST");
    vi.spyOn(provider, "authorize").mockRejectedValue(error);
    const service = new PaymentService(undefined, provider, repository, { recalculate: vi.fn() }, authorizedPayment);

    await expect(service.authorize({ applicationId: 42, paymentId: 99, transactionToken: "checkout-token" }, "authorized"))
      .rejects.toMatchObject({ status: 502 } satisfies Partial<PaymentServiceError>);
    expect(repository.result).toMatchObject({ status: PaymentStatus.PENDING });
    expect(repository.result?.failureCode).toBeUndefined();
  });
  it("reutiliza un Payment PENDING de Niubiz TEST sin crear Payment ni Billing", async () => {
    const repository = new PaymentRepositoryFake();
    repository.activePayment = { id: 77, applicationId: input.applicationId, totalAmount: 300, currency: "PEN", gateway: PaymentGateway.NIUBIZ, status: PaymentStatus.PENDING };
    const provider: PaymentProvider = {
      gateway: PaymentGateway.NIUBIZ,
      assertReady: vi.fn(),
      initiate: vi.fn().mockResolvedValue({
        status: PaymentStatus.PENDING,
        checkout: { sessionToken: "session-token", merchantId: "merchant-test", purchaseNumber: "77", amount: 300, currency: "PEN", checkoutUrl: "https://sandbox.example/checkout.js", callbackUrl: "http://localhost:3000/api/payments/niubiz/callback", timeoutUrl: "http://localhost:3000/consulta", expirationMinutes: 5, merchantName: "IIMP", formButtonColor: "#C5A059" },
      }),
    };
    const service = new PaymentService(undefined, provider, repository, { recalculate: vi.fn() }, authorizedPayment, true);

    const result = await service.initiate(input, "authorized");

    expect(result).toMatchObject({ paymentId: 77, status: PaymentStatus.PENDING });
    expect(provider.initiate).toHaveBeenCalledWith(expect.objectContaining({ paymentId: 77, amount: 300, currency: "PEN" }));
    expect(repository.paymentCreateCalls).toBe(0);
    expect(repository.billingCreateCalls).toBe(0);
    expect(repository.result).toBeUndefined();
  });

  it("mantiene bloqueado un Payment Niubiz PROCESSING en TEST", async () => {
    const repository = new PaymentRepositoryFake();
    repository.activePayment = { id: 77, applicationId: input.applicationId, totalAmount: 300, currency: "PEN", gateway: PaymentGateway.NIUBIZ, status: PaymentStatus.PROCESSING };
    const provider: PaymentProvider = { gateway: PaymentGateway.NIUBIZ, assertReady: vi.fn(), initiate: vi.fn() };
    const service = new PaymentService(undefined, provider, repository, { recalculate: vi.fn() }, authorizedPayment, true);

    await expect(service.initiate(input, "authorized")).rejects.toMatchObject({ status: 409 } satisfies Partial<PaymentServiceError>);
    expect(provider.initiate).not.toHaveBeenCalled();
    expect(repository.paymentCreateCalls).toBe(0);
    expect(repository.billingCreateCalls).toBe(0);
  });

  it("reutiliza el mismo Payment PENDING en dos reentradas consecutivas de Niubiz TEST", async () => {
    const repository = new PaymentRepositoryFake();
    repository.activePayment = { id: 77, applicationId: input.applicationId, totalAmount: 300, currency: "PEN", gateway: PaymentGateway.NIUBIZ, status: PaymentStatus.PENDING };
    const provider: PaymentProvider = {
      gateway: PaymentGateway.NIUBIZ,
      assertReady: vi.fn(),
      initiate: vi.fn()
        .mockResolvedValueOnce({ status: PaymentStatus.PENDING, checkout: { sessionToken: "session-one", merchantId: "merchant-test", purchaseNumber: "77", amount: 300, currency: "PEN", checkoutUrl: "https://sandbox.example/checkout.js", callbackUrl: "http://localhost:3000/api/payments/niubiz/callback", timeoutUrl: "http://localhost:3000/consulta", expirationMinutes: 5, merchantName: "IIMP", formButtonColor: "#C5A059" } })
        .mockResolvedValueOnce({ status: PaymentStatus.PENDING, checkout: { sessionToken: "session-two", merchantId: "merchant-test", purchaseNumber: "77", amount: 300, currency: "PEN", checkoutUrl: "https://sandbox.example/checkout.js", callbackUrl: "http://localhost:3000/api/payments/niubiz/callback", timeoutUrl: "http://localhost:3000/consulta", expirationMinutes: 5, merchantName: "IIMP", formButtonColor: "#C5A059" } }),
    };
    const service = new PaymentService(undefined, provider, repository, { recalculate: vi.fn() }, authorizedPayment, true);

    const first = await service.initiate(input, "authorized");
    const second = await service.initiate(input, "authorized");

    expect(first.paymentId).toBe(77);
    expect(second.paymentId).toBe(77);
    expect(provider.initiate).toHaveBeenCalledTimes(2);
    expect(repository.paymentCreateCalls).toBe(0);
    expect(repository.billingCreateCalls).toBe(0);
  });

  it("usa el monto dinámico únicamente al crear un Payment nuevo", async () => {
    const repository = new PaymentRepositoryFake();
    const amountResolver = { resolve: vi.fn().mockResolvedValue({ registrationAmount: 425.5, membershipFeeAmount: 150, totalAmount: 575.5, currency: "PEN" }) };
    const availability = { assertPaymentInitiationAvailable: vi.fn().mockResolvedValue(undefined), getNiubizCheckoutSettings: vi.fn() };
    const service = new PaymentService(amountResolver as never, new MockPaymentProvider("PENDING"), repository, { recalculate: vi.fn() }, authorizedPayment, false, undefined, availability as never);
    await service.initiate(input, "authorized");
    expect(amountResolver.resolve).toHaveBeenCalledOnce();
    expect(repository.created).toMatchObject({ registrationAmount: 425.5, membershipFeeAmount: 150, totalAmount: 575.5 });
    expect(availability.assertPaymentInitiationAvailable).toHaveBeenCalledOnce();
  });

  it("reutiliza el monto persistido sin recalcular ni revalidar disponibilidad", async () => {
    const repository = new PaymentRepositoryFake();
    repository.activePayment = { id: 77, applicationId: input.applicationId, totalAmount: 300, currency: "PEN", gateway: PaymentGateway.NIUBIZ, status: PaymentStatus.PENDING };
    const amountResolver = { resolve: vi.fn() };
    const availability = { assertPaymentInitiationAvailable: vi.fn(), getNiubizCheckoutSettings: vi.fn() };
    const provider: PaymentProvider = { gateway: PaymentGateway.NIUBIZ, assertReady: vi.fn(), initiate: vi.fn().mockResolvedValue({ status: PaymentStatus.PENDING }) };
    const service = new PaymentService(amountResolver as never, provider, repository, { recalculate: vi.fn() }, authorizedPayment, true, undefined, availability as never);
    await service.initiate(input, "authorized");
    expect(amountResolver.resolve).not.toHaveBeenCalled();
    expect(availability.assertPaymentInitiationAvailable).not.toHaveBeenCalled();
    expect(provider.initiate).toHaveBeenCalledWith(expect.objectContaining({ amount: 300 }));
  });

  it("bloquea la creación cuando System Settings deshabilita pagos", async () => {
    const repository = new PaymentRepositoryFake();
    const amountResolver = { resolve: vi.fn() };
    const availability = { assertPaymentInitiationAvailable: vi.fn().mockRejectedValue(new PaymentServiceError("Los pagos se encuentran deshabilitados temporalmente.", 409)), getNiubizCheckoutSettings: vi.fn() };
    const service = new PaymentService(amountResolver as never, new MockPaymentProvider("PENDING"), repository, { recalculate: vi.fn() }, authorizedPayment, false, undefined, availability as never);
    await expect(service.initiate(input, "authorized")).rejects.toMatchObject({ status: 409 });
    expect(repository.created).toBeUndefined();
  });

  it("rechaza datos RUC 20 manipulados y falla si SUNAT no está disponible", async () => {
    const repository = new PaymentRepositoryFake();
    const lookup = { getRuc: vi.fn().mockResolvedValue({ status: "VERIFIED", data: { razonSocial: "Empresa oficial SAC", direccion: "Av. Oficial 123", numeroDocumento: "20123456789", estado: "ACTIVO", condicion: "HABIDO", departamento: "Lima", provincia: "Lima", distrito: "Lima" } }) };
    const service = new PaymentService(undefined, new MockPaymentProvider("PENDING"), repository, { recalculate: vi.fn() }, authorizedPayment, false, undefined, undefined, lookup);
    const request = { ...input, billingData: { ...input.billingData, numeroDocumento: "20123456789", razonSocial: "Manipulado", direccionFiscal: "Av. Alterada" } };
    await expect(service.initiate(request, "authorized")).rejects.toMatchObject({ status: 422 });
    lookup.getRuc.mockResolvedValueOnce({ status: "SERVICE_ERROR" });
    await expect(service.initiate({ ...request, billingData: { ...request.billingData, razonSocial: "Empresa oficial SAC", direccionFiscal: "Av. Oficial 123" } }, "authorized")).rejects.toMatchObject({ status: 502 });
  });
});
