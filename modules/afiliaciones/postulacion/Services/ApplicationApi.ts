"use client";

import type { Application } from "../Entities/Application";

import type { StartApplicationDto } from "../DTOs/start-application.dto";
import type { UpdateDraftDTO } from "../DTOs/update-draft.dto";

export class ApplicationApi {
  constructor(private readonly baseUrl = "/api/afiliaciones/postulacion") {}

  /**
   * ============================================
   * Iniciar una nueva postulación
   * ============================================
   */

  async start(dto: StartApplicationDto): Promise<Application> {
    return this.request<Application>(
      this.baseUrl,

      {
        method: "POST",

        body: JSON.stringify(dto),
      },
    );
  }

  /**
   * ============================================
   * Obtener una postulación
   * ============================================
   */

  async getByTracking(trackingCode: string): Promise<Application> {
    return this.request<Application>(
      `${this.baseUrl}/${trackingCode}`,

      {
        method: "GET",
      },
    );
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
    return this.request<Application>(
      `${this.baseUrl}/${trackingCode}`,

      {
        method: "PATCH",

        body: JSON.stringify(dto),
      },
    );
  }

  /**
   * ============================================
   * Enviar postulación
   * ============================================
   */

  async submit(trackingCode: string): Promise<Application> {
    return this.request<Application>(
      `${this.baseUrl}/${trackingCode}/submit`,

      {
        method: "POST",
      },
    );
  }

  /**
   * ============================================
   * Método privado para todas las llamadas HTTP
   * ============================================
   */

  private async request<T>(
    url: string,

    options: RequestInit,
  ): Promise<T> {
    const response = await fetch(
      url,

      {
        ...options,

        headers: {
          "Content-Type": "application/json",

          ...(options.headers ?? {}),
        },

        credentials: "include",
      },
    );

    const body = await response.json();

    if (!response.ok) {
      throw new Error(body.message ?? "Ha ocurrido un error.");
    }

    return body as T;
  }
}

export const applicationApi = new ApplicationApi();
