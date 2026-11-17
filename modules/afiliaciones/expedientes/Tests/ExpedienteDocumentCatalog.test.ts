import { describe, expect, it } from "vitest";
import {
  buildCurrentExpedienteDocuments,
  buildExpedienteDocumentLink,
} from "../Services/ExpedienteDocumentCatalog";

const persisted = (overrides: Record<string, unknown> = {}) => ({
  category: "ID_DOCUMENT",
  fileUrl: "afiliaciones/applications/1/documents/old.pdf",
  fileName: "dni-old.pdf",
  mimeType: "application/pdf",
  createdAt: "2026-01-01T10:00:00.000Z",
  updatedAt: "2026-01-01T10:00:00.000Z",
  ...overrides,
});

const source = (overrides: Record<string, unknown> = {}) => ({
  id: 1,
  updatedAt: "2026-01-03T10:00:00.000Z",
  draftData: {},
  documents: [],
  ...overrides,
});

describe("ExpedienteDocumentCatalog", () => {
  it("selecciona la última versión persistida por tipo de documento", () => {
    const documents = buildCurrentExpedienteDocuments(
      source({
        documents: [
          persisted(),
          persisted({
            fileUrl: "afiliaciones/applications/1/documents/new.pdf",
            fileName: "dni-new.pdf",
            updatedAt: "2026-02-01T10:00:00.000Z",
          }),
        ],
      }),
    );

    expect(documents).toHaveLength(1);
    expect(documents[0]).toMatchObject({
      slot: "ID_DOCUMENT",
      fileName: "dni-new.pdf",
      source: "persisted",
    });
  });

  it("prioriza el documento corregido del borrador sobre una versión anterior", () => {
    const documents = buildCurrentExpedienteDocuments(
      source({
        draftData: {
          personalInformation: {
            identityDocument: {
              url: "afiliaciones/applications/1/documents/corrected.pdf",
              name: "dni-corregido.pdf",
              type: "application/pdf",
            },
          },
        },
        documents: [persisted()],
      }),
    );

    expect(documents.find((document) => document.slot === "ID_DOCUMENT")).toMatchObject({
      fileName: "dni-corregido.pdf",
      fileUrl: "afiliaciones/applications/1/documents/corrected.pdf",
      source: "draft",
    });
  });

  it("clasifica fotografía y constancia de estudios desde el borrador", () => {
    const documents = buildCurrentExpedienteDocuments(
      source({
        draftData: {
          personalInformation: {
            photo: { url: "afiliaciones/applications/1/documents/photo.jpg", name: "foto.jpg", type: "image/jpeg" },
          },
          academicStudies: [
            {
              universityLetter: {
                url: "afiliaciones/applications/1/documents/constancia.pdf",
                name: "constancia.pdf",
                type: "application/pdf",
              },
            },
          ],
        },
      }),
    );

    expect(documents.map((document) => document.slot)).toEqual([
      "PHOTO",
      "STUDY_CERTIFICATE",
    ]);
  });

  it("conserva CV, voucher y carta de recomendación persistidos", () => {
    const documents = buildCurrentExpedienteDocuments(
      source({
        documents: [
          persisted({ category: "CV", fileUrl: "afiliaciones/applications/1/documents/cv.pdf", fileName: "cv.pdf" }),
          persisted({
            category: "PAYMENT_VOUCHER",
            fileUrl: "afiliaciones/applications/1/documents/voucher.pdf",
            fileName: "voucher.pdf",
          }),
          persisted({
            category: "RECOMMENDATION_LETTER",
            fileUrl: "afiliaciones/applications/1/documents/carta.pdf",
            fileName: "carta.pdf",
          }),
        ],
      }),
    );

    expect(documents.map((document) => document.slot)).toEqual([
      "CV",
      "PAYMENT_VOUCHER",
      "RECOMMENDATION_LETTER",
    ]);
  });

  it("clasifica una fotografía en PDF por su nombre de archivo", () => {
    const documents = buildCurrentExpedienteDocuments(
      source({
        documents: [
          persisted({
            category: "OTHER",
            fileUrl: "afiliaciones/applications/1/documents/foto.pdf",
            fileName: "FOTO_CARNET.pdf",
            mimeType: "application/pdf",
          }),
        ],
      }),
    );

    expect(documents[0]?.slot).toBe("PHOTO");
  });

  it("genera enlaces estables al endpoint interno con redirect", () => {
    const link = buildExpedienteDocumentLink(
      "afiliaciones/applications/1/documents/dni.pdf",
      { NEXT_PUBLIC_APP_URL: "https://afiliaciones.example" },
    );

    expect(link).toBe(
      "https://afiliaciones.example/api/afiliaciones/postulacion/file?url=afiliaciones%2Fapplications%2F1%2Fdocuments%2Fdni.pdf&redirect=1",
    );
  });
});
