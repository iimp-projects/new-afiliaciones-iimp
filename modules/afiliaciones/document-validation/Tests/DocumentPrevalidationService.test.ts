import { beforeEach, describe, expect, it, vi } from "vitest";
import { PDFDocument } from "pdf-lib";
import type { DocumentAiConfig } from "@/lib/config/env";
import type { DocumentExtraction } from "../Models/DocumentExtraction";
import type { DocumentApplicationContext } from "../Repositories/DocumentPrevalidationRepository";
import { PrevalidationInProgressError } from "../Repositories/DocumentPrevalidationRepository";
import {
  DocumentPrevalidationService,
  DocumentPrevalidationServiceError,
} from "../Services/DocumentPrevalidationService";
import { DocumentExtractionError } from "../Services/DocumentAIExtractor";
import type { AcademicDocumentExtractor } from "../Services/DocumentAIExtractor";

const config: DocumentAiConfig = {
  enabled: true,
  apiKey: "test-key",
  model: "gemini-3.5-flash",
  timeoutMs: 5000,
  maxRetries: 0,
  maxFileBytes: 10 * 1024 * 1024,
  maxPages: 5,
  maxImageDimension: 6000,
  cacheTtlMs: 30 * 24 * 60 * 60 * 1000,
  maxAcademicAgeSemesters: 1,
  currentAcademicPeriod: null,
};

const extraction: DocumentExtraction = {
  tipo_documento: "constancia_estudios",
  nombre_completo: "ANA MARIA QUISPE FLORES",
  universidad: "UNIVERSIDAD NACIONAL DE SAN ANTONIO ABAD DEL CUSCO",
  carrera: "INGENIERIA DE MINAS",
  ciclo_academico: "8",
  periodo_academico: "2026-II",
  fecha_emision: "10 de octubre de 2026",
  autoridad_emisora: "DIRECTOR DE ESCUELA PROFESIONAL",
  firma_visible: true,
  sello_visible: null,
  documento_completo: true,
  legibilidad: "legible",
  advertencias: [],
};

const context: DocumentApplicationContext = {
  id: 42,
  affiliateType: "STUDENT",
  status: "DRAFT",
  applicant: {
    fullName: "Ana María Quispe Flores",
    universityName: "Universidad Nacional de San Antonio Abad del Cusco",
    careerName: "Ingeniería de Minas",
    declaredCycle: 8,
  },
};

function extractionResult(overrides: Partial<DocumentExtraction> = {}) {
  return {
    extraction: { ...extraction, ...overrides },
    meta: {
      model: "gemini-3.5-flash",
      modelVersion: "gemini-3.5-flash-001",
      promptVersion: "1.0.0",
      schemaVersion: "1.0.0",
      latencyMs: 1200,
      attempts: 1,
      usage: { promptTokens: 100, outputTokens: 20, thoughtTokens: 0, totalTokens: 120 },
    },
  };
}

let pdf: Buffer;

beforeEach(async () => {
  const document = await PDFDocument.create();
  document.addPage();
  pdf = Buffer.from(await document.save());
});

function createMocks() {
  const repository = {
    findApplicationContext: vi.fn().mockResolvedValue(context),
    createProcessingLocked: vi.fn().mockResolvedValue("row-1"),
    findReusableExtraction: vi.fn().mockResolvedValue(null),
    completeAnalysis: vi.fn().mockResolvedValue(undefined),
    markTechnicalError: vi.fn().mockResolvedValue(undefined),
  };
  const storage = { uploadFile: vi.fn().mockResolvedValue("https://s3.example/constancia.pdf") };
  const extractor: AcademicDocumentExtractor = { extract: vi.fn().mockResolvedValue(extractionResult()) };
  return { repository, storage, extractor };
}

function serviceFor(
  mocks: ReturnType<typeof createMocks>,
  overrides: Partial<DocumentAiConfig> = {},
) {
  return new DocumentPrevalidationService(
    { ...config, ...overrides },
    {
      repository: mocks.repository,
      storage: mocks.storage,
      extractor: mocks.extractor,
      now: () => new Date("2026-11-16T12:00:00.000Z"),
    },
  );
}

function input() {
  return {
    applicationId: 42,
    buffer: pdf,
    fileName: "constancia.pdf",
    mimeType: "application/pdf",
  };
}

describe("DocumentPrevalidationService", () => {
  it("orquesta validación, extracción, reglas y persistencia", async () => {
    const mocks = createMocks();
    const result = await serviceFor(mocks).execute(input());

    expect(result.status).toBe("PREVALIDATED");
    expect(result.file.url).toBe("https://s3.example/constancia.pdf");
    expect(result.rules).toHaveLength(8);
    expect(mocks.storage.uploadFile).toHaveBeenCalledWith(
      pdf,
      "constancia.pdf",
      "application/pdf",
      "afiliaciones/applications/42/education-documents",
    );
    expect(mocks.extractor.extract).toHaveBeenCalledTimes(1);
    expect(mocks.repository.completeAnalysis).toHaveBeenCalledWith(
      "row-1",
      expect.objectContaining({ result: "PREVALIDATED", cacheHit: false }),
    );
  });

  it("TEST-23: reutiliza la extracción y vuelve a aplicar reglas con el nuevo contexto", async () => {
    const mocks = createMocks();
    mocks.repository.findReusableExtraction
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ extraction, fileUrl: "https://s3.example/cached.pdf" });

    const first = await serviceFor(mocks).execute(input());
    const second = await serviceFor(mocks, { currentAcademicPeriod: "2024-II" }).execute(input());

    expect(first.status).toBe("PREVALIDATED");
    expect(second.status).toBe("NEEDS_REVIEW");
    expect(second.cacheHit).toBe(true);
    expect(second.file.url).toBe("https://s3.example/cached.pdf");
    expect(mocks.extractor.extract).toHaveBeenCalledTimes(1);
    expect(mocks.storage.uploadFile).toHaveBeenCalledTimes(1);
    expect(second.rules.find((item) => item.code === "R06")?.status).toBe("UNKNOWN");
  });

  it("TEST-17: un timeout de Gemini devuelve TECHNICAL_ERROR sin perder el archivo", async () => {
    const mocks = createMocks();
    mocks.extractor.extract = vi.fn().mockRejectedValue(
      new DocumentExtractionError("TIMEOUT", "timeout", true),
    );

    const result = await serviceFor(mocks).execute(input());

    expect(result.status).toBe("TECHNICAL_ERROR");
    expect(result.file.url).toBe("https://s3.example/constancia.pdf");
    expect(mocks.repository.markTechnicalError).toHaveBeenCalledWith("row-1", "TIMEOUT", expect.any(Number));
  });

  it("TEST-18/19: JSON inválido o cuota agotada se registran como error técnico", async () => {
    for (const code of ["INVALID_JSON", "QUOTA"] as const) {
      const mocks = createMocks();
      mocks.extractor.extract = vi.fn().mockRejectedValue(
        new DocumentExtractionError(code, "upstream", code === "QUOTA"),
      );
      const result = await serviceFor(mocks).execute(input());
      expect(result.status).toBe("TECHNICAL_ERROR");
      expect(mocks.repository.markTechnicalError).toHaveBeenCalledWith("row-1", code, expect.any(Number));
    }
  });

  it("TEST-20: rechaza un análisis simultáneo del mismo documento", async () => {
    const mocks = createMocks();
    mocks.repository.createProcessingLocked.mockRejectedValue(new PrevalidationInProgressError());

    await expect(serviceFor(mocks).execute(input())).rejects.toMatchObject({
      code: "PREVALIDATION_IN_PROGRESS",
      status: 409,
    });
    expect(mocks.extractor.extract).not.toHaveBeenCalled();
  });

  it("no procesa una solicitud que no es de Asociado Estudiante", async () => {
    const mocks = createMocks();
    mocks.repository.findApplicationContext.mockResolvedValue({ ...context, affiliateType: "ACTIVE" });

    await expect(serviceFor(mocks).execute(input())).rejects.toBeInstanceOf(DocumentPrevalidationServiceError);
    expect(mocks.storage.uploadFile).not.toHaveBeenCalled();
  });

  it("no procesa una solicitud ya enviada", async () => {
    const mocks = createMocks();
    mocks.repository.findApplicationContext.mockResolvedValue({ ...context, status: "PENDING" });

    await expect(serviceFor(mocks).execute(input())).rejects.toMatchObject({
      code: "APPLICATION_NOT_EDITABLE",
      status: 409,
    });
  });

  it("TEST-16: un archivo malformado no se envía a S3 ni a Gemini", async () => {
    const mocks = createMocks();
    await expect(
      serviceFor(mocks).execute({ ...input(), buffer: Buffer.from("%PDF-1.7 roto") }),
    ).rejects.toMatchObject({ code: "MALFORMED" });
    expect(mocks.storage.uploadFile).not.toHaveBeenCalled();
    expect(mocks.extractor.extract).not.toHaveBeenCalled();
  });

  it("un fallo de almacenamiento devuelve STORAGE_ERROR", async () => {
    const mocks = createMocks();
    mocks.storage.uploadFile.mockRejectedValue(new Error("s3 down"));
    await expect(serviceFor(mocks).execute(input())).rejects.toMatchObject({
      code: "STORAGE_ERROR",
      status: 502,
    });
  });

  it("un fallo de persistencia no invalida el resultado calculado", async () => {
    const mocks = createMocks();
    mocks.repository.completeAnalysis.mockRejectedValue(new Error("db down"));
    const result = await serviceFor(mocks).execute(input());
    expect(result.status).toBe("PREVALIDATED");
  });
});
