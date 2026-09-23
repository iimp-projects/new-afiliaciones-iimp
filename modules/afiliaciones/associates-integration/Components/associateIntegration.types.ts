export type AssociateIntegrationStatus = "PENDING" | "PROCESSING" | "SYNCED" | "RETRYABLE" | "FAILED";

export type AssociateIntegrationFiltersValue = {
  status: string;
  trigger: string;
  affiliateType: string;
  search: string;
  dateFrom: string;
  dateTo: string;
};

export type AssociateIntegrationRow = {
  integrationId: number;
  applicationId: number;
  applicationCode: string;
  trackingCode: string;
  affiliateType: "ACTIVE" | "STUDENT";
  trigger: "ACTIVE_PAYMENT" | "STUDENT_COMPLETION";
  status: AssociateIntegrationStatus;
  attempts: number;
  externalAssociateCode?: number | null;
  lastAttemptAt?: string | null;
  associate?: { fullName: string; documentType: string | null; maskedDocumentNumber: string } | null;
  billing?: { receiptType: string | null; billingDocumentType: string | null; maskedBillingDocument: string; businessName?: string | null; billingAddressAvailable?: boolean };
};

export type AssociateIntegrationAttempt = {
  attemptNumber: number;
  startedAt: string;
  finishedAt?: string | null;
  result?: "SYNCED" | "RETRYABLE" | "FAILED" | null;
  httpStatus?: number | null;
  errorCode?: string | null;
  message?: string | null;
  errorIdentifier?: string | null;
  externalAssociateCode?: number | null;
  externalMessage?: string | null;
  durationMs?: number | null;
};

export type AssociateIntegrationDetail = AssociateIntegrationRow & {
  createdAt?: string | null;
  syncedAt?: string | null;
  updatedAt?: string | null;
  externalMessage?: string | null;
  externalReceiptType?: string | null;
  externalReceiptSerie?: string | null;
  externalReceiptNumber?: string | null;
  externalReceiptPdfReference?: string | null;
  lastErrorHttpStatus?: number | null;
  lastErrorCode?: string | null;
  lastErrorMessage?: string | null;
  lastErrorIdentifier?: string | null;
  attemptHistory?: AssociateIntegrationAttempt[];
  associate: { fullName: string; documentType: string | null; maskedDocumentNumber: string; addressAvailable: boolean };
  billing: { receiptType: string | null; billingDocumentType: string | null; maskedBillingDocument: string; businessName?: string | null; billingAddressAvailable: boolean };
  services: Array<{ concepto: string; anno: number; moneda: string; monto: number; cortesia: boolean }>;
  result: { externalAssociateCode?: number | null; externalMessage?: string | null; receiptType?: string | null; serie?: string | null; numero?: string | null; pdfReference?: string | null };
  error: { httpStatus?: number | null; code?: string | null; message?: string | null; identifier?: string | null };
  sanitizedPayloadPreview: { Tipo?: string; NumDocumento?: string; TipoFacturacion?: string; servicios?: Array<{ concepto?: string; anno?: number; monto?: number; cortesia?: boolean }> };
  application?: { applicationCode?: string; trackingCode?: string; affiliateType?: "ACTIVE" | "STUDENT" };
};

export const statusLabels: Record<AssociateIntegrationStatus, string> = { PENDING: "Pendiente", PROCESSING: "Procesando", SYNCED: "Sincronizado", RETRYABLE: "Reintento disponible", FAILED: "Requiere revisión" };
export const statusColors: Record<AssociateIntegrationStatus, string> = { PENDING: "border-amber-200 bg-amber-50 text-amber-700", PROCESSING: "border-sky-200 bg-sky-50 text-sky-700", SYNCED: "border-emerald-200 bg-emerald-50 text-emerald-700", RETRYABLE: "border-orange-200 bg-orange-50 text-orange-700", FAILED: "border-rose-200 bg-rose-50 text-rose-700" };
export const affiliateLabels = { ACTIVE: "Activo", STUDENT: "Estudiante" };
export const triggerLabels = { ACTIVE_PAYMENT: "Pago confirmado", STUDENT_COMPLETION: "Finalización estudiante" };
export const emptyAssociateIntegrationFilters: AssociateIntegrationFiltersValue = { status: "", trigger: "", affiliateType: "", search: "", dateFrom: "", dateTo: "" };

export const formatAssociateIntegrationDate = (value?: string | null) => value ? new Intl.DateTimeFormat("es-PE", { dateStyle: "short", timeStyle: "short", timeZone: "America/Lima" }).format(new Date(value)) : "—";
export const maskAssociateIntegrationDocument = (value?: string) => value && value.length > 4 ? `${value.slice(0, 2)}••••${value.slice(-2)}` : value || "—";
