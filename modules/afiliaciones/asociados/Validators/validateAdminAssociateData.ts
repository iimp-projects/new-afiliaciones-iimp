import { isValidEmploymentAddress } from "../../postulacion/Validators/EmploymentInformationValidator";
import type { AdminAssociateDataInput } from "./AdminAssociateDataSchema";

const LETTERS = /^[A-Za-zÁÉÍÓÚáéíóúÑñ\s]+$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ALPHANUMERIC = /^[A-Za-z0-9]+$/;
const PLACEHOLDERS = new Set(["-", ".", "..", "...", "N/A", "NA", "S/D", "SIN DATO", "SIN DIRECCION", "NO REGISTRA"]);

export type AdminAssociateDataErrors = Record<string, string>;

const normalized = (value?: string | null) => (value ?? "").trim().replace(/\s+/g, " ");
const digits = (value?: string | null) => (value ?? "").replace(/\D/g, "");

function meaningful(value: string | null | undefined, minimum: number, requireLetter = false): boolean {
  const text = normalized(value);
  if (!text) return false;
  const alphanumeric = text.match(/[A-Za-zÁÉÍÓÚáéíóúÑñ0-9]/g)?.length ?? 0;
  const letters = /[A-Za-zÁÉÍÓÚáéíóúÑñ]/.test(text);
  const symbols = text.match(/[^A-Za-zÁÉÍÓÚáéíóúÑñ0-9\s]/g)?.length ?? 0;
  return !PLACEHOLDERS.has(text.toUpperCase()) && text.length >= minimum && alphanumeric > 0 && (!requireLetter || letters) && symbols / text.length <= 0.45;
}

function ageFrom(dateText: string): number {
  const birthDate = new Date(dateText);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const month = today.getMonth() - birthDate.getMonth();
  if (month < 0 || (month === 0 && today.getDate() < birthDate.getDate())) age -= 1;
  return age;
}

/**
 * Validaciones equivalentes a las de postulación para la ficha administrativa.
 * Devuelve mensajes por campo para mostrarlos en el modal.
 */
export function validateAdminAssociateData(
  input: AdminAssociateDataInput,
  options: { isStudent: boolean; currentYear?: number },
): AdminAssociateDataErrors {
  const errors: AdminAssociateDataErrors = {};
  const set = (field: string, message: string) => {
    if (!errors[field]) errors[field] = message;
  };
  const required = (field: string, value: unknown, message: string) => {
    const text = typeof value === "string" ? value.trim() : value;
    if (text === null || text === undefined || text === "") {
      set(field, message);
      return false;
    }
    return true;
  };

  const { identity, contact, address, academic, employment } = input;
  const currentYear = options.currentYear ?? new Date().getFullYear();

  for (const [field, value, label] of [
    ["identity.firstName", identity.firstName, "nombres"],
    ["identity.paternalLastName", identity.paternalLastName, "apellido paterno"],
    ["identity.maternalLastName", identity.maternalLastName, "apellido materno"],
  ] as const) {
    if (!required(field, value, `El ${label} es obligatorio.`)) continue;
    const text = String(value ?? "").trim();
    if (text.length < 2) set(field, "Debe tener al menos 2 caracteres.");
    else if (text.length > 100) set(field, "Máximo 100 caracteres permitidos.");
    else if (!LETTERS.test(value ?? "")) set(field, "Solo se permiten letras, tildes y espacios.");
  }

  if (!required("identity.documentNumber", identity.documentNumber, "Ingrese el número de documento.")) {
    // sin documento no se valida longitud
  } else if (identity.documentType === "DNI") {
    if (!/^\d+$/.test(identity.documentNumber)) set("identity.documentNumber", "El DNI solo debe contener números.");
    else if (identity.documentNumber.length !== 8) set("identity.documentNumber", "El DNI debe tener exactamente 8 dígitos.");
  } else if (identity.documentType === "CE") {
    if (identity.documentNumber.length < 9 || identity.documentNumber.length > 12) set("identity.documentNumber", "El CE debe tener entre 9 y 12 caracteres.");
    else if (!ALPHANUMERIC.test(identity.documentNumber)) set("identity.documentNumber", "El CE solo permite letras y números.");
  } else if (identity.documentType === "PASSPORT") {
    if (identity.documentNumber.length < 6 || identity.documentNumber.length > 12) set("identity.documentNumber", "El pasaporte debe tener entre 6 y 12 caracteres.");
    else if (!ALPHANUMERIC.test(identity.documentNumber)) set("identity.documentNumber", "El pasaporte solo permite letras y números.");
  }

  if (!identity.birthDate) {
    set("identity.birthDate", "La fecha de nacimiento es obligatoria.");
  } else {
    const date = new Date(`${identity.birthDate}T00:00:00`);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (date > today) set("identity.birthDate", "La fecha no puede ser futura.");
    else {
      const age = ageFrom(identity.birthDate);
      if (age < 18 || age > 100) set("identity.birthDate", "Debe tener entre 18 y 100 años.");
    }
  }

  if (!identity.gender) set("identity.gender", "Seleccione el género.");
  else if (!["MALE", "FEMALE"].includes(identity.gender)) set("identity.gender", "Género seleccionado inválido.");

  if (!required("contact.phone", contact.phone, "El celular es obligatorio.")) {
    // sin celular no se valida formato
  } else if (!/^\d+$/.test(contact.phone)) set("contact.phone", "El celular solo permite números.");
  else if (contact.phone.length !== 9) set("contact.phone", "El celular debe tener exactamente 9 dígitos.");

  const primaryEmail = contact.primaryEmail?.trim() ?? "";
  if (!required("contact.primaryEmail", primaryEmail, "El correo principal es obligatorio.")) {
    // sin correo no se valida formato
  } else if (!EMAIL.test(primaryEmail)) set("contact.primaryEmail", "Ingrese un correo electrónico válido.");
  else if (primaryEmail.length > 254) set("contact.primaryEmail", "El correo es demasiado largo.");

  if (contact.secondaryEmail && contact.secondaryEmail.trim()) {
    if (!EMAIL.test(contact.secondaryEmail.trim())) set("contact.secondaryEmail", "Ingrese un correo secundario válido.");
    else if (contact.secondaryEmail.trim().length > 254) set("contact.secondaryEmail", "El correo secundario es demasiado largo.");
  }

  if (!address.countryId) set("address.countryId", "Seleccione un país.");
  if (!required("address.street", address.street, "Ingrese una dirección.")) {
    // sin dirección no se valida longitud
  } else if (address.street.trim().length > 255) set("address.street", "Máximo 255 caracteres.");
  if (address.reference && address.reference.length > 255) set("address.reference", "Máximo 255 caracteres.");
  if (address.countryId === 1) {
    if (!address.districtId) set("address.districtId", "Seleccione un distrito.");
  } else if (address.countryId) {
    if (!normalized(address.foreignRegion)) set("address.foreignRegion", "Ingrese la región o estado.");
    if (!normalized(address.foreignCity)) set("address.foreignCity", "Ingrese la ciudad.");
  }

  if (academic) {
    if (!academic.universityId) set("academic.universityId", "Seleccione una universidad o instituto.");
    if (!academic.specialtyId) set("academic.specialtyId", "Seleccione una especialidad.");
    if (!options.isStudent && !academic.degreeId) set("academic.degreeId", "Seleccione un grado académico.");
    if (!options.isStudent) {
      if (!normalized(academic.degreeTitle)) set("academic.degreeTitle", "El título o grado es obligatorio.");
      else if (normalized(academic.degreeTitle).length < 5) set("academic.degreeTitle", "Mínimo 5 caracteres.");
      else if (normalized(academic.degreeTitle).length > 200) set("academic.degreeTitle", "Máximo 200 caracteres.");
      if (!academic.graduationYear) set("academic.graduationYear", "El año de egreso es obligatorio.");
    }
    if (academic.graduationYear !== null && (academic.graduationYear < 1950 || academic.graduationYear > currentYear + 7)) {
      set("academic.graduationYear", "El año de egreso no es válido.");
    }
    if (options.isStudent) {
      const cycle = normalized(academic.termOrSemester);
      if (!cycle) set("academic.termOrSemester", "Seleccione el ciclo que está cursando.");
      else if (!/^\d+$/.test(cycle) || ![7, 8, 9, 10].includes(Number(cycle))) set("academic.termOrSemester", "El ciclo debe ser 7, 8, 9 o 10.");
    }
    const association = normalized(academic.professionalAssociation);
    const license = normalized(academic.licenseNumber);
    if (association) {
      if (association.length < 3) set("academic.professionalAssociation", "Mínimo 3 caracteres.");
      else if (association.length > 100) set("academic.professionalAssociation", "Máximo 100 caracteres.");
      if (!license) set("academic.licenseNumber", "Ingrese el número de colegiatura si especifica un colegio profesional.");
    }
    if (license) {
      if (!/^\d+$/.test(license)) set("academic.licenseNumber", "Solo se permiten números.");
      else if (license.length < 4 || license.length > 15) set("academic.licenseNumber", "Debe tener entre 4 y 15 dígitos.");
    }
  }

  if (employment) {
    if (!employment.companyId) set("employment.companyId", "Seleccione la empresa.");
    if (!employment.positionId) set("employment.positionId", "Seleccione el cargo.");
    if (employment.area && !meaningful(employment.area, 2)) set("employment.area", "Ingrese un área o departamento válido.");
    if (employment.area && employment.area.length > 150) set("employment.area", "El área no puede superar los 150 caracteres.");

    const workPhone = employment.workPhone?.trim() ?? "";
    if (!required("employment.workPhone", workPhone, "El teléfono es obligatorio.")) {
      // sin teléfono no se valida formato
    } else {
      const phoneDigits = digits(workPhone);
      if (!/^[0-9+\s\-()]{7,20}$/.test(workPhone)) set("employment.workPhone", "El teléfono no es válido.");
      else if (phoneDigits.length < 7 || phoneDigits.length > 15 || /^0+$/.test(phoneDigits)) set("employment.workPhone", "Ingrese un teléfono válido.");
    }

    const workEmail = employment.workEmail?.trim() ?? "";
    if (!required("employment.workEmail", workEmail, "El correo profesional es obligatorio.")) {
      // sin correo no se valida formato
    } else if (!EMAIL.test(workEmail)) set("employment.workEmail", "El correo corporativo no es válido.");

    if (employment.workExtension && employment.workExtension.trim()) {
      if (employment.workExtension.trim().length > 10) set("employment.workExtension", "El anexo no puede superar los 10 caracteres.");
      else if (!/^\d+$/.test(employment.workExtension.trim())) set("employment.workExtension", "El anexo debe contener únicamente números.");
    }

    const workingAddress = employment.workingAddress?.trim() ?? "";
    if (!required("employment.workingAddress", workingAddress, "La dirección laboral es obligatoria.")) {
      // sin dirección no se valida formato
    } else if (workingAddress.length > 250) set("employment.workingAddress", "La dirección no puede superar los 250 caracteres.");
    else if (!isValidEmploymentAddress(workingAddress)) set("employment.workingAddress", "Ingrese una dirección con información válida.");
  }

  return errors;
}
