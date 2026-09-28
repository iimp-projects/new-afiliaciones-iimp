type AuthorizationFieldType = "string" | "number" | "boolean" | "object" | "array" | "null" | "undefined";
type AuthorizationFieldMap = Record<string, AuthorizationFieldType>;

export interface NiubizAuthorizationStructureDiagnostic {
  topLevel: AuthorizationFieldMap;
  order?: AuthorizationFieldMap;
  data?: AuthorizationFieldMap;
  dataMap?: AuthorizationFieldMap;
  additionalObjects: Record<string, AuthorizationFieldMap>;
}

const KNOWN_NESTED_OBJECTS = ["order", "data", "dataMap"] as const;
const KNOWN_NESTED_OBJECT_SET = new Set<string>(KNOWN_NESTED_OBJECTS);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function fieldType(value: unknown): AuthorizationFieldType {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  if (typeof value === "object") return "object";
  return typeof value as Extract<AuthorizationFieldType, "string" | "number" | "boolean" | "undefined">;
}

function fieldTypes(value: Record<string, unknown>): AuthorizationFieldMap {
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, fieldType(value[key])]));
}

/**
 * Temporary TEST-only diagnostic: it returns field names and primitive shapes,
 * never response values. It is intentionally isolated from the mapper and persistence.
 */
export function describeNiubizAuthorizationResponse(value: Record<string, unknown>): NiubizAuthorizationStructureDiagnostic {
  const diagnostic: NiubizAuthorizationStructureDiagnostic = {
    topLevel: fieldTypes(value),
    additionalObjects: {},
  };

  for (const key of KNOWN_NESTED_OBJECTS) {
    const nested = value[key];
    if (isRecord(nested)) diagnostic[key] = fieldTypes(nested);
  }

  for (const [key, nested] of Object.entries(value)) {
    if (!KNOWN_NESTED_OBJECT_SET.has(key) && isRecord(nested)) {
      diagnostic.additionalObjects[key] = fieldTypes(nested);
    }
  }

  return diagnostic;
}

export function logNiubizAuthorizationStructure(value: Record<string, unknown>, paymentEnvironment = process.env.PAYMENT_ENVIRONMENT): void {
  if (paymentEnvironment?.toUpperCase() !== "TEST") return;
  console.info("[NIUBIZ_AUTHORIZATION_STRUCTURE]", describeNiubizAuthorizationResponse(value));
}
