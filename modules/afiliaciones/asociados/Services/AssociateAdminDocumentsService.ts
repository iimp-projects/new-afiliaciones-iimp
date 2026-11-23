import { DocumentCategory } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { S3StorageService } from "@/modules/shared/Services/S3StorageService";
import { APPLICATION_KEY_PREFIX, LEGACY_DOCUMENT_KEY_PREFIX } from "../../postulacion/Services/ApplicationDocumentAccess";
import { AssociateAdminDataError } from "./AssociateAdminDataService";
import {
  associateDocumentCategory,
  resolveAssociateDocumentSlot,
  type AssociateDocumentSlot,
} from "../Utilities/associateDocumentSlots";

const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp"];

export interface AssociateAdminDocument {
  id: string;
  category: string;
  slot: AssociateDocumentSlot;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
  url: string | null;
}

export interface AssociateAdminDocuments {
  applicationId: number | null;
  documents: AssociateAdminDocument[];
}

interface DocumentFile {
  buffer: Buffer;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}

function matchesDeclaredType(buffer: Buffer, mimeType: string): boolean {
  if (mimeType === "application/pdf") return buffer.subarray(0, 5).toString("ascii") === "%PDF-";
  if (mimeType === "image/jpeg") return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  if (mimeType === "image/png") return buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (mimeType === "image/webp") return buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP";
  return false;
}

export class AssociateAdminDocumentsService {
  async list(personId: number): Promise<AssociateAdminDocuments> {
    const application = await this.latestApplication(personId);
    return application ? this.buildList(application.id) : { applicationId: null, documents: [] };
  }

  async listByApplication(applicationId: number): Promise<AssociateAdminDocuments> {
    const application = await this.application(applicationId);
    return this.buildList(application.id);
  }

  async upload(actorUserId: number, personId: number, slot: AssociateDocumentSlot, file: DocumentFile): Promise<AssociateAdminDocuments> {
    this.validateFile(slot, file);
    const application = await this.latestApplication(personId);
    if (!application) throw new AssociateAdminDataError("La persona no tiene un expediente para adjuntar documentos.", 409);
    await this.persist(actorUserId, personId, application.id, slot, file);
    return this.buildList(application.id);
  }

  async uploadToApplication(actorUserId: number, applicationId: number, slot: AssociateDocumentSlot, file: DocumentFile): Promise<AssociateAdminDocuments> {
    this.validateFile(slot, file);
    const application = await this.application(applicationId);
    await this.persist(actorUserId, application.personId, application.id, slot, file);
    return this.buildList(application.id);
  }

  private validateFile(slot: AssociateDocumentSlot, file: DocumentFile): void {
    if (file.sizeBytes < 1 || file.sizeBytes > MAX_BYTES) throw new AssociateAdminDataError("El documento debe pesar como máximo 10 MB.", 413);
    if (!ALLOWED_TYPES.includes(file.mimeType)) throw new AssociateAdminDataError("El documento debe ser PDF, JPG, PNG o WEBP.", 415);
    if (!matchesDeclaredType(file.buffer, file.mimeType)) throw new AssociateAdminDataError("El contenido del documento no coincide con un formato permitido.", 415);
    if (slot === "PHOTO" && !file.mimeType.startsWith("image/")) throw new AssociateAdminDataError("La fotografía debe ser una imagen.", 415);
  }

  private async persist(actorUserId: number, personId: number | null, applicationId: number, slot: AssociateDocumentSlot, file: DocumentFile): Promise<void> {
    const mapping = associateDocumentCategory(slot);
    const fileName = mapping.fileNamePrefix ? `${mapping.fileNamePrefix}_${file.fileName}` : file.fileName;
    const storage = new S3StorageService();
    const fileUrl = await storage.uploadFile(file.buffer, fileName, file.mimeType, `afiliaciones/applications/${applicationId}/documents`);
    await prisma.$transaction(async (tx) => {
      const created = await tx.applicationDocument.create({
        data: {
          applicationId,
          category: mapping.category as DocumentCategory,
          fileUrl,
          fileName,
          mimeType: file.mimeType,
          sizeBytes: BigInt(file.sizeBytes),
        },
      });
      await tx.auditLog.create({
        data: {
          userId: actorUserId,
          action: "ASSOCIATE_DOCUMENT_UPLOADED",
          entity: "ApplicationDocument",
          entityId: created.id,
          oldValues: { applicationId },
          newValues: {
            personId,
            applicationId,
            slot,
            category: mapping.category,
            fileName,
            mimeType: file.mimeType,
            sizeBytes: file.sizeBytes,
          },
        },
      });
    });
  }

  private async buildList(applicationId: number): Promise<AssociateAdminDocuments> {
    const documents = await prisma.applicationDocument.findMany({
      where: { applicationId },
      orderBy: { createdAt: "desc" },
    });
    const storage = new S3StorageService();
    return {
      applicationId,
      documents: await Promise.all(documents.map(async (document) => ({
        id: document.id,
        category: document.category,
        slot: resolveAssociateDocumentSlot(document),
        fileName: document.fileName,
        mimeType: document.mimeType,
        sizeBytes: Number(document.sizeBytes),
        createdAt: document.createdAt.toISOString(),
        url: await this.sign(storage, document.fileUrl),
      }))),
    };
  }

  private async latestApplication(personId: number): Promise<{ id: number } | null> {
    return prisma.membershipApplication.findFirst({
      where: { personId, deletedAt: null },
      orderBy: { updatedAt: "desc" },
      select: { id: true },
    });
  }

  private async application(applicationId: number): Promise<{ id: number; personId: number | null }> {
    const application = await prisma.membershipApplication.findFirst({
      where: { id: applicationId, deletedAt: null },
      select: { id: true, personId: true },
    });
    if (!application) throw new AssociateAdminDataError("El expediente no existe.", 404);
    return application;
  }

  private async sign(storage: S3StorageService, fileUrl: string): Promise<string | null> {
    try {
      return await storage.getPresignedApplicationDocumentUrl(fileUrl, [APPLICATION_KEY_PREFIX, LEGACY_DOCUMENT_KEY_PREFIX]);
    } catch {
      return null;
    }
  }
}
