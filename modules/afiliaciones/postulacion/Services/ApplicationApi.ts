"use client";

import type { Application } from "../Entities/Application";
import type { StartApplicationDto } from "../DTOs/start-application.dto";
import type { UpdateDraftDTO } from "../DTOs/update-draft.dto";
import type { ValidationResponseDTO } from "../DTOs/validation-response.dto";
import { ApplicationApiError } from "./ApplicationApiError";

export class ApplicationApi {
  constructor(private readonly baseUrl = "/api/afiliaciones/postulacion") {}

  /**
   * ============================================
   * Iniciar una nueva postulación
   * ============================================
   */
  async start(dto: StartApplicationDto): Promise<Application> {
    return this.request<Application>(this.baseUrl, {
      method: "POST",
      body: JSON.stringify(dto),
    });
  }

  /**
   * ============================================
   * Obtener una postulación
   * ============================================
   */
  async getByTracking(trackingCode: string): Promise<Application> {
    return this.request<Application>(`${this.baseUrl}/${trackingCode}`, {
      method: "GET",
    });
  }

  /**
   * ============================================
   * Guardar borrador
   * ============================================
   */
  async updateDraft(
    trackingCode: string,
    dto: UpdateDraftDTO,
  ): Promise<Application> {
    return this.request<Application>(`${this.baseUrl}/${trackingCode}`, {
      method: "PATCH",
      body: JSON.stringify(dto),
    });
  }

  /**
   * ============================================
   * Enviar postulación
   * ============================================
   */
  async submit(trackingCode: string): Promise<Application> {
    return this.request<Application>(`${this.baseUrl}/${trackingCode}/submit`, {
      method: "POST",
    });
  }

  /**
   * ============================================
   * Orquestador Inicial: Validar Documento
   * ============================================
   */
  async validateDocument(
    documentType: string,
    documentNumber: string,
    affiliateType?: "ACTIVE" | "STUDENT",
  ): Promise<ValidationResponseDTO> {
    return this.request<ValidationResponseDTO>(
      `${this.baseUrl}/validate-document`,
      {
        method: "POST",
        body: JSON.stringify({ documentType, documentNumber, ...(affiliateType ? { affiliateType } : {}) }),
      }
    );
  }


/**
   * ============================================
   * Enviar código OTP (Soporta EMAIL o SMS)
   * ============================================
   */
 async sendRecoveryOtp(trackingCode: string, channel: 'EMAIL' | 'SMS' | 'WHATSAPP' = 'EMAIL'): Promise<{ success: boolean; message: string }> {
    return this.request<{ success: boolean; message: string }>(`${this.baseUrl}/send-otp`, {
      method: "POST",
      body: JSON.stringify({ trackingCode, channel }),
    });
  }


  async verifyRecoveryOtp(
    trackingCode: string,
    code: string,
  ): Promise<{ message: string }> {
    return this.request<{ message: string }>(`${this.baseUrl}/verify-otp`, {
      method: "POST",
      body: JSON.stringify({ trackingCode, code }),
    });
  }



  /**
   * ============================================
   * Subida de Archivos a S3
   * ============================================
   */
  async uploadFile(
    file: File,
    folder: string,
  ): Promise<{ url: string; name: string; type: string }> {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("folder", folder);

    const response = await fetch(`${this.baseUrl}/upload`, {
      method: "POST",
      body: formData,
    });

    const result = await response.json();
    if (!response.ok || !result.success)
      throw new Error(result.message ?? "Error subiendo archivo.");
    
    return result.data;
  }

  /**
   * ============================================
   * Obtener URL Firmada Temporal de S3
   * ============================================
   */
  async getSecureFileUrl(s3Url: string): Promise<string> {
    const response = await fetch(`${this.baseUrl}/file?url=${encodeURIComponent(s3Url)}`, {
      method: "GET",
    });
    const result = await response.json();
    if (!response.ok || !result.success) throw new Error("Error obteniendo archivo seguro.");
    return result.data.url;
  }

  /**
   * ============================================
   * BÚSQUEDA DE EMPRESA POR RUC (SUNAT)
   * ============================================
   */
  async validateRuc(ruc: string): Promise<any> {
    const response = await fetch(`${this.baseUrl}/validate-ruc`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ruc }),
    });

    const result = await response.json();
    if (!response.ok || !result.success) throw new Error(result.message ?? "Error consultando RUC.");
    
    return result.data;
  }

  async lookupRuc(ruc: string): Promise<{ status: "VERIFIED"; data: any } | { status: "NOT_FOUND" | "SERVICE_ERROR"; message: string }> {
    const response = await fetch(`${this.baseUrl}/validate-ruc`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ruc }) });
    const result = await response.json();
    if (response.ok && result.success) return { status: "VERIFIED", data: result.data };
    if (result.status === "NOT_FOUND" || result.status === "SERVICE_ERROR") return { status: result.status, message: result.message };
    throw new Error(result.message ?? "Error consultando RUC.");
  }

  /**
   * ============================================
   * BÚSQUEDA DE AVAL (ASOCIADO ACTIVO)
   * ============================================
   */
  async validateSponsor(documentNumber: string, applicationId: number): Promise<{ eligible: true; sponsorFullName: string; sponsorEmail: string; sponsorCode: string; sponsorPersonId: number }> {
    const response = await fetch(`${this.baseUrl}/validate-sponsor`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ documentNumber, applicationId }),
    });

    const result = await response.json();
    if (!response.ok || !result.success) throw new Error(result.message ?? "Error consultando el Aval.");
    
    return result.data;
  }
  
  /**
   * ============================================
   * Generar PDF Resumen de Postulación
   * ============================================
   */
  async generatePdf(draft: any): Promise<Blob> {
    const response = await fetch(`${this.baseUrl}/generate-pdf`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ draft }),
    });

    if (!response.ok) {
      throw new Error("No se pudo generar el documento PDF.");
    }

    // Retornamos un Blob nativo porque el backend devuelve los bytes (Uint8Array) del PDF
    return await response.blob();
  }

  /**
   * ============================================
   * Método privado para todas las llamadas HTTP
   * ============================================
   */
  private async request<T>(url: string, options: RequestInit): Promise<T> {
    const response = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options.headers ?? {}),
      },
      credentials: "include",
    });

    const body = await response.json();

    if (!response.ok) {
      const error = new ApplicationApiError(body.message ?? body.error ?? (response.status === 422 ? "Revisa los campos indicados." : "No se pudo procesar la solicitud."), body.code || (response.status === 422 ? "VALIDATION_ERROR" : "INTERNAL_ERROR"), response.status, body.errors);
      if (error.functional && typeof window !== "undefined") window.dispatchEvent(new CustomEvent("application:flow", { detail: { code: error.code, message: error.message } }));
      throw error;
    }

    return body as T;
  }
}

export const applicationApi = new ApplicationApi();
