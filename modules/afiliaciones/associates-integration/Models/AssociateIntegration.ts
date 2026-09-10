import type { AssociateIntegrationAttemptResult, AssociateIntegrationStatus, AssociateIntegrationTrigger, Prisma } from "@prisma/client";

export type AssociateServiceSnapshot = {
  concepto: "INSCRIPCION" | "CUOTA";
  anno: number;
  moneda: "S/";
  monto: number;
  cortesia: boolean;
};

/** Immutable payload-shaped data. It intentionally excludes credentials and tokens. */
export type AssociateRequestPayloadSnapshot = {
  TipoDocumento: "1" | "4" | "7";
  NumDocumento: string;
  Tipo: "A" | "E";
  Nombres: string;
  ApellidoPaterno: string;
  ApellidoMaterno: string;
  Direccion: string;
  Telefono: string;
  Email: string;
  FechaNacimiento?: string;
  Sexo?: "M" | "F";
  TipoFacturacion: "01" | "03";
  TipDocFacturacion: "1" | "4" | "6" | "7";
  NumDocFacturacion: string;
  RazonSocial?: string;
  ApellidoPaternoFact?: string;
  ApellidoMaternoFact?: string;
  NombresFact?: string;
  DirFacturacion: string;
  NombreContactoFact?: string;
  CorreoContactoFact?: string;
  servicios: AssociateServiceSnapshot[];
};

export type AssociateIntegrationRecord = {
  id: number;
  applicationId: number;
  trigger: AssociateIntegrationTrigger;
  status: AssociateIntegrationStatus;
  requestPayloadSnapshot: AssociateRequestPayloadSnapshot;
  externalAssociateCode: number | null;
  externalMessage: string | null;
  attempts: number;
  lastAttemptAt: Date | null;
  syncedAt: Date | null;
  lastErrorHttpStatus: number | null;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  lastErrorIdentifier: string | null;
  lastErrorDetails: Prisma.JsonValue | null;
  externalReceiptType: string | null;
  externalReceiptSerie: string | null;
  externalReceiptNumber: string | null;
  externalReceiptPdfReference: string | null;
  createdAt: Date;
  updatedAt: Date;
};

/** Sanitized transport outcome. It deliberately contains neither payload nor credentials. */
export type AssociateIntegrationAttemptRecord = {
  id: number;
  integrationId: number;
  attemptNumber: number;
  startedAt: Date;
  finishedAt: Date | null;
  result: AssociateIntegrationAttemptResult | null;
  httpStatus: number | null;
  errorCode: string | null;
  message: string | null;
  errorIdentifier: string | null;
  errorDetails: Prisma.JsonValue | null;
  externalAssociateCode: number | null;
  externalMessage: string | null;
  durationMs: number | null;
};

export type AssociateIntegrationAttemptOutcome = {
  result: AssociateIntegrationAttemptResult;
  httpStatus?: number;
  errorCode?: string;
  message?: string;
  errorIdentifier?: string;
  errorDetails?: Prisma.InputJsonValue;
  externalAssociateCode?: number;
  externalMessage?: string;
  durationMs: number;
};
