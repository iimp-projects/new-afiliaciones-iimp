import { ApplicationStatus, BillingDocumentType, BillingReceiptType, BillingVerificationSource, BillingVerificationStatus, PaymentGateway, PaymentStatus } from "@prisma/client";
import type { CreatePaymentInput } from "../DTOs/create-payment.schema";
import type { AuthorizePaymentInput } from "../DTOs/authorize-payment.schema";
import type { CreatePaymentResponse } from "../Models/PaymentResponse";
import { MockPaymentProvider } from "../Providers/MockPaymentProvider";
import type { PaymentProvider } from "../Providers/PaymentProvider";
import { NiubizPaymentProvider, NiubizProviderConfigurationError, NiubizProviderNotReadyError } from "../Providers/NiubizPaymentProvider";
import { PaymentRepository } from "../Repositories/PaymentRepository";
import type { BillingTraceability, IPaymentRepository, PaymentGatewayResult, PersistedPayment } from "../Repositories/Interfaces/IPaymentRepository";
import { ApplicationStatusCalculatorService } from "../../postulacion/Services/ApplicationStatusCalculatorService";
import { paymentConfig } from "../Config/PaymentConfig";
import { PaymentAmountResolver } from "./PaymentAmountResolver";
import { paymentAuthorizationService } from "./PaymentAuthorizationService";
import { NiubizAuthorizationHttpError, NiubizAuthorizationNetworkError } from "./Niubiz/NiubizAuthorizationService";
import { PaymentConfirmationEmailService } from "./PaymentConfirmationEmailService";
import { PaymentSettingsResolver } from "../../../security/system-settings/Services/PaymentSettingsResolver";
import { billingDataSchema, type BillingDataInput } from "../DTOs/billing.schema";
import { isLegalEntityRuc } from "../Rules/BillingDocumentRules";
import { ApisNetPeService, type RucLookupResult } from "../../../shared/Services/ApisNetPeService";

export class PaymentServiceError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}

export class PaymentService {
  constructor(
    private readonly amountResolver = new PaymentAmountResolver(),
    private readonly provider: PaymentProvider = createPaymentProvider(),
    private readonly repository: IPaymentRepository = new PaymentRepository(),
    private readonly statusCalculator: Pick<ApplicationStatusCalculatorService, "recalculate"> = new ApplicationStatusCalculatorService(),
    private readonly authorizationService: Pick<typeof paymentAuthorizationService, "verify" | "createCallbackReference" | "verifyCallbackReference"> = paymentAuthorizationService,
    private readonly isNiubizTest = paymentConfig.provider === "NIUBIZ" && paymentConfig.environment === "TEST",
    private readonly confirmationEmailService: Pick<PaymentConfirmationEmailService, "sendIfNeeded"> = new PaymentConfirmationEmailService(repository),
    private readonly paymentSettingsResolver: Pick<PaymentSettingsResolver, "assertPaymentInitiationAvailable" | "getNiubizCheckoutSettings"> = new PaymentSettingsResolver(),
    private readonly rucLookup: Pick<ApisNetPeService, "getRuc"> = new ApisNetPeService(),
  ) {}

  async initiate(input: CreatePaymentInput, authorization: string | undefined, clientIp?: string): Promise<CreatePaymentResponse> {
    if (!this.authorizationService.verify(authorization, input.applicationId)) throw new PaymentServiceError("La autorización temporal de pago no es válida o expiró.", 403);
    const applicationForBilling = await this.repository.findApplicationById(input.applicationId);
    const resolvedBilling = await this.resolveBillingData(input.billingData, applicationForBilling?.documentNumber);
    const billingData = resolvedBilling.billingData;
    const provider = await this.getInitiationProvider();
    this.assertProviderReady(provider);
    const startedPayment = await this.repository.withTransaction(async (tx) => {
      const application = await this.repository.findApplicationById(input.applicationId, tx);
      this.assertPaymentEligible(application);
      const activePayment = await this.repository.findActivePayment(input.applicationId, tx);
      if (activePayment && this.canResumeNiubizTestPayment(activePayment)) return { payment: activePayment, application, resumed: true };
      if (activePayment) throw new PaymentServiceError("Ya existe un pago pendiente para esta postulación.", 409);
      await this.assertPaymentInitiationAvailable();
      const amount = await this.amountResolver.resolve();
      const payment = await this.repository.createPendingPayment({ applicationId: input.applicationId, billingData, billingTraceability: resolvedBilling.billingTraceability, gateway: provider.gateway, ...amount }, tx);
      return { payment, application, resumed: false };
    });

    const { payment, application, resumed } = startedPayment;
    const providerResult = await provider.initiate({
      paymentId: payment.id,
      applicationId: payment.applicationId,
      billingData,
      amount: payment.totalAmount,
      currency: payment.currency,
      customer: {
        email: application.email,
        ...(application.person?.firstName ? { firstName: application.person.firstName } : {}),
        ...(application.person?.paternalLastName ? { lastName: application.person.paternalLastName } : {}),
        ...(clientIp ? { clientIp } : {}),
        ...(application.phone ? { phone: application.phone } : {}),
        ...(application.personId ? { personId: application.personId } : {}),
        ...(application.documentNumber ? { documentNumber: application.documentNumber } : {}),
      },
    });
    const updatedPayment = resumed && providerResult.status === PaymentStatus.PENDING ? payment : await this.persistPaymentResult(payment, providerResult);
    const responseProviderResult = providerResult.checkout
      ? { ...providerResult, checkout: { ...providerResult.checkout, callbackUrl: this.withCallbackReference(providerResult.checkout.callbackUrl, payment) } }
      : providerResult;
    return this.toResponse(updatedPayment, responseProviderResult);
  }

  private async resolveBillingData(input: BillingDataInput, authorizedDocumentNumber?: string): Promise<{ billingData: BillingDataInput; billingTraceability: BillingTraceability }> {
    const parsed = billingDataSchema.safeParse(input);
    if (!parsed.success) throw new PaymentServiceError("Los datos de facturación no son válidos.", 422);
    const billingData = parsed.data;
    const documentType = billingData.tipoDocumento as BillingDocumentType;
    const receiptType = documentType === BillingDocumentType.RUC ? BillingReceiptType.FACTURA : BillingReceiptType.BOLETA;
    const manual = { documentType, receiptType, billingContact: billingData.responsable, verificationSource: BillingVerificationSource.MANUAL, verificationStatus: BillingVerificationStatus.NOT_VERIFIED } satisfies BillingTraceability;
    if (documentType !== BillingDocumentType.RUC) {
      const isAuthorized = billingData.numeroDocumento === authorizedDocumentNumber;
      return { billingData, billingTraceability: isAuthorized ? { ...manual, verificationSource: BillingVerificationSource.PERSON_DATA, verificationStatus: BillingVerificationStatus.VERIFIED } : manual };
    }
    if (!isLegalEntityRuc(billingData.numeroDocumento)) return { billingData, billingTraceability: manual };
    const lookup: RucLookupResult = await this.rucLookup.getRuc(billingData.numeroDocumento);
    if (lookup.status === "SERVICE_ERROR") throw new PaymentServiceError("No se pudo verificar el RUC con SUNAT. Intente nuevamente.", 502);
    if (lookup.status === "NOT_FOUND") return { billingData, billingTraceability: manual };
    if (billingData.razonSocial.trim() !== lookup.data.razonSocial.trim() || billingData.direccionFiscal.trim() !== (lookup.data.direccion || "").trim()) throw new PaymentServiceError("Los datos oficiales del RUC no coinciden con SUNAT.", 422);
    const officialBilling = { ...billingData, razonSocial: lookup.data.razonSocial, direccionFiscal: lookup.data.direccion || "" };
    return { billingData: officialBilling, billingTraceability: { documentType, receiptType, billingContact: billingData.responsable, verificationSource: BillingVerificationSource.SUNAT, verificationStatus: BillingVerificationStatus.VERIFIED, verifiedBusinessName: lookup.data.razonSocial, verifiedBillingAddress: lookup.data.direccion || undefined, verifiedTaxStatus: lookup.data.estado || undefined, verifiedTaxCondition: lookup.data.condicion || undefined, verifiedAt: new Date() } };
  }

  async authorize(input: AuthorizePaymentInput, authorization: string | undefined): Promise<PersistedPayment> {
    if (!this.authorizationService.verify(authorization, input.applicationId)) throw new PaymentServiceError("La autorización temporal de pago no es válida o expiró.", 403);
    return this.authorizeNiubizPayment(await this.repository.findPaymentByIdForApplication(input.paymentId, input.applicationId), input.transactionToken);
  }

  async authorizeFromCallback(callbackReference: string | undefined, transactionToken: string, paymentChannel?: string): Promise<PersistedPayment> {
    const reference = this.authorizationService.verifyCallbackReference(callbackReference);
    if (!reference) throw new PaymentServiceError("La referencia temporal del Checkout no es válida o expiró.", 403);
    return this.authorizeNiubizPayment(await this.repository.findPaymentByIdForApplication(reference.paymentId, reference.applicationId), transactionToken, paymentChannel);
  }

  private async authorizeNiubizPayment(payment: PersistedPayment | null, transactionToken: string, paymentChannel?: string): Promise<PersistedPayment> {
    if (!payment) throw new PaymentServiceError("El pago no existe para esta postulación.", 404);
    if (payment.gateway !== PaymentGateway.NIUBIZ) throw new PaymentServiceError("El pago no corresponde a Niubiz.", 409);
    if (payment.status === PaymentStatus.PAID) {
      await this.confirmationEmailService.sendIfNeeded(payment.id);
      return payment;
    }
    if (payment.status !== PaymentStatus.PENDING) throw new PaymentServiceError("El pago ya está siendo procesado o no puede autorizarse.", 409);
    if (!(this.provider instanceof NiubizPaymentProvider)) throw new PaymentServiceError("Niubiz no está seleccionado como proveedor de pago.", 409);
    try {
      this.provider.assertAuthorizationReady();
    } catch (error) {
      if (error instanceof NiubizProviderConfigurationError) throw new PaymentServiceError(error.message, 503);
      throw error;
    }
    const claimedPayment = await this.repository.claimPendingNiubizPayment(payment.id);
    if (!claimedPayment) throw new PaymentServiceError("El pago ya está siendo procesado o no puede autorizarse.", 409);

    try {
      const { result } = await this.provider.authorize({ paymentId: claimedPayment.id, applicationId: claimedPayment.applicationId, amount: claimedPayment.totalAmount, currency: claimedPayment.currency }, transactionToken, paymentChannel);
      const persistedPayment = await this.persistPaymentResult(claimedPayment, result);
      if (persistedPayment.status === PaymentStatus.PAID) await this.confirmationEmailService.sendIfNeeded(persistedPayment.id);
      return persistedPayment;
    } catch (error) {
      if (error instanceof NiubizAuthorizationHttpError && error.response) {
        const result = this.provider.mapAuthorizationResponse(error.response, paymentChannel, error.status);
        if (result.status === PaymentStatus.FAILED) return this.persistPaymentResult(claimedPayment, result);
      }
      await this.repository.updatePaymentResult(claimedPayment.id, { status: PaymentStatus.PENDING });
      if (error instanceof NiubizAuthorizationHttpError || error instanceof NiubizAuthorizationNetworkError) {
        throw new PaymentServiceError("No se pudo confirmar la autorización Niubiz; el pago permanece pendiente.", 502);
      }
      throw new PaymentServiceError("No se pudo confirmar la autorización Niubiz; el pago permanece pendiente.", 502);
    }
  }

  private async persistPaymentResult(payment: PersistedPayment, result: PaymentGatewayResult): Promise<PersistedPayment> {
    return this.repository.withTransaction(async (tx) => {
      const updated = await this.repository.updatePaymentResult(payment.id, result, tx);
      if (updated.status === PaymentStatus.PAID) await this.statusCalculator.recalculate(updated.applicationId, tx);
      return updated;
    });
  }

  private withCallbackReference(callbackUrl: string, payment: PersistedPayment): string {
    const url = new URL(callbackUrl);
    url.searchParams.set("payment_callback", this.authorizationService.createCallbackReference(payment.id, payment.applicationId, paymentConfig.authorizationTtlSeconds));
    return url.toString();
  }

  private assertPaymentEligible(application: Awaited<ReturnType<IPaymentRepository["findApplicationById"]>>): asserts application is NonNullable<typeof application> {
    if (!application) throw new PaymentServiceError("La postulación no existe.", 404);
    if (application.deletedAt) throw new PaymentServiceError("La postulación no está disponible para pago.", 409);
    if (application.status !== ApplicationStatus.READY_FOR_PAYMENT) throw new PaymentServiceError("La postulación no está apta para pago.", 409);
  }

  private canResumeNiubizTestPayment(payment: PersistedPayment): boolean {
    return this.isNiubizTest && this.provider.gateway === PaymentGateway.NIUBIZ && payment.gateway === PaymentGateway.NIUBIZ && payment.status === PaymentStatus.PENDING;
  }

  private async getInitiationProvider(): Promise<PaymentProvider> {
    if (!(this.provider instanceof NiubizPaymentProvider)) return this.provider;
    const settings = await this.paymentSettingsResolver.getNiubizCheckoutSettings();
    return this.provider.withCheckoutSettings(settings);
  }

  private async assertPaymentInitiationAvailable(): Promise<void> {
    try { await this.paymentSettingsResolver.assertPaymentInitiationAvailable(); }
    catch (error) {
      if (error instanceof Error && "status" in error && typeof error.status === "number") throw new PaymentServiceError(error.message, error.status);
      throw error;
    }
  }

  private assertProviderReady(provider: PaymentProvider): void {
    try { provider.assertReady(); }
    catch (error) {
      if (error instanceof NiubizProviderConfigurationError || error instanceof NiubizProviderNotReadyError) throw new PaymentServiceError(error.message, 503);
      throw error;
    }
  }

  private toResponse(payment: PersistedPayment, providerResult: Awaited<ReturnType<PaymentProvider["initiate"]>>): CreatePaymentResponse {
    const messages = {
      PAID: "Pago aprobado por el simulador y registrado para pruebas.",
      FAILED: "Pago rechazado por el simulador. El intento quedó registrado.",
      PENDING: providerResult.checkout ? "Sesión Niubiz creada. Complete el Checkout para continuar." : "Pago pendiente en el simulador. El intento quedó registrado.",
    } as const;
    return { success: payment.status !== PaymentStatus.FAILED, paymentId: payment.id, status: payment.status as CreatePaymentResponse["status"], transactionId: providerResult.transactionId, authorizationCode: providerResult.authorizationCode, responseCode: providerResult.responseCode, amount: payment.totalAmount, currency: payment.currency, checkout: providerResult.checkout, message: messages[payment.status as keyof typeof messages] };
  }
}

function createPaymentProvider(): PaymentProvider {
  return paymentConfig.provider === "NIUBIZ" ? new NiubizPaymentProvider(paymentConfig.niubiz, paymentConfig.environment) : new MockPaymentProvider(paymentConfig.mockScenario);
}

export const paymentService = new PaymentService();
