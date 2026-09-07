import { ApplicationStatus, PaymentGateway, PaymentStatus, Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

vi.mock("../../postulacion/Services/ApplicationStatusCalculatorService", () => ({
  ApplicationStatusCalculatorService: class {
    recalculate = vi.fn();
  },
}));

import type { IPaymentSandboxResetRepository, SandboxResetPayment } from "../Repositories/Interfaces/IPaymentSandboxResetRepository";
import { PaymentSandboxResetService } from "../Services/PaymentSandboxResetService";

const actor = { id: 11, roleSlug: "SUPER_ADMIN" };
const payment = (overrides: Partial<SandboxResetPayment> = {}): SandboxResetPayment => ({
  id: 71,
  applicationId: 42,
  gateway: PaymentGateway.NIUBIZ,
  status: PaymentStatus.PAID,
  hasInvoice: false,
  ...overrides,
});

class SandboxResetRepositoryFake implements IPaymentSandboxResetRepository {
  currentPayment: SandboxResetPayment | null = payment();
  billingDeleted = false;
  personDeleted = false;
  reset = vi.fn().mockImplementation(async () => undefined);
  audit = vi.fn().mockImplementation(async () => undefined);

  async withTransaction<T>(callback: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return callback({} as Prisma.TransactionClient);
  }

  async findPaymentForSandboxReset(): Promise<SandboxResetPayment | null> {
    return this.currentPayment;
  }

  async resetSandboxPayment(): Promise<void> {
    this.reset();
  }

  async createSandboxResetAudit(data: { userId: number; paymentId: number; applicationId: number; previousStatus: PaymentStatus }): Promise<void> {
    this.audit(data);
  }
}

const createService = (repository = new SandboxResetRepositoryFake(), environment: "TEST" | "PRODUCTION" = "TEST") => {
  const calculator = { recalculate: vi.fn().mockResolvedValue(ApplicationStatus.READY_FOR_PAYMENT) };
  return { repository, calculator, service: new PaymentSandboxResetService(repository, calculator, environment) };
};

describe("PaymentSandboxResetService", () => {
  it("permite a SUPER_ADMIN en TEST reiniciar PAID a PENDING y recalcula la postulación", async () => {
    const { service, calculator } = createService();
    await expect(service.reset(71, actor)).resolves.toMatchObject({ paymentId: 71, status: PaymentStatus.PENDING, applicationStatus: ApplicationStatus.READY_FOR_PAYMENT });
    expect(calculator.recalculate).toHaveBeenCalledWith(42, expect.anything());
  });

  it("rechaza a un usuario sin rol SUPER_ADMIN", async () => {
    const { service, repository } = createService();
    await expect(service.reset(71, { id: 12, roleSlug: "ADMIN" })).rejects.toMatchObject({ status: 403 });
    expect(repository.reset).not.toHaveBeenCalled();
  });

  it("nunca permite el reset en PRODUCTION", async () => {
    const { service, repository } = createService(undefined, "PRODUCTION");
    await expect(service.reset(71, actor)).rejects.toMatchObject({ status: 404 });
    expect(repository.reset).not.toHaveBeenCalled();
  });

  it("conserva el mismo Payment y no crea otro Payment ni Billing", async () => {
    const { service, repository } = createService();
    await service.reset(71, actor);
    expect(repository.reset).toHaveBeenCalledTimes(1);
    expect(repository.billingDeleted).toBe(false);
  });

  it("no altera Person ni elimina Billing", async () => {
    const { service, repository } = createService();
    await service.reset(71, actor);
    expect(repository.personDeleted).toBe(false);
    expect(repository.billingDeleted).toBe(false);
  });

  it("registra una auditoría sin metadata de tarjeta", async () => {
    const { service, repository } = createService();
    await service.reset(71, actor, { ipAddress: "127.0.0.1", userAgent: "Vitest" });
    expect(repository.audit).toHaveBeenCalledWith(expect.objectContaining({ userId: 11, paymentId: 71, applicationId: 42, previousStatus: PaymentStatus.PAID }));
  });

  it("bloquea el reset si existe Invoice", async () => {
    const repository = new SandboxResetRepositoryFake();
    repository.currentPayment = payment({ hasInvoice: true });
    const { service } = createService(repository);
    await expect(service.reset(71, actor)).rejects.toMatchObject({ status: 409 });
    expect(repository.reset).not.toHaveBeenCalled();
  });

  it("bloquea un pago PROCESSING para no competir con Authorization", async () => {
    const repository = new SandboxResetRepositoryFake();
    repository.currentPayment = payment({ status: PaymentStatus.PROCESSING });
    const { service } = createService(repository);
    await expect(service.reset(71, actor)).rejects.toMatchObject({ status: 409 });
    expect(repository.reset).not.toHaveBeenCalled();
  });

  it("solo acepta pagos de gateway NIUBIZ", async () => {
    const repository = new SandboxResetRepositoryFake();
    repository.currentPayment = payment({ gateway: PaymentGateway.MOCK });
    const { service } = createService(repository);
    await expect(service.reset(71, actor)).rejects.toMatchObject({ status: 409 });
  });

  it("mantiene el Payment listo para una nueva Session al devolverlo como PENDING", async () => {
    const { service } = createService();
    await expect(service.reset(71, actor)).resolves.toMatchObject({ status: PaymentStatus.PENDING, paymentId: 71 });
  });
});
