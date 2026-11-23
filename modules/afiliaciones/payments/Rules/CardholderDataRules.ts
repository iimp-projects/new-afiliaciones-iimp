export type CardholderDataField =
  | "email"
  | "phone"
  | "identityDocument"
  | "address"
  | "city"
  | "state"
  | "country";

export interface CardholderDataSource {
  email: string | null | undefined;
  phone: string | null | undefined;
  personId: number | null | undefined;
  documentNumber: string | null | undefined;
  address:
    | {
        street: string;
        city: string;
        state: string;
        countryCode: string;
        postalCode: string | null;
      }
    | null
    | undefined;
}

const CARDHOLDER_DATA_LABELS: Record<CardholderDataField, string> = {
  email: "correo electrónico",
  phone: "celular",
  identityDocument: "documento de identidad",
  address: "dirección",
  city: "distrito/ciudad",
  state: "departamento",
  country: "país",
};

const hasText = (value: string | null | undefined): boolean =>
  Boolean(value?.trim());

/**
 * Campos obligatorios para iniciar un pago Niubiz: los datos del titular que
 * exige el dataMap (código postal opcional), más correo y documento. El
 * fallback institucional no sustituye este requisito cuando la regla está activa.
 */
export function findMissingCardholderData(
  source: CardholderDataSource,
): Array<{ field: CardholderDataField; label: string }> {
  const address = source.address;
  const present: Record<CardholderDataField, boolean> = {
    email: hasText(source.email),
    phone: hasText(source.phone),
    identityDocument:
      Boolean(source.personId) || hasText(source.documentNumber),
    address: hasText(address?.street),
    city: hasText(address?.city),
    state: hasText(address?.state),
    country: hasText(address?.countryCode),
  };

  return (Object.keys(present) as CardholderDataField[])
    .filter((field) => !present[field])
    .map((field) => ({ field, label: CARDHOLDER_DATA_LABELS[field] }));
}
