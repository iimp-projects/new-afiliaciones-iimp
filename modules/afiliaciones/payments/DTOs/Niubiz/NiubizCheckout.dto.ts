export interface NiubizCheckoutConfig {
  sessionToken: string;
  merchantId: string;
  purchaseNumber: string;
  amount: number;
  currency: "PEN";
  checkoutUrl: string;
  callbackUrl: string;
  cardholderEmail?: string;
  cardholderName?: string;
  cardholderLastName?: string;
  expirationMinutes: number;
  timeoutUrl: string;
  merchantName: string;
  formButtonColor: string;
  merchantLogoUrl?: string;
}
