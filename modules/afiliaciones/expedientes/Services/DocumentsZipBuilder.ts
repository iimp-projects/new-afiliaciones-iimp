import JSZip from "jszip";
import { formatPeruDateTime } from "@/modules/shared/Utils/formatPeruDateTime";
import { S3StorageService } from "@/modules/shared/Services/S3StorageService";
import { resolveApplicationDocumentScope } from "@/modules/afiliaciones/postulacion/Services/ApplicationDocumentAccess";
import {
  EXPEDIENTE_DOCUMENT_SLOT_LABELS,
  buildExpedienteDocumentLink,
  type CurrentExpedienteDocument,
} from "./ExpedienteDocumentCatalog";

type StorageReader = Pick<S3StorageService, "getObjectBuffer">;

export interface DocumentsZipItem {
  code: string;
  documents: CurrentExpedienteDocument[];
}

export interface DocumentsZipResult {
  buffer: Buffer;
  fileName: string;
  expedientes: number;
  documents: number;
  errors: string[];
}

export interface DocumentsZipParams {
  items: DocumentsZipItem[];
  excelBuffer: Buffer;
  excelFileName: string;
  rootPrefix: string;
  storage?: StorageReader;
  excelLabel: string;
}

function sanitizeSegment(value: string, fallback: string): string {
  const cleaned = value
    .trim()
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, "_")
    .replace(/\s+/g, " ")
    .slice(0, 140);
  return cleaned || fallback;
}

function uniqueName(fileName: string, used: Set<string>): string {
  if (!used.has(fileName.toLowerCase())) {
    used.add(fileName.toLowerCase());
    return fileName;
  }

  const dot = fileName.lastIndexOf(".");
  const base = dot > 0 ? fileName.slice(0, dot) : fileName;
  const extension = dot > 0 ? fileName.slice(dot) : "";
  let index = 2;
  let candidate = `${base} (${index})${extension}`;
  while (used.has(candidate.toLowerCase())) {
    index += 1;
    candidate = `${base} (${index})${extension}`;
  }
  used.add(candidate.toLowerCase());
  return candidate;
}

function csvCell(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

function zipFileName(document: CurrentExpedienteDocument): string {
  const label = EXPEDIENTE_DOCUMENT_SLOT_LABELS[document.slot];
  const original = sanitizeSegment(document.fileName, `${label}.bin`);
  return sanitizeSegment(`${label}_${original}`, `${label}.bin`);
}

export async function buildDocumentsZip({
  items,
  excelBuffer,
  excelFileName,
  rootPrefix,
  storage,
  excelLabel,
}: DocumentsZipParams): Promise<DocumentsZipResult> {
  const scope = resolveApplicationDocumentScope({ isInternal: true, applicantApplicationIds: [] });
  if (!scope) throw new Error("No se pudo resolver el alcance de documentos.");

  const reader = storage ?? new S3StorageService();
  const zip = new JSZip();
  const generatedAt = new Date();
  const dateLabel = generatedAt.toISOString().slice(0, 10);
  const rootFolder = `${rootPrefix}_${dateLabel}`;
  const errors: string[] = [];
  const manifest: string[] = ["Código,Documento,Archivo,Enlace"];
  let documents = 0;
  let expedientesWithDocuments = 0;

  zip.file(`${rootFolder}/${excelFileName}`, excelBuffer);

  for (const item of items) {
    if (item.documents.length === 0) continue;

    expedientesWithDocuments += 1;
    const folder = sanitizeSegment(item.code, `Registro_${expedientesWithDocuments}`);
    const usedNames = new Set<string>();

    for (const document of item.documents) {
      const fileName = uniqueName(zipFileName(document), usedNames);
      const link = buildExpedienteDocumentLink(document.fileUrl);
      try {
        const buffer = await reader.getObjectBuffer(document.fileUrl, scope.allowedPrefixes);
        zip.file(`${rootFolder}/${folder}/${fileName}`, buffer);
        manifest.push([item.code, document.label, fileName, link].map(csvCell).join(","));
        documents += 1;
      } catch {
        errors.push(`${item.code} | ${document.label} | ${document.fileName} | no se pudo descargar`);
      }
    }
  }

  zip.file(`${rootFolder}/documentos.csv`, `\uFEFF${manifest.join("\r\n")}\r\n`);
  zip.file(
    `${rootFolder}/LEEME.txt`,
    [
      `Descarga de ${excelLabel} y documentos`,
      `Generado: ${formatPeruDateTime(generatedAt)}`,
      `Registros incluidos: ${expedientesWithDocuments}`,
      `Documentos incluidos: ${documents}`,
      errors.length ? `Documentos con error: ${errors.length}` : "Sin errores de descarga.",
      "",
      "Contenido:",
      `- ${excelFileName}: datos y enlaces de los registros filtrados.`,
      "- documentos/: una carpeta por registro con los documentos vigentes.",
      "- documentos.csv: detalle de cada documento con su enlace.",
      "- _errores.txt: solo si algún archivo no se pudo descargar.",
      "",
      "Los enlaces abren la última versión vigente de cada documento.",
    ].join("\r\n"),
  );
  if (errors.length > 0) {
    zip.file(`${rootFolder}/_errores.txt`, errors.join("\r\n"));
  }

  const buffer = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });

  return {
    buffer: Buffer.from(buffer),
    fileName: `${rootFolder}.zip`,
    expedientes: expedientesWithDocuments,
    documents,
    errors,
  };
}
