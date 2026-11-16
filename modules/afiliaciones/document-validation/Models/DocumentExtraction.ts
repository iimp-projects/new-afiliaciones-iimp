import { z } from "zod";

export const DOCUMENT_TYPE_VALUES = [
  "constancia_estudios",
  "constancia_matricula",
  "ficha_matricula",
  "carnet_universitario",
  "documento_identidad",
  "otro",
  "desconocido",
] as const;

export const DOCUMENT_LEGIBILITY_VALUES = ["legible", "parcial", "ilegible"] as const;

export const documentExtractionSchema = z.object({
  tipo_documento: z.enum(DOCUMENT_TYPE_VALUES),
  nombre_completo: z.string().trim().min(2).max(200).nullable(),
  universidad: z.string().trim().min(2).max(200).nullable(),
  carrera: z.string().trim().min(2).max(200).nullable(),
  ciclo_academico: z.string().trim().min(1).max(50).nullable(),
  periodo_academico: z.string().trim().min(2).max(50).nullable(),
  fecha_emision: z.string().trim().min(2).max(80).nullable(),
  autoridad_emisora: z.string().trim().min(2).max(300).nullable(),
  firma_visible: z.boolean().nullable(),
  sello_visible: z.boolean().nullable(),
  documento_completo: z.boolean().nullable(),
  legibilidad: z.enum(DOCUMENT_LEGIBILITY_VALUES).nullable(),
  advertencias: z.array(z.string().trim().min(1).max(300)).max(20),
});

export type DocumentExtraction = z.infer<typeof documentExtractionSchema>;
export type DocumentTypeValue = DocumentExtraction["tipo_documento"];
export type DocumentLegibility = NonNullable<DocumentExtraction["legibilidad"]>;

const STRING_FIELDS = [
  "nombre_completo",
  "universidad",
  "carrera",
  "ciclo_academico",
  "periodo_academico",
  "fecha_emision",
  "autoridad_emisora",
] as const;

function normalizeBoolean(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") return true;
    if (normalized === "false") return false;
  }
  return null;
}

function normalizeString(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

/**
 * Normaliza variantes leves que el modelo puede devolver (cadena vacía,
 * booleanos como texto, advertencias sueltas) antes de validar con Zod. No
 * rellena datos faltantes ni corrige contenido: si el resultado sigue siendo
 * inválido, se trata como error técnico de extracción.
 */
export function normalizeRawExtraction(raw: unknown): unknown {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  const source = raw as Record<string, unknown>;
  const normalized: Record<string, unknown> = { ...source };

  for (const field of STRING_FIELDS) normalized[field] = normalizeString(source[field]);
  for (const field of ["firma_visible", "sello_visible", "documento_completo"] as const) {
    normalized[field] = normalizeBoolean(source[field]);
  }

  const legibility = normalizeString(source.legibilidad)?.toLowerCase() ?? null;
  normalized.legibilidad = legibility && (DOCUMENT_LEGIBILITY_VALUES as readonly string[]).includes(legibility)
    ? legibility
    : null;

  if (typeof source.advertencias === "string") {
    normalized.advertencias = [source.advertencias];
  } else if (!Array.isArray(source.advertencias)) {
    normalized.advertencias = [];
  }

  return normalized;
}

export function parseDocumentExtraction(raw: unknown): DocumentExtraction {
  return documentExtractionSchema.parse(normalizeRawExtraction(raw));
}
