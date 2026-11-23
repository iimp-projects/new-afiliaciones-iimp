import { PaymentGateway } from "@prisma/client";
import type {
  NiubizTestConfig,
  PaymentEnvironment,
} from "../Config/PaymentConfig";
import type { NiubizAuthorizationResponse } from "../DTOs/Niubiz/NiubizAuthorization.dto";
import type { NiubizCheckoutConfig } from "../DTOs/Niubiz/NiubizCheckout.dto";
import type {
  NiubizDataMap,
  NiubizSessionRequest,
} from "../DTOs/Niubiz/NiubizSession.dto";
import type { NiubizStageTrace } from "../DTOs/Niubiz/NiubizSessionDiagnostic.dto";
import type { PaymentGatewayResult } from "../Repositories/Interfaces/IPaymentRepository";
import { NiubizAuthorizationService } from "../Services/Niubiz/NiubizAuthorizationService";
import {
  NiubizResponseMapper,
  type NiubizMappedAuthorizationResponse,
} from "../Services/Niubiz/NiubizResponseMapper";
import { NiubizSecurityService } from "../Services/Niubiz/NiubizSecurityService";
import { NiubizSessionService } from "../Services/Niubiz/NiubizSessionService";
import {
  buildSessionDiagnostic,
  isCertPauseEnabled,
  isSessionDiagnosticsEnabled,
} from "../Services/Niubiz/NiubizSessionDiagnostics";
import { persistSessionEvidence } from "../Services/Niubiz/NiubizSessionEvidence";
import type {
  PaymentProvider,
  PaymentProviderCommand,
} from "./PaymentProvider";

export type NiubizAuthorizationCommand = Pick<
  PaymentProviderCommand,
  "paymentId" | "applicationId" | "amount" | "currency"
>;

export class NiubizProviderConfigurationError extends Error {}
export class NiubizProviderNotReadyError extends Error {}

const MIN_SESSION_EXPIRATION_MINUTES = 1;
const MAX_SESSION_EXPIRATION_MINUTES = 20;

const CARDHOLDER_DATA_MAP_FIELDS = [
  "cardholderCity",
  "cardholderCountry",
  "cardholderAddress",
  "cardholderState",
  "cardholderPhoneNumber",
] as const;

const REGISTERED_CUSTOMER_STATES = [
  "Registrado",
  "Invitado",
  "Empleado",
] as const;
type RegisteredCustomerState = (typeof REGISTERED_CUSTOMER_STATES)[number];

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

  withCheckoutSettings(settings: {
    merchantName: string;
    logoUrl?: string;
    formButtonColor: string;
    expirationMinutes: number;
  }): NiubizPaymentProvider {
    return new NiubizPaymentProvider(
      {
        ...this.config,
        merchantName: settings.merchantName,
        merchantLogoUrl: settings.logoUrl,
        formButtonColor: settings.formButtonColor,
        sessionExpirationMinutes: settings.expirationMinutes,
      },
      this.environment,
    );
  }

  buildSecurityRequest() {
    this.assertConfigured();
    return this.securityService.buildRequest(this.config);
  }

  buildSessionRequest(
    command: PaymentProviderCommand,
    securityToken: string,
    options?: {
      merchantDefineData?: NiubizDataMap;
      dataMap?: NiubizDataMap;
    },
  ): NiubizSessionRequest {
    this.assertConfigured();
    const merchantDefineData =
      options?.merchantDefineData ?? this.buildMerchantDefineData(command);
    const dataMap = options?.dataMap ?? this.buildCardholderDataMap(command);
    this.assertSessionDataComplete(merchantDefineData, dataMap);
    return this.sessionService.buildRequest(this.config, {
      merchantId: this.config.merchantId!,
      securityToken,
      amount: command.amount,
      clientIp: command.customer.clientIp,
      merchantDefineData,
      dataMap,
    });
  }

  buildCheckoutConfig(
    command: PaymentProviderCommand,
    sessionToken: string,
  ): NiubizCheckoutConfig {
    this.assertConfigured();
    return {
      sessionToken,
      merchantId: this.config.merchantId!,
      purchaseNumber: String(command.paymentId),
      amount: command.amount,
      currency: command.currency,
      checkoutUrl: this.config.checkoutUrl!,
      callbackUrl: this.withPurchaseNumberInCallback(
        this.config.callbackUrl!,
        String(command.paymentId),
      ),
      timeoutUrl: this.config.timeoutUrl!,
      expirationMinutes: this.clampedSessionExpirationMinutes(),
      merchantName: this.config.merchantName!,
      formButtonColor: this.config.formButtonColor!,
      ...(this.config.merchantLogoUrl
        ? { merchantLogoUrl: this.config.merchantLogoUrl }
        : {}),
      ...(command.customer.email
        ? { cardholderEmail: command.customer.email }
        : {}),
      ...(command.customer.firstName
        ? { cardholderName: command.customer.firstName }
        : {}),
      ...(command.customer.lastName
        ? { cardholderLastName: command.customer.lastName }
        : {}),
    };
  }

  buildAuthorizationRequest(
    command: PaymentProviderCommand,
    securityToken: string,
    tokenId: string,
    dataMap?: NiubizDataMap,
  ) {
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

  mapAuthorizationResponse(
    response: NiubizAuthorizationResponse,
    paymentChannel?: string,
    httpStatus = 200,
  ): NiubizMappedAuthorizationResponse {
    return this.responseMapper.mapAuthorization(
      response,
      paymentChannel,
      httpStatus,
    );
  }

  async authorize(
    command: NiubizAuthorizationCommand,
    transactionToken: string,
    paymentChannel?: string,
  ): Promise<{ result: NiubizMappedAuthorizationResponse; status: number }> {
    this.assertAuthorizationConfigured();
    const security = await this.securityService.getAccessToken(this.config);
    const authorization = await this.authorizationService.authorize(
      this.config,
      {
        merchantId: this.config.merchantId!,
        securityToken: security.accessToken,
        amount: command.amount,
        currency: command.currency,
        purchaseNumber: String(command.paymentId),
        tokenId: transactionToken,
        captureType: "manual",
        countable: true,
        dataMap: this.buildAuthorizationDataMap(),
      },
    );
    return {
      result: this.mapAuthorizationResponse(
        authorization.response,
        paymentChannel,
        authorization.status,
      ),
      status: authorization.status,
    };
  }

  async initiate(
    command: PaymentProviderCommand,
  ): Promise<PaymentGatewayResult> {
    this.assertReady();
    const capture = isSessionDiagnosticsEnabled() || isCertPauseEnabled();
    const stages: NiubizStageTrace[] = [];

    const security = await this.securityService.getAccessToken(this.config);
    stages.push({ stage: "SECURITY", result: "SUCCESS", httpStatus: security.status });

    const merchantDefineData = this.buildMerchantDefineData(command);
    const dataMap = this.buildCardholderDataMap(command);
    this.assertSessionDataComplete(merchantDefineData, dataMap);
    const { session, status, request, responseBody, correlationId } = await this.sessionService.createSession(this.config, {
      merchantId: this.config.merchantId!,
      securityToken: security.accessToken,
      amount: command.amount,
      clientIp: command.customer.clientIp,
      merchantDefineData,
      dataMap,
    });
    stages.push({ stage: "SESSION", result: "SUCCESS", httpStatus: status });

    const checkout = this.buildCheckoutConfig(command, session.sessionKey);
    stages.push({ stage: "CHECKOUT", result: "SUCCESS" });
    stages.push({ stage: "AUTHORIZATION", result: "NOT_EXECUTED", message: "La autorización se ejecuta en el flujo posterior al Checkout." });

    const diagnostic = capture
      ? buildSessionDiagnostic(request, status, responseBody, correlationId, stages)
      : undefined;
    if (diagnostic && isCertPauseEnabled()) {
      await persistSessionEvidence(diagnostic);
    }

    return {
      status: "PENDING",
      checkout,
      ...(diagnostic ? { diagnostic } : {}),
    };
  }

  private get envPrefix(): string {
    return this.environment === "TEST"
      ? "NIUBIZ_TEST"
      : this.environment === "PRODUCTION"
        ? "NIUBIZ_PROD"
        : "NIUBIZ";
  }

  private assertConfigured(): void {
    const prefix = this.envPrefix;
    const missing = [
      !this.config.merchantId && `${prefix}_MERCHANT_ID`,
      !this.config.username && `${prefix}_USERNAME`,
      !this.config.password && `${prefix}_PASSWORD`,
      !this.config.securityUrl && `${prefix}_SECURITY_URL`,
      !this.config.sessionUrl && `${prefix}_SESSION_URL`,
      !this.config.authorizationUrl && `${prefix}_AUTHORIZATION_URL`,
      !this.config.checkoutUrl && `${prefix}_CHECKOUT_URL`,
      !this.config.callbackUrl && `${prefix}_CALLBACK_URL`,
      !this.config.timeoutUrl && `${prefix}_TIMEOUT_URL`,
      !this.config.merchantName && `${prefix}_MERCHANT_NAME`,
      !this.config.formButtonColor && `${prefix}_FORM_BUTTON_COLOR`,
      this.environment !== "TEST" && this.environment !== "PRODUCTION" &&
        "PAYMENT_ENVIRONMENT=TEST|PRODUCTION",
    ].filter(Boolean);

    if (missing.length > 0) {
      throw new NiubizProviderConfigurationError(
        `Niubiz ${this.environment ?? "TEST"} no está configurado. Faltan: ${missing.join(", ")}.`,
      );
    }
  }

  private assertAuthorizationConfigured(): void {
    this.assertConfigured();
    const prefix = this.envPrefix;
    const dataMap = this.config.authorizationDataMap;
    const missing = [
      !dataMap?.urlAddress && `${prefix}_URL_ADDRESS`,
      !dataMap?.serviceLocationCityName && `${prefix}_SERVICE_LOCATION_CITY_NAME`,
      !dataMap?.serviceLocationCountrySubdivisionCode &&
        `${prefix}_SERVICE_LOCATION_COUNTRY_SUBDIVISION_CODE`,
      !dataMap?.serviceLocationCountryCode &&
        `${prefix}_SERVICE_LOCATION_COUNTRY_CODE`,
      !dataMap?.serviceLocationPostalCode &&
        `${prefix}_SERVICE_LOCATION_POSTAL_CODE`,
    ].filter(Boolean);
    if (missing.length > 0)
      throw new NiubizProviderConfigurationError(
        `Niubiz Authorization no está configurado. Faltan: ${missing.join(", ")}.`,
      );
  }

  private buildAuthorizationDataMap(): NiubizDataMap {
    const dataMap = this.config.authorizationDataMap!;
    return {
      urlAddress: dataMap.urlAddress!,
      serviceLocationCityName: dataMap.serviceLocationCityName!,
      serviceLocationCountrySubdivisionCode:
        dataMap.serviceLocationCountrySubdivisionCode!,
      serviceLocationCountryCode: dataMap.serviceLocationCountryCode!,
      serviceLocationPostalCode: dataMap.serviceLocationPostalCode!,
    };
  }

  private buildMerchantDefineData(
    command: PaymentProviderCommand,
  ): NiubizDataMap {
    const data: NiubizDataMap = {};
    if (command.customer.email) data.MDD4 = command.customer.email;
    if (command.customer.phone) data.MDD31 = command.customer.phone;
    const customerId = command.customer.personId
      ? String(command.customer.personId)
      : command.customer.documentNumber;
    if (customerId) data.MDD32 = customerId;
    if (command.customer.documentNumber)
      data.MDD34 = command.customer.documentNumber;
    const registeredState: RegisteredCustomerState = command.customer.personId
      ? "Registrado"
      : "Invitado";
    data.MDD75 = registeredState;
    if (registeredState === "Invitado") data.MDD77 = 1;
    return data;
  }

  private buildCardholderDataMap(
    command: PaymentProviderCommand,
  ): NiubizDataMap {
    const fallback = this.config.cardholderFallbackEnabled
      ? this.config.cardholderDataMap ?? {}
      : {};
    const address = command.customer.address;
    const pick = (
      real: string | null | undefined,
      institutional: string | undefined,
    ): string | undefined => {
      const value = real?.trim() || institutional?.trim();
      return value || undefined;
    };
    const dataMap: NiubizDataMap = {};
    const phone = pick(command.customer.phone, fallback.phone);
    if (phone) dataMap.cardholderPhoneNumber = phone;
    const street = pick(address?.street, fallback.address);
    if (street) dataMap.cardholderAddress = street;
    const city = pick(address?.city, fallback.city);
    if (city) dataMap.cardholderCity = city;
    const state = pick(address?.state, fallback.state);
    if (state) dataMap.cardholderState = state;
    const country = pick(address?.countryCode, fallback.country);
    if (country) dataMap.cardholderCountry = country;
    const postalCode = pick(address?.postalCode, fallback.postalCode);
    if (postalCode) dataMap.cardholderPostalCode = postalCode;
    return dataMap;
  }

  private assertSessionDataComplete(
    merchantDefineData: NiubizDataMap,
    dataMap: NiubizDataMap,
  ): void {
    const missing: string[] = [];
    if (!merchantDefineData.MDD4) missing.push("MDD4");
    if (!merchantDefineData.MDD32) missing.push("MDD32");
    const registeredState = merchantDefineData.MDD75;
    if (
      !REGISTERED_CUSTOMER_STATES.includes(
        registeredState as RegisteredCustomerState,
      )
    )
      missing.push("MDD75");
    if (registeredState === "Invitado" && merchantDefineData.MDD77 !== 1)
      missing.push("MDD77");
    const mdd77 = merchantDefineData.MDD77;
    if (mdd77 !== undefined && mdd77 !== null) {
      const numeric = typeof mdd77 === "number" ? mdd77 : Number(mdd77);
      if (!Number.isInteger(numeric) || numeric <= 0) missing.push("MDD77");
    }
    for (const field of CARDHOLDER_DATA_MAP_FIELDS) {
      if (!dataMap[field]) missing.push(field);
    }
    if (missing.length > 0) {
      throw new NiubizProviderConfigurationError(
        `Sesión Niubiz incompleta. Faltan: ${missing.join(", ")}.`,
      );
    }
  }

  private clampedSessionExpirationMinutes(): number {
    const configured = this.config.sessionExpirationMinutes ?? 5;
    return Math.min(
      Math.max(configured, MIN_SESSION_EXPIRATION_MINUTES),
      MAX_SESSION_EXPIRATION_MINUTES,
    );
  }

  /**
   * Concatena el ID de transacción (purchaseNumber) al callback URL para que el
   * campo `action` del Checkout de Niubiz lo muestre, como exige la certificación.
   * Se usa un parámetro de query legible (`purchaseNumber`) y no se sustituye la
   * referencia firmada `payment_callback` que añade PaymentService después.
   */
  private withPurchaseNumberInCallback(
    callbackUrl: string,
    purchaseNumber: string,
  ): string {
    const url = new URL(callbackUrl);
    url.searchParams.set("purchaseNumber", purchaseNumber);
    return url.toString();
  }
}
