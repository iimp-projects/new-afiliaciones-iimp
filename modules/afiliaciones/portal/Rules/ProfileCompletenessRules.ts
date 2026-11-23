export const PERU_COUNTRY_ID = 1;

export type ProfileCompletenessSection = "identity" | "contact" | "address";

export interface ProfileCompletenessSource {
  firstName?: string | null;
  paternalLastName?: string | null;
  documentType?: string | null;
  documentNumber?: string | null;
  birthDate?: string | null;
  email?: string | null;
  phone?: string | null;
  address?:
    | {
        countryId?: number | null;
        street?: string | null;
        districtId?: number | null;
        postalCode?: string | null;
        foreignRegion?: string | null;
        foreignCity?: string | null;
      }
    | null;
}

export interface MissingProfileField {
  field: string;
  label: string;
  section: ProfileCompletenessSection;
}

export interface ProfileCompletenessDtoLike {
  identity: {
    firstName?: string | null;
    paternalLastName?: string | null;
    documentType?: string | null;
    documentNumber?: string | null;
    birthDate?: string | null;
  };
  contact: {
    primaryEmail?: string | null;
    primaryPhone?: string | null;
  };
  address: {
    countryId?: number | null;
    street?: string | null;
    districtId?: number | null;
    postalCode?: string | null;
    foreignRegion?: string | null;
    foreignCity?: string | null;
  };
}

export function toProfileCompletenessSource(
  profile: ProfileCompletenessDtoLike,
): ProfileCompletenessSource {
  return {
    firstName: profile.identity.firstName,
    paternalLastName: profile.identity.paternalLastName,
    documentType: profile.identity.documentType,
    documentNumber: profile.identity.documentNumber,
    birthDate: profile.identity.birthDate,
    email: profile.contact.primaryEmail,
    phone: profile.contact.primaryPhone,
    address: {
      countryId: profile.address.countryId,
      street: profile.address.street,
      districtId: profile.address.districtId,
      postalCode: profile.address.postalCode,
      foreignRegion: profile.address.foreignRegion,
      foreignCity: profile.address.foreignCity,
    },
  };
}

const hasText = (value: string | null | undefined): boolean =>
  Boolean(value?.trim());

/**
 * Datos mínimos para que el asociado pueda operar (perfil, carnet, pagos y
 * trámites). En Perú se exige distrito; en el extranjero, región y ciudad.
 * El código postal es opcional en todos los casos.
 */
export function findMissingProfileData(
  source: ProfileCompletenessSource,
): MissingProfileField[] {
  const missing: MissingProfileField[] = [];
  const add = (field: string, label: string, section: ProfileCompletenessSection) =>
    missing.push({ field, label, section });

  if (!hasText(source.firstName)) add("firstName", "nombres", "identity");
  if (!hasText(source.paternalLastName)) add("paternalLastName", "apellido paterno", "identity");
  if (!hasText(source.documentType)) add("documentType", "tipo de documento", "identity");
  if (!hasText(source.documentNumber)) add("documentNumber", "número de documento", "identity");
  if (!hasText(source.birthDate)) add("birthDate", "fecha de nacimiento", "identity");

  if (!hasText(source.email)) add("email", "correo principal", "contact");
  if (!hasText(source.phone)) add("phone", "celular", "contact");

  const address = source.address;
  const countryId = address?.countryId ?? null;
  if (!countryId) {
    add("countryId", "país", "address");
  } else if (countryId === PERU_COUNTRY_ID) {
    if (!hasText(address?.street)) add("street", "dirección", "address");
    if (!address?.districtId) add("districtId", "distrito", "address");
  } else {
    if (!hasText(address?.street)) add("street", "dirección", "address");
    if (!hasText(address?.foreignRegion)) add("foreignRegion", "región/estado", "address");
    if (!hasText(address?.foreignCity)) add("foreignCity", "ciudad", "address");
  }

  return missing;
}
