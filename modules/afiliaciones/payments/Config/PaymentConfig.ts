export type PaymentProviderName = "MOCK" | "NIUBIZ";
export type MockPaymentScenario = "PAID" | "FAILED" | "PENDING";
export type PaymentEnvironment = "TEST" | "PRODUCTION";

export interface NiubizTestConfig {
  merchantId?: string;
  username?: string;
  password?: string;
  securityUrl?: string;
  sessionUrl?: string;
  authorizationUrl?: string;
  checkoutUrl?: string;
  callbackUrl?: string;
  timeoutUrl?: string;
  merchantName?: string;
  formButtonColor?: string;
  merchantLogoUrl?: string;
  sessionExpirationMinutes?: number;
  authorizationDataMap?: {
    urlAddress?: string;
    serviceLocationCityName?: string;
    serviceLocationCountrySubdivisionCode?: string;
    serviceLocationCountryCode?: string;
    serviceLocationPostalCode?: string;
  };
}

const provider = (process.env.PAYMENT_PROVIDER || "MOCK").toUpperCase();
const configuredEnvironment = (process.env.PAYMENT_ENVIRONMENT || "").toUpperCase();
const mockScenario = (process.env.PAYMENT_MOCK_SCENARIO || "PAID").toUpperCase();
const configuredAmount = Number(process.env.PAYMENT_TEST_AMOUNT || "300.00");
const environment = configuredEnvironment === "TEST" || configuredEnvironment === "PRODUCTION"
  ? configuredEnvironment
  : undefined;

if (environment === "PRODUCTION" && process.env.NODE_ENV !== "production") {
  throw new Error("PAYMENT_ENVIRONMENT=PRODUCTION solo puede usarse con NODE_ENV=production.");
}

if (!Number.isFinite(configuredAmount) || configuredAmount <= 0) {
  throw new Error("PAYMENT_TEST_AMOUNT debe ser un monto positivo.");
}

export const paymentConfig = {
  provider: provider === "NIUBIZ" ? "NIUBIZ" : "MOCK",
  environment: environment as PaymentEnvironment | undefined,
  currency: "PEN" as const,
  testAmount: configuredAmount,
  authorizationTtlSeconds: Number(process.env.PAYMENT_AUTH_TTL_SECONDS || "600"),
  mockScenario: ["PAID", "FAILED", "PENDING"].includes(mockScenario)
    ? (mockScenario as MockPaymentScenario)
    : "PAID",
  niubiz: {
    merchantId: environment === "TEST" ? process.env.NIUBIZ_TEST_MERCHANT_ID : environment === "PRODUCTION" ? process.env.NIUBIZ_PROD_MERCHANT_ID : undefined,
    username: environment === "TEST" ? process.env.NIUBIZ_TEST_USERNAME : environment === "PRODUCTION" ? process.env.NIUBIZ_PROD_USERNAME : undefined,
    password: environment === "TEST" ? process.env.NIUBIZ_TEST_PASSWORD : environment === "PRODUCTION" ? process.env.NIUBIZ_PROD_PASSWORD : undefined,
    securityUrl: environment === "TEST" ? process.env.NIUBIZ_TEST_SECURITY_URL : environment === "PRODUCTION" ? process.env.NIUBIZ_PROD_SECURITY_URL : undefined,
    sessionUrl: environment === "TEST" ? process.env.NIUBIZ_TEST_SESSION_URL : environment === "PRODUCTION" ? process.env.NIUBIZ_PROD_SESSION_URL : undefined,
    authorizationUrl: environment === "TEST" ? process.env.NIUBIZ_TEST_AUTHORIZATION_URL : environment === "PRODUCTION" ? process.env.NIUBIZ_PROD_AUTHORIZATION_URL : undefined,
    checkoutUrl: environment === "TEST" ? process.env.NIUBIZ_TEST_CHECKOUT_URL : environment === "PRODUCTION" ? process.env.NIUBIZ_PROD_CHECKOUT_URL : undefined,
    callbackUrl: environment === "TEST" ? process.env.NIUBIZ_TEST_CALLBACK_URL : environment === "PRODUCTION" ? process.env.NIUBIZ_PROD_CALLBACK_URL : undefined,
    timeoutUrl: environment === "TEST" ? process.env.NIUBIZ_TEST_TIMEOUT_URL : environment === "PRODUCTION" ? process.env.NIUBIZ_PROD_TIMEOUT_URL : undefined,
    merchantName: environment === "TEST" ? process.env.NIUBIZ_TEST_MERCHANT_NAME : environment === "PRODUCTION" ? process.env.NIUBIZ_PROD_MERCHANT_NAME : undefined,
    formButtonColor: environment === "TEST" ? process.env.NIUBIZ_TEST_FORM_BUTTON_COLOR : environment === "PRODUCTION" ? process.env.NIUBIZ_PROD_FORM_BUTTON_COLOR : undefined,
    merchantLogoUrl: environment === "TEST" ? process.env.NIUBIZ_TEST_LOGO_URL : environment === "PRODUCTION" ? process.env.NIUBIZ_PROD_LOGO_URL : undefined,
    sessionExpirationMinutes: Number(environment === "TEST" ? process.env.NIUBIZ_TEST_SESSION_EXPIRATION_MINUTES || "5" : environment === "PRODUCTION" ? process.env.NIUBIZ_PROD_SESSION_EXPIRATION_MINUTES || "5" : "5"),
    authorizationDataMap: {
      urlAddress: environment === "TEST" ? process.env.NIUBIZ_TEST_URL_ADDRESS : environment === "PRODUCTION" ? process.env.NIUBIZ_PROD_URL_ADDRESS : undefined,
      serviceLocationCityName: environment === "TEST" ? process.env.NIUBIZ_TEST_SERVICE_LOCATION_CITY_NAME : environment === "PRODUCTION" ? process.env.NIUBIZ_PROD_SERVICE_LOCATION_CITY_NAME : undefined,
      serviceLocationCountrySubdivisionCode: environment === "TEST" ? process.env.NIUBIZ_TEST_SERVICE_LOCATION_COUNTRY_SUBDIVISION_CODE : environment === "PRODUCTION" ? process.env.NIUBIZ_PROD_SERVICE_LOCATION_COUNTRY_SUBDIVISION_CODE : undefined,
      serviceLocationCountryCode: environment === "TEST" ? process.env.NIUBIZ_TEST_SERVICE_LOCATION_COUNTRY_CODE : environment === "PRODUCTION" ? process.env.NIUBIZ_PROD_SERVICE_LOCATION_COUNTRY_CODE : undefined,
      serviceLocationPostalCode: environment === "TEST" ? process.env.NIUBIZ_TEST_SERVICE_LOCATION_POSTAL_CODE : environment === "PRODUCTION" ? process.env.NIUBIZ_PROD_SERVICE_LOCATION_POSTAL_CODE : undefined,
    },
  } satisfies NiubizTestConfig,
} as const;
