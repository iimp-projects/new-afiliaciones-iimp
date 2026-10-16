/**
 * Clasificación de códigos institucionales SIE para asociados activos (A) y
 * estudiantes (E).
 *
 * Es lógica pura y determinista: no accede a Prisma ni a SIE. Decide, para cada
 * registro del listado SIE, si puede vincularse localmente un código
 * institucional auténtico a una persona ya existente, o si debe omitirse o
 * marcarse como conflicto para revisión manual.
 *
 * Reglas (sin escribir a SIE ni crear/modificar personas o contactos):
 *  - solo códigos no vacíos;
 *  - solo personas locales ya existentes (match por tipo+número de documento);
 *  - coincidencia de nombres normalizados;
 *  - el código no debe estar ya vinculado a otra persona;
 *  - la persona no debe estar ya vinculada a un código distinto;
 *  - idempotente: una vinculación previa igual se reporta como UNCHANGED.
 */

export type SyncPerson = {
  id: number;
  firstName: string;
  paternalLastName: string;
  maternalLastName: string | null;
};

export type SyncExistingRecord = {
  externalCode: string;
  personId: number | null;
  linkStatus: "LINKED" | "UNLINKED" | "CONFLICT";
};

export type SyncRecord = {
  documentType: string;
  documentNumber: string;
  externalCode: string;
  nombres?: string | null;
  apellidoPaterno?: string | null;
  apellidoMaterno?: string | null;
};

export type ActiveCodeDecision =
  | { kind: "LINK"; externalCode: string; personId: number }
  | { kind: "UNCHANGED"; externalCode: string; personId: number }
  | { kind: "SKIP_EMPTY_CODE" }
  | { kind: "SKIP_NOT_LOCAL"; documentType: string; documentNumber: string }
  | { kind: "CONFLICT_NAMES"; externalCode: string; personId: number }
  | { kind: "CONFLICT_CODE_OWNED_BY_OTHER"; externalCode: string; personId: number; ownedByPersonId: number }
  | { kind: "CONFLICT_PERSON_ALREADY_LINKED"; externalCode: string; personId: number; existingCode: string };

export function normalizeName(value: string | null | undefined): string {
  if (!value) return "";
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

export function namesMatch(
  record: Pick<SyncRecord, "nombres" | "apellidoPaterno" | "apellidoMaterno">,
  person: Pick<SyncPerson, "firstName" | "paternalLastName" | "maternalLastName">,
): boolean {
  if (record.nombres && person.firstName && normalizeName(record.nombres) !== normalizeName(person.firstName)) return false;
  if (record.apellidoPaterno && person.paternalLastName && normalizeName(record.apellidoPaterno) !== normalizeName(person.paternalLastName)) return false;
  if (record.apellidoMaterno && person.maternalLastName && normalizeName(record.apellidoMaterno) !== normalizeName(person.maternalLastName)) return false;
  return true;
}

export function classifyActiveCodeSync(
  record: SyncRecord,
  existingPerson: SyncPerson | null,
  existingRecordByCode: SyncExistingRecord | null,
  existingRecordByPerson: SyncExistingRecord | null,
): ActiveCodeDecision {
  const code = record.externalCode?.trim() ?? "";
  if (!code) return { kind: "SKIP_EMPTY_CODE" };
  if (!existingPerson) return { kind: "SKIP_NOT_LOCAL", documentType: record.documentType, documentNumber: record.documentNumber };
  if (!namesMatch(record, existingPerson)) return { kind: "CONFLICT_NAMES", externalCode: code, personId: existingPerson.id };

  if (existingRecordByCode && existingRecordByCode.personId != null && existingRecordByCode.personId !== existingPerson.id) {
    return { kind: "CONFLICT_CODE_OWNED_BY_OTHER", externalCode: code, personId: existingPerson.id, ownedByPersonId: existingRecordByCode.personId };
  }

  if (existingRecordByPerson && existingRecordByPerson.linkStatus === "LINKED" && existingRecordByPerson.externalCode !== code) {
    return { kind: "CONFLICT_PERSON_ALREADY_LINKED", externalCode: code, personId: existingPerson.id, existingCode: existingRecordByPerson.externalCode };
  }

  if (existingRecordByCode && existingRecordByCode.personId === existingPerson.id && existingRecordByCode.linkStatus === "LINKED") {
    return { kind: "UNCHANGED", externalCode: code, personId: existingPerson.id };
  }

  return { kind: "LINK", externalCode: code, personId: existingPerson.id };
}

/**
 * Detecta códigos que aparecen asociados a más de un número de documento en el
 * lote. Esos códigos son inconsistentes y deben omitirse (no vincularse).
 */
export function detectDuplicateCodes(records: Array<{ externalCode: string; documentNumber: string }>): Set<string> {
  const seen = new Map<string, string>();
  const duplicates = new Set<string>();
  for (const record of records) {
    const code = record.externalCode?.trim() ?? "";
    if (!code) continue;
    const previous = seen.get(code);
    if (previous === undefined) {
      seen.set(code, record.documentNumber);
    } else if (previous !== record.documentNumber) {
      duplicates.add(code);
    }
  }
  return duplicates;
}

export type SyncSummary = {
  total: number;
  link: number;
  unchanged: number;
  skipEmptyCode: number;
  skipNotLocal: number;
  skipDuplicateCode: number;
  conflictNames: number;
  conflictCodeOwnedByOther: number;
  conflictPersonAlreadyLinked: number;
};

/**
 * Enmascara un número de documento para logs: conserva solo el inicio y el
 * final. Nunca se imprime el documento completo.
 */
export function maskDocument(value: string | null | undefined): string {
  if (!value) return "—";
  if (value.length <= 4) return "****";
  return `${value.slice(0, 2)}****${value.slice(-2)}`;
}
