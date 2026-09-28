export type PaymentMethodCategory = "CARD" | "WALLET" | "BANK_TRANSFER" | "CASH" | "POINTS" | "UNKNOWN";

const METHOD_LABELS: Record<PaymentMethodCategory, string> = {
  CARD: "Tarjeta",
  WALLET: "Billetera digital",
  BANK_TRANSFER: "Transferencia bancaria",
  CASH: "Efectivo",
  POINTS: "Puntos / Millas",
  UNKNOWN: "No identificado",
};

/**
 * Known wallet brands (allow-list). Adding a new wallet only requires an entry
 * here; arbitrary or unknown brands are never rendered verbatim and instead
 * fall back to the category label.
 */
const WALLET_BRAND_LABELS: Record<string, string> = {
  YAPE: "Yape",
  PLIN: "Plin",
};

/**
 * Returns a user-facing payment method label from the normalized classification.
 * A known wallet brand wins over the generic category; unknown brands are not
 * rendered. Consumers must never derive the method from gateway technical
 * metadata (BRAND/CARD_TYPE/CARD/channel).
 */
export function paymentMethodLabel(method?: string | null, brand?: string | null): string {
  const normalizedBrand = brand?.trim().toUpperCase();
  if (method === "WALLET" && normalizedBrand && WALLET_BRAND_LABELS[normalizedBrand]) {
    return WALLET_BRAND_LABELS[normalizedBrand];
  }
  return METHOD_LABELS[(method as PaymentMethodCategory)] ?? METHOD_LABELS.UNKNOWN;
}
