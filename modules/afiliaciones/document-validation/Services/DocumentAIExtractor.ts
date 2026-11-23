import type { DocumentAiConfig } from "@/lib/config/env";
import { parseDocumentExtraction, type DocumentExtraction } from "../Models/DocumentExtraction";
import {
  ACADEMIC_DOCUMENT_RESPONSE_SCHEMA,
  ACADEMIC_DOCUMENT_SYSTEM_PROMPT,
  ACADEMIC_DOCUMENT_USER_PROMPT,
  DOCUMENT_EXTRACTION_SCHEMA_VERSION,
  DOCUMENT_PROMPT_VERSION,
} from "../Prompts/AcademicDocumentPrompt";

export interface ExtractionRequest {
  readonly buffer: Buffer;
  readonly mimeType: string;
}

export interface ExtractionUsage {
  readonly promptTokens: number | null;
  readonly outputTokens: number | null;
  readonly thoughtTokens: number | null;
  readonly totalTokens: number | null;
}

export interface ExtractionMeta {
  readonly model: string;
  readonly modelVersion: string | null;
  readonly promptVersion: string;
  readonly schemaVersion: string;
  readonly latencyMs: number;
  readonly attempts: number;
  readonly usage: ExtractionUsage;
}

export interface ExtractionResult {
  readonly extraction: DocumentExtraction;
  readonly meta: ExtractionMeta;
}

export type ExtractionErrorCode =
  | "CONFIGURATION"
  | "TIMEOUT"
  | "QUOTA"
  | "UPSTREAM"
  | "INVALID_JSON"
  | "INVALID_RESPONSE"
  | "NETWORK";

export class DocumentExtractionError extends Error {
  public constructor(
    public readonly code: ExtractionErrorCode,
    message: string,
    public readonly retryable = false,
  ) {
    super(message);
    this.name = "DocumentExtractionError";
  }
}

export interface AcademicDocumentExtractor {
  extract(request: ExtractionRequest): Promise<ExtractionResult>;
}

interface GeminiResponseBody {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
    finishReason?: string;
  }>;
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    thoughtsTokenCount?: number;
    totalTokenCount?: number;
  };
  modelVersion?: string;
  error?: { message?: string };
}

type FetchImplementation = typeof fetch;

const GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";

function errorMessageFrom(body: unknown): string {
  if (!body || typeof body !== "object") return "";
  const message = (body as GeminiResponseBody).error?.message;
  return typeof message === "string" ? message : "";
}

function isRetryableStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

function usageFrom(body: GeminiResponseBody): ExtractionUsage {
  return {
    promptTokens: body.usageMetadata?.promptTokenCount ?? null,
    outputTokens: body.usageMetadata?.candidatesTokenCount ?? null,
    thoughtTokens: body.usageMetadata?.thoughtsTokenCount ?? null,
    totalTokens: body.usageMetadata?.totalTokenCount ?? null,
  };
}

function textFrom(body: GeminiResponseBody): string {
  const parts = body.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return "";
  return parts.map((part) => (typeof part?.text === "string" ? part.text : "")).join("").trim();
}

/**
 * Cliente server-side de Gemini para extracción documental.
 *
 * Una llamada normal por análisis. Responde con JSON estricto y no decide
 * reglas de negocio. Solo reintenta errores transitorios (429/5xx/timeout/red),
 * nunca errores de validación ni respuestas JSON inválidas.
 */
export class GeminiDocumentAIExtractor implements AcademicDocumentExtractor {
  public constructor(
    private readonly config: DocumentAiConfig,
    private readonly fetchImpl: FetchImplementation = fetch,
  ) {}

  public async extract(request: ExtractionRequest): Promise<ExtractionResult> {
    if (!this.config.apiKey) {
      throw new DocumentExtractionError("CONFIGURATION", "La prevalidación no tiene credenciales configuradas.");
    }
    if (!["application/pdf", "image/jpeg", "image/png"].includes(request.mimeType)) {
      throw new DocumentExtractionError("INVALID_RESPONSE", "Tipo de archivo no compatible con la extracción.");
    }

    const startedAt = Date.now();
    const deadline = startedAt + this.config.timeoutMs;
    const maxAttempts = 1 + this.config.maxRetries;
    let lastError: DocumentExtractionError | null = null;
    let includeThinkingConfig = !this.config.model.toLowerCase().includes("lite");
    let thinkingFallbackUsed = false;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const remainingMs = deadline - Date.now();
      if (remainingMs <= 0) break;
      try {
        const result = await this.callGemini(request, startedAt, attempt, includeThinkingConfig, remainingMs);
        return result;
      } catch (error) {
        const normalized = error instanceof DocumentExtractionError
          ? error
          : new DocumentExtractionError("NETWORK", "No se pudo contactar al proveedor de IA.");
        lastError = normalized;

        // Compatibilidad de configuración de razonamiento: se corrige una sola
        // vez sin consumir un reintento de negocio y sin volver a analizar el
        // archivo por un motivo distinto.
        if (normalized.code === "CONFIGURATION") {
          if (includeThinkingConfig && !thinkingFallbackUsed) {
            includeThinkingConfig = false;
            thinkingFallbackUsed = true;
            attempt -= 1;
            continue;
          }
          break;
        }

        if (!normalized.retryable || attempt >= maxAttempts) break;
        const delayMs = 250 * attempt;
        if (Date.now() + delayMs >= deadline) break;
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }

    throw lastError ?? new DocumentExtractionError("UPSTREAM", "No se pudo completar la extracción.");
  }

  private async callGemini(
    request: ExtractionRequest,
    startedAt: number,
    attempt: number,
    includeThinkingConfig: boolean,
    remainingMs: number,
  ): Promise<ExtractionResult> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), remainingMs);
    const model = this.config.model;
    const generationConfig: Record<string, unknown> = {
      temperature: 0,
      topP: 0.1,
      maxOutputTokens: 800,
      responseMimeType: "application/json",
      responseSchema: ACADEMIC_DOCUMENT_RESPONSE_SCHEMA,
    };
    if (includeThinkingConfig) {
      generationConfig.thinkingConfig = { thinkingBudget: 0 };
    }

    const body = {
      systemInstruction: {
        parts: [{ text: ACADEMIC_DOCUMENT_SYSTEM_PROMPT }],
      },
      contents: [
        {
          role: "user",
          parts: [
            { text: ACADEMIC_DOCUMENT_USER_PROMPT },
            {
              inline_data: {
                mime_type: request.mimeType,
                data: request.buffer.toString("base64"),
              },
            },
          ],
        },
      ],
      generationConfig,
    };

    try {
      const response = await this.fetchImpl(`${GEMINI_ENDPOINT}/${encodeURIComponent(model)}:generateContent`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": this.config.apiKey as string,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      const rawBody = await response.text();
      let parsedBody: unknown = null;
      try {
        parsedBody = rawBody ? JSON.parse(rawBody) : null;
      } catch {
        parsedBody = null;
      }

      if (!response.ok) {
        const upstreamMessage = errorMessageFrom(parsedBody);
        if (response.status === 429) {
          throw new DocumentExtractionError("QUOTA", "El proveedor de IA alcanzó su límite temporal.", true);
        }
        if (isRetryableStatus(response.status)) {
          throw new DocumentExtractionError("UPSTREAM", "El proveedor de IA no está disponible.", true);
        }
        if (response.status === 400 && includeThinkingConfig && /thinking/i.test(upstreamMessage)) {
          throw new DocumentExtractionError("CONFIGURATION", "Reintento sin configuración de razonamiento.", true);
        }
        throw new DocumentExtractionError("UPSTREAM", "El proveedor de IA rechazó la solicitud.");
      }

      const geminiBody = (parsedBody ?? {}) as GeminiResponseBody;
      const finishReason = geminiBody.candidates?.[0]?.finishReason;
      if (finishReason && finishReason !== "STOP" && finishReason !== "MAX_TOKENS") {
        throw new DocumentExtractionError("INVALID_RESPONSE", "La extracción no pudo completarse.");
      }

      const text = textFrom(geminiBody);
      if (!text) {
        throw new DocumentExtractionError("INVALID_RESPONSE", "La extracción no devolvió datos.");
      }

      let json: unknown;
      try {
        json = JSON.parse(text);
      } catch {
        throw new DocumentExtractionError("INVALID_JSON", "La extracción devolvió un JSON inválido.");
      }

      let extraction: DocumentExtraction;
      try {
        extraction = parseDocumentExtraction(json);
      } catch {
        throw new DocumentExtractionError("INVALID_RESPONSE", "La extracción no cumple el esquema esperado.");
      }

      return {
        extraction,
        meta: {
          model,
          modelVersion: typeof geminiBody.modelVersion === "string" ? geminiBody.modelVersion : null,
          promptVersion: DOCUMENT_PROMPT_VERSION,
          schemaVersion: DOCUMENT_EXTRACTION_SCHEMA_VERSION,
          latencyMs: Date.now() - startedAt,
          attempts: attempt,
          usage: usageFrom(geminiBody),
        },
      };
    } catch (error) {
      if (error instanceof DocumentExtractionError) throw error;
      if (error instanceof Error && error.name === "AbortError") {
        throw new DocumentExtractionError("TIMEOUT", "La extracción superó el tiempo máximo.", true);
      }
      throw new DocumentExtractionError("NETWORK", "No se pudo contactar al proveedor de IA.", true);
    } finally {
      clearTimeout(timeout);
    }
  }
}
