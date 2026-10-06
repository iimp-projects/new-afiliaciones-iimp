import { DocumentType } from "@prisma/client";
import type { SanitizedSieAssociate, SieAssociateListPage, SieAssociateListPageWithClave } from "../Models/SieAssociateList";

const SIE_DOCUMENT_TYPE_MAP: Record<string, DocumentType> = {
  "1": "DNI",
  "4": "CE",
  "7": "PASSPORT",
};

export function mapSieDocumentType(value: string): DocumentType | null {
  return SIE_DOCUMENT_TYPE_MAP[value] ?? null;
}

export function sanitizeSieAssociate(raw: unknown): SanitizedSieAssociate {
  const record = isRecord(raw) ? raw : {};
  return {
    documentType: text(record.TipoDocumento),
    documentNumber: text(record.NumDocumento),
    externalCode: text(record.Codigo),
    sourceType: text(record.Tipo),
    sourceDescription: text(record.TipoDescripcion),
    passwordPresent: typeof record.Clave === "string" && record.Clave.trim().length > 0,
    nombres: nullableText(record.Nombres),
    apellidoPaterno: nullableText(record.ApellidoPaterno),
    apellidoMaterno: nullableText(record.ApellidoMaterno),
    fechaNacimiento: nullableText(record.FechaNacimiento),
    telefono: nullableText(record.Telefono),
    correo: nullableText(record.Correo),
    direccion: nullableText(record.Direccion),
    pais: nullableText(record.Pais),
    paisNombre: nullableText(record.PaisNombre),
    departamento: nullableText(record.Departamento),
    departamentoNombre: nullableText(record.DepartamentoNombre),
    provincia: nullableText(record.Provincia),
    provinciaNombre: nullableText(record.ProvinciaNombre),
    distrito: nullableText(record.Distrito),
    distritoNombre: nullableText(record.DistritoNombre),
  };
}

export function parseAssociateListPage(value: unknown): SieAssociateListPage {
  if (!isRecord(value) || !Array.isArray(value.Asociados)) {
    throw new Error("La API de asociados devolvió una lista inválida.");
  }
  return {
    pagina: nonNegativeInt(value.Pagina) ?? 1,
    tamanioPagina: nonNegativeInt(value.TamanioPagina) ?? 100,
    totalRegistros: nonNegativeInt(value.TotalRegistros) ?? 0,
    totalPaginas: nonNegativeInt(value.TotalPaginas) ?? 0,
    associates: value.Asociados.map(sanitizeSieAssociate),
  };
}

export function parseAssociateListPageWithClave(value: unknown): SieAssociateListPageWithClave {
  if (!isRecord(value) || !Array.isArray(value.Asociados)) {
    throw new Error("La API de asociados devolvió una lista inválida.");
  }
  return {
    pagina: nonNegativeInt(value.Pagina) ?? 1,
    tamanioPagina: nonNegativeInt(value.TamanioPagina) ?? 100,
    totalRegistros: nonNegativeInt(value.TotalRegistros) ?? 0,
    totalPaginas: nonNegativeInt(value.TotalPaginas) ?? 0,
    associates: value.Asociados.map((raw) => {
      const record = isRecord(raw) ? raw : {};
      return {
        record: sanitizeSieAssociate(raw),
        clave: typeof record.Clave === "string" && record.Clave.trim().length > 0 ? record.Clave : null,
      };
    }),
  };
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function nullableText(value: unknown): string | null {
  const trimmed = text(value);
  return trimmed.length > 0 ? trimmed : null;
}

function nonNegativeInt(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
