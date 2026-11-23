import type { DocumentCategory } from "@prisma/client";
import { getAppBaseUrl } from "@/lib/config/env";

export type ExpedienteDocumentSlot =
  | "ID_DOCUMENT"
  | "SWORN_DECLARATION"
  | "PHOTO"
  | "STUDY_CERTIFICATE"
  | "CV"
  | "PAYMENT_VOUCHER"
  | "RECOMMENDATION_LETTER"
  | "DEGREE_CERTIFICATE"
  | "OTHER";

export const EXPEDIENTE_DOCUMENT_SLOTS: ReadonlyArray<{
  slot: ExpedienteDocumentSlot;
  label: string;
}> = [
  { slot: "ID_DOCUMENT", label: "Documento de Identidad" },
  { slot: "SWORN_DECLARATION", label: "Declaración Jurada" },
  { slot: "PHOTO", label: "Fotografía" },
  { slot: "STUDY_CERTIFICATE", label: "Constancia de Estudios" },
  { slot: "CV", label: "CV" },
  { slot: "PAYMENT_VOUCHER", label: "Voucher de Pago" },
  { slot: "RECOMMENDATION_LETTER", label: "Carta de Recomendación" },
  { slot: "DEGREE_CERTIFICATE", label: "Certificado Académico" },
  { slot: "OTHER", label: "Otros Documentos" },
];

export const EXPEDIENTE_DOCUMENT_SLOT_LABELS: Record<ExpedienteDocumentSlot, string> =
  Object.fromEntries(EXPEDIENTE_DOCUMENT_SLOTS.map(({ slot, label }) => [slot, label])) as Record<
    ExpedienteDocumentSlot,
    string
  >;

export interface PersistedExpedienteDocument {
  category: DocumentCategory;
  fileUrl: string;
  fileName: string;
  mimeType: string;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface ExpedienteDocumentSource {
  id?: number;
  updatedAt: Date | string;
  draftData?: unknown;
  documents: PersistedExpedienteDocument[];
}

export interface CurrentExpedienteDocument {
  slot: ExpedienteDocumentSlot;
  label: string;
  fileUrl: string;
  fileName: string;
  mimeType: string;
  uploadedAt: Date;
  source: "draft" | "persisted";
}

const OTHER_IMAGE_SLOT: ExpedienteDocumentSlot = "PHOTO";
const OTHER_STUDY_SLOT: ExpedienteDocumentSlot = "STUDY_CERTIFICATE";
const OTHER_DEFAULT_SLOT: ExpedienteDocumentSlot = "OTHER";

function toDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function documentTime(document: PersistedExpedienteDocument): number {
  return (toDate(document.updatedAt) ?? toDate(document.createdAt) ?? new Date(0)).getTime();
}

function classifyOther(document: PersistedExpedienteDocument): ExpedienteDocumentSlot {
  if (
    String(document.mimeType).toLowerCase().startsWith("image/") ||
    /foto|photo|perfil/i.test(document.fileName ?? "")
  ) {
    return OTHER_IMAGE_SLOT;
  }
  if (/constancia|estudio|universit|carta/i.test(document.fileName ?? "")) return OTHER_STUDY_SLOT;
  return OTHER_DEFAULT_SLOT;
}

function slotForPersistedDocument(
  document: PersistedExpedienteDocument,
): ExpedienteDocumentSlot {
  return document.category === "OTHER" ? classifyOther(document) : (document.category as ExpedienteDocumentSlot);
}

function latestBySlot(
  documents: PersistedExpedienteDocument[],
): Map<ExpedienteDocumentSlot, PersistedExpedienteDocument> {
  const latest = new Map<ExpedienteDocumentSlot, PersistedExpedienteDocument>();
  for (const document of documents) {
    const slot = slotForPersistedDocument(document);
    const current = latest.get(slot);
    if (!current || documentTime(document) >= documentTime(current)) {
      latest.set(slot, document);
    }
  }
  return latest;
}

interface DraftFileReference {
  url: string;
  name?: string;
  type?: string;
}

function readFileReference(value: unknown): DraftFileReference | null {
  if (typeof value === "string" && value.trim()) {
    return { url: value.trim() };
  }
  if (value && typeof value === "object") {
    const candidate = value as { url?: unknown; name?: unknown; type?: unknown };
    if (typeof candidate.url === "string" && candidate.url.trim()) {
      return {
        url: candidate.url.trim(),
        name: typeof candidate.name === "string" ? candidate.name : undefined,
        type: typeof candidate.type === "string" ? candidate.type : undefined,
      };
    }
  }
  return null;
}

function readDraftDocuments(
  source: ExpedienteDocumentSource,
): Array<{ slot: ExpedienteDocumentSlot; reference: DraftFileReference }> {
  const draft = source.draftData as
    | {
        personalInformation?: {
          identityDocument?: unknown;
          photo?: unknown;
          photoUrl?: unknown;
        };
        endorsements?: { declarationDocumentId?: unknown };
        academicStudies?: Array<{ universityLetter?: unknown }> | null;
      }
    | null
    | undefined;

  if (!draft || typeof draft !== "object") return [];

  const candidates: Array<{ slot: ExpedienteDocumentSlot; reference: DraftFileReference | null }> = [
    { slot: "ID_DOCUMENT", reference: readFileReference(draft.personalInformation?.identityDocument) },
    {
      slot: OTHER_IMAGE_SLOT,
      reference:
        readFileReference(draft.personalInformation?.photo) ??
        readFileReference(draft.personalInformation?.photoUrl),
    },
    {
      slot: "SWORN_DECLARATION",
      reference: readFileReference(draft.endorsements?.declarationDocumentId),
    },
    {
      slot: OTHER_STUDY_SLOT,
      reference: readFileReference(draft.academicStudies?.[0]?.universityLetter),
    },
  ];

  return candidates.flatMap(({ slot, reference }) =>
    reference ? [{ slot, reference }] : [],
  );
}

function fallbackFileName(slot: ExpedienteDocumentSlot, reference: DraftFileReference): string {
  if (reference.name) return reference.name;
  const extension = reference.type === "image/png" ? "png" : reference.type === "image/jpeg" ? "jpg" : "pdf";
  return `${EXPEDIENTE_DOCUMENT_SLOT_LABELS[slot].replace(/\s+/g, "_")}.${extension}`;
}

function defaultUploadedAt(source: ExpedienteDocumentSource): Date {
  return toDate(source.updatedAt) ?? new Date(0);
}

/**
 * Devuelve la versión vigente de cada documento del expediente.
 *
 * - Los documentos del borrador (`draftData`) son la fuente de verdad para los
 *   documentos que se vuelven a subir tras una observación.
 * - Para los documentos persistidos sin referencia vigente en el borrador se
 *   toma la última versión por `updatedAt`/`createdAt`.
 */
export function buildCurrentExpedienteDocuments(
  source: ExpedienteDocumentSource,
): CurrentExpedienteDocument[] {
  const persisted = source.documents ?? [];
  const latestPersisted = latestBySlot(persisted);
  const byUrl = new Map(persisted.map((document) => [document.fileUrl, document]));

  const current = new Map<ExpedienteDocumentSlot, CurrentExpedienteDocument>();

  for (const [slot, document] of latestPersisted) {
    current.set(slot, {
      slot,
      label: EXPEDIENTE_DOCUMENT_SLOT_LABELS[slot],
      fileUrl: document.fileUrl,
      fileName: document.fileName,
      mimeType: document.mimeType,
      uploadedAt: toDate(document.updatedAt) ?? toDate(document.createdAt) ?? defaultUploadedAt(source),
      source: "persisted",
    });
  }

  for (const { slot, reference } of readDraftDocuments(source)) {
    const persistedMatch = byUrl.get(reference.url);
    current.set(slot, {
      slot,
      label: EXPEDIENTE_DOCUMENT_SLOT_LABELS[slot],
      fileUrl: reference.url,
      fileName: reference.name ?? persistedMatch?.fileName ?? fallbackFileName(slot, reference),
      mimeType: reference.type ?? persistedMatch?.mimeType ?? "application/octet-stream",
      uploadedAt:
        toDate(persistedMatch?.updatedAt) ??
        toDate(persistedMatch?.createdAt) ??
        defaultUploadedAt(source),
      source: "draft",
    });
  }

  const ordered: CurrentExpedienteDocument[] = [];
  for (const { slot } of EXPEDIENTE_DOCUMENT_SLOTS) {
    const document = current.get(slot);
    if (document) ordered.push(document);
  }
  return ordered;
}

export function buildExpedienteDocumentLink(
  fileUrl: string,
  env: Readonly<Record<string, string | undefined>> = process.env,
): string {
  const baseUrl = getAppBaseUrl(env).replace(/\/+$/, "");
  return `${baseUrl}/api/afiliaciones/postulacion/file?url=${encodeURIComponent(fileUrl)}&redirect=1`;
}

export interface ExpedienteDocumentCell {
  text: string;
  hyperlink: string;
  tooltip?: string;
}

/**
 * Construye una celda por tipo de documento. Cada columna recibe su propio
 * enlace, con la URL visible y el nombre del archivo como ayuda.
 */
export function buildExpedienteDocumentCells(
  documents: CurrentExpedienteDocument[],
): Map<string, ExpedienteDocumentCell | ""> {
  const bySlot = new Map(documents.map((document) => [document.slot, document]));
  const cells = new Map<string, ExpedienteDocumentCell | "">();

  for (const { slot, label } of EXPEDIENTE_DOCUMENT_SLOTS) {
    const document = bySlot.get(slot);
    if (!document) {
      cells.set(label, "");
      continue;
    }

    const hyperlink = buildExpedienteDocumentLink(document.fileUrl);
    cells.set(label, {
      text: hyperlink,
      hyperlink,
      tooltip: document.fileName,
    });
  }

  return cells;
}
