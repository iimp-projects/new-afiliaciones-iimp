import { PaymentGateway } from "@prisma/client";
import type { NiubizTestConfig, PaymentEnvironment } from "../Config/PaymentConfig";
import type { NiubizAuthorizationResponse } from "../DTOs/Niubiz/NiubizAuthorization.dto";
import type { NiubizCheckoutConfig } from "../DTOs/Niubiz/NiubizCheckout.dto";
import type { NiubizDataMap, NiubizSessionRequest } from "../DTOs/Niubiz/NiubizSession.dto";
import type { PaymentGatewayResult } from "../Repositories/Interfaces/IPaymentRepository";
import { NiubizAuthorizationService } from "../Services/Niubiz/NiubizAuthorizationService";
import { NiubizResponseMapper, type NiubizMappedAuthorizationResponse } from "../Services/Niubiz/NiubizResponseMapper";
import { NiubizSecurityService } from "../Services/Niubiz/NiubizSecurityService";
import { NiubizSessionService } from "../Services/Niubiz/NiubizSessionService";
import type { PaymentProvider, PaymentProviderCommand } from "./PaymentProvider";

export type NiubizAuthorizationCommand = Pick<PaymentProviderCommand, "paymentId" | "applicationId" | "amount" | "currency">;

export class NiubizProviderConfigurationError extends Error {}
export class NiubizProviderNotReadyError extends Error {}

/**
 * Orquesta el contrato funcional legado sin ejecutar tráfico de red todavía.
 * Las llamadas se habilitarán únicamente tras validar el entorno TEST real.
 */
export class NiubizPaymentProvider implements PaymentProvider {
  readonly gateway = PaymentGateway.NIUBIZ;

  constructor(
    private readonly config: NiubizTestConfig,
    private readonly environment?: PaymentEnvironment,
    private readonly securityService = new NiubizSecurityService(),
    private readonly sessionService = new NiubizSessionService(),
    private readonly authorizationService = new NiubizAuthorizationService(),
    private readonly responseMapper = new NiubizResponseMapper(),
  ) {}

  assertReady(): void {
    this.assertConfigured();
  }

  assertAuthorizationReady(): void {
    this.assertAuthorizationConfigured();
  }

  withCheckoutSettings(settings: { merchantName: string; logoUrl?: string; formButtonColor: string; expirationMinutes: number }): NiubizPaymentProvider {
    return new NiubizPaymentProvider({
      ...this.config,
      merchantName: settings.merchantName,
      merchantLogoUrl: settings.logoUrl,
      formButtonColor: settings.formButtonColor,
      sessionExpirationMinutes: settings.expirationMinutes,
    }, this.environment);
  }

  buildSecurityRequest() {
    this.assertConfigured();
    return this.securityService.buildRequest(this.config);
  }

  buildSessionRequest(command: PaymentProviderCommand, securityToken: string, options?: {
    merchantDefineData?: NiubizDataMap;
    dataMap?: NiubizDataMap;
  }): NiubizSessionRequest {
    this.assertConfigured();
    return this.sessionService.buildRequest(this.config, {
      merchantId: this.config.merchantId!,
      securityToken,
      amount: command.amount,
      clientIp: command.customer.clientIp,
      merchantDefineData: options?.merchantDefineData ?? this.buildMerchantDefineData(command),
      dataMap: options?.dataMap,
    });
  }

  buildCheckoutConfig(command: PaymentProviderCommand, sessionToken: string): NiubizCheckoutConfig {
    this.assertConfigured();
    return {
      sessionToken,
      merchantId: this.config.merchantId!,
      purchaseNumber: String(command.paymentId),
      amount: command.amount,
      currency: command.currency,
      checkoutUrl: this.config.checkoutUrl!,
      callbackUrl: this.config.callbackUrl!,
      timeoutUrl: this.config.timeoutUrl!,
      expirationMinutes: this.config.sessionExpirationMinutes ?? 5,
      merchantName: this.config.merchantName!,
      formButtonColor: this.config.formButtonColor!,
      ...(this.config.merchantLogoUrl ? { merchantLogoUrl: this.config.merchantLogoUrl } : {}),
      ...(command.customer.email ? { cardholderEmail: command.customer.email } : {}),
      ...(command.customer.firstName ? { cardholderName: command.customer.firstName } : {}),
      ...(command.customer.lastName ? { cardholderLastName: command.customer.lastName } : {}),
    };
  }

  buildAuthorizationRequest(command: PaymentProviderCommand, securityToken: string, tokenId: string, dataMap?: NiubizDataMap) {
    this.assertConfigured();
    return this.authorizationService.buildRequest(this.config, {
      merchantId: this.config.merchantId!,
      securityToken,
      amount: command.amount,
      currency: command.currency,
      purchaseNumber: String(command.paymentId),
      tokenId,
      dataMap,
    });
  }

  mapAuthorizationResponse(response: NiubizAuthorizationResponse, paymentChannel?: string, httpStatus = 200): NiubizMappedAuthorizationResponse {
    return this.responseMapper.mapAuthorization(response, paymentChannel, httpStatus);
  }

  async authorize(command: NiubizAuthorizationCommand, transactionToken: string, paymentChannel?: string): Promise<{ result: NiubizMappedAuthorizationResponse; status: number }> {
    this.assertAuthorizationConfigured();
    const security = await this.securityService.getAccessToken(this.config);
    const authorization = await this.authorizationService.authorize(this.config, {
      merchantId: this.config.merchantId!,
      securityToken: security.accessToken,
      amount: command.amount,
      currency: command.currency,
      purchaseNumber: String(command.paymentId),
      tokenId: transactionToken,
      captureType: "manual",
      countable: true,
      dataMap: this.buildAuthorizationDataMap(),
    });
    return { result: this.mapAuthorizationResponse(authorization.response, paymentChannel, authorization.status), status: authorization.status };
  }

  async initiate(command: PaymentProviderCommand): Promise<PaymentGatewayResult> {
    this.assertReady();
    const security = await this.securityService.getAccessToken(this.config);
    const { session } = await this.sessionService.createSession(this.config, {
      merchantId: this.config.merchantId!,
      securityToken: security.accessToken,
      amount: command.amount,
      clientIp: command.customer.clientIp,
      merchantDefineData: this.buildMerchantDefineData(command),
    });

    return {
      status: "PENDING",
      checkout: this.buildCheckoutConfig(command, session.sessionKey),
    };
  }

  private assertConfigured(): void {
    const missing = [
      !this.config.merchantId && "NIUBIZ_MERCHANT_ID",
      !this.config.username && "NIUBIZ_USERNAME",
      !this.config.password && "NIUBIZ_PASSWORD",
      !this.config.securityUrl && "NIUBIZ_SECURITY_URL",
      !this.config.sessionUrl && "NIUBIZ_SESSION_URL",
      !this.config.authorizationUrl && "NIUBIZ_AUTHORIZATION_URL",
      !this.config.checkoutUrl && "NIUBIZ_CHECKOUT_URL",
      !this.config.callbackUrl && "NIUBIZ_CALLBACK_URL",
      !this.config.timeoutUrl && "NIUBIZ_TIMEOUT_URL",
      !this.config.merchantName && "NIUBIZ_MERCHANT_NAME",
      !this.config.formButtonColor && "NIUBIZ_FORM_BUTTON_COLOR",
      this.environment !== "TEST" && "PAYMENT_ENVIRONMENT=TEST",
    ].filter(Boolean);

    if (missing.length > 0) {
      throw new NiubizProviderConfigurationError(
        `Niubiz TEST no está configurado. Faltan: ${missing.join(", ")}.`,
      );
    }
  }

  private assertAuthorizationConfigured(): void {
    this.assertConfigured();
    const dataMap = this.config.authorizationDataMap;
    const missing = [
      !dataMap?.urlAddress && "NIUBIZ_URL_ADDRESS",
      !dataMap?.serviceLocationCityName && "NIUBIZ_SERVICE_LOCATION_CITY_NAME",
      !dataMap?.serviceLocationCountrySubdivisionCode && "NIUBIZ_SERVICE_LOCATION_COUNTRY_SUBDIVISION_CODE",
      !dataMap?.serviceLocationCountryCode && "NIUBIZ_SERVICE_LOCATION_COUNTRY_CODE",
      !dataMap?.serviceLocationPostalCode && "NIUBIZ_SERVICE_LOCATION_POSTAL_CODE",
    ].filter(Boolean);
    if (missing.length > 0) throw new NiubizProviderConfigurationError(`Niubiz Authorization no está configurado. Faltan: ${missing.join(", ")}.`);
  }

  private buildAuthorizationDataMap(): NiubizDataMap {
    const dataMap = this.config.authorizationDataMap!;
    return {
      urlAddress: dataMap.urlAddress!,
      serviceLocationCityName: dataMap.serviceLocationCityName!,
      serviceLocationCountrySubdivisionCode: dataMap.serviceLocationCountrySubdivisionCode!,
      serviceLocationCountryCode: dataMap.serviceLocationCountryCode!,
      serviceLocationPostalCode: dataMap.serviceLocationPostalCode!,
    };
  }

  private buildMerchantDefineData(command: PaymentProviderCommand): NiubizDataMap | undefined {
    const data: NiubizDataMap = {};
    if (command.customer.email) data.MDD4 = command.customer.email;
    if (command.customer.phone) data.MDD31 = command.customer.phone;
    if (command.customer.personId) data.MDD32 = String(command.customer.personId);
    if (command.customer.documentNumber) data.MDD34 = command.customer.documentNumber;
    return Object.keys(data).length > 0 ? data : undefined;
  }
}
