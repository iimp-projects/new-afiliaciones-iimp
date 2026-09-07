import { PaymentGateway, PaymentStatus } from "@prisma/client";
import { ApplicationStatusCalculatorService } from "../../postulacion/Services/ApplicationStatusCalculatorService";
import { paymentConfig, type PaymentEnvironment } from "../Config/PaymentConfig";
import { PaymentRepository } from "../Repositories/PaymentRepository";
import type { IPaymentSandboxResetRepository } from "../Repositories/Interfaces/IPaymentSandboxResetRepository";

export class PaymentSandboxResetError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

export interface SandboxResetActor {
  id: number;
  roleSlug: string;
}

export interface SandboxResetRequestContext {
  ipAddress?: string;
  userAgent?: string;
}

export class PaymentSandboxResetService {
  constructor(
    private readonly repository: IPaymentSandboxResetRepository = new PaymentRepository(),
    private readonly statusCalculator: Pick<ApplicationStatusCalculatorService, "recalculate"> = new ApplicationStatusCalculatorService(),
    private readonly environment: PaymentEnvironment | undefined = paymentConfig.environment,
  ) {}

  async reset(paymentId: number, actor: SandboxResetActor, context: SandboxResetRequestContext = {}) {
    this.assertSandboxAccess(actor);

    return this.repository.withTransaction(async (tx) => {
      const payment = await this.repository.findPaymentForSandboxReset(paymentId, tx);
      if (!payment) throw new PaymentSandboxResetError("El pago no existe.", 404);
      if (payment.gateway !== PaymentGateway.NIUBIZ) throw new PaymentSandboxResetError("Solo se pueden reiniciar pagos Niubiz de prueba.", 409);
      if (payment.status === PaymentStatus.PROCESSING) throw new PaymentSandboxResetError("El pago está siendo procesado y no puede reiniciarse.", 409);
      if (payment.hasInvoice) throw new PaymentSandboxResetError("El pago tiene un comprobante emitido y no es seguro reiniciarlo.", 409);

      await this.repository.resetSandboxPayment(payment.id, tx);
      const applicationStatus = await this.statusCalculator.recalculate(payment.applicationId, tx);
      await this.repository.createSandboxResetAudit({
        userId: actor.id,
        paymentId: payment.id,
        applicationId: payment.applicationId,
        previousStatus: payment.status,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      }, tx);

      return { paymentId: payment.id, applicationId: payment.applicationId, status: PaymentStatus.PENDING, applicationStatus };
    });
  }

  private assertSandboxAccess(actor: SandboxResetActor): void {
    if (this.environment !== "TEST") throw new PaymentSandboxResetError("Esta operación solo está disponible en Sandbox.", 404);
    if (actor.roleSlug !== "SUPER_ADMIN") throw new PaymentSandboxResetError("No tienes permiso para reiniciar pagos de prueba.", 403);
  }
}

export const paymentSandboxResetService = new PaymentSandboxResetService();
