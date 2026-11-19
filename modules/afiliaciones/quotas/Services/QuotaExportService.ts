import ExcelJS from "exceljs";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { QuotaAdminFilters } from "../Models/QuotaAdmin";
import type { QuotaDashboardService } from "./QuotaDashboardService";
import type { QuotaHistoryService } from "./QuotaHistoryService";
import type { QuotaIncidenceService } from "./QuotaIncidenceService";
import type { QuotaQueryService } from "./QuotaQueryService";

export type QuotaExportType = "associates" | "history" | "pending" | "incidences" | "summary";

export type QuotaExportOptions = {
  type: QuotaExportType;
  filters: QuotaAdminFilters;
  canViewDocument: boolean;
  actorUserId: number | null;
};

export type QuotaExportResult = { buffer: Buffer; filename: string; rowCount: number; truncated: boolean };
export type QuotaExportAudit = (entry: { actorUserId: number | null; type: QuotaExportType; rowCount: number; truncated: boolean; filters: Record<string, unknown> }) => Promise<void>;

async function defaultAudit(entry: { actorUserId: number | null; type: QuotaExportType; rowCount: number; truncated: boolean; filters: Record<string, unknown> }): Promise<void> {
  await prisma.auditLog.create({
    data: {
      userId: entry.actorUserId,
      action: "EXPORT_QUOTAS",
      entity: "QuotaExport",
      entityId: entry.type,
      newValues: {
        type: entry.type,
        rowCount: entry.rowCount,
        truncated: entry.truncated,
        filters: entry.filters as Prisma.InputJsonValue,
      },
    },
  });
}

const MAX_EXPORT_ROWS = 50_000;

function safeCell(value: unknown): string | number | null {
  if (value == null) return null;
  if (typeof value === "number") return value;
  const text = String(value).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");
  return /^[=+\-@]/.test(text) ? `'${text}` : text;
}

function cleanFilters(filters: QuotaAdminFilters): Record<string, unknown> {
  return Object.fromEntries(Object.entries({
    ...filters,
    page: undefined,
    pageSize: undefined,
    search: filters.search ? "[REDACTADO]" : undefined,
  }).filter(([, value]) => value !== undefined));
}

function addMetadataSheet(workbook: ExcelJS.Workbook, options: QuotaExportOptions, rowCount: number, truncated: boolean): void {
  const sheet = workbook.addWorksheet("Información");
  sheet.columns = [
    { header: "Campo", key: "field", width: 32 },
    { header: "Valor", key: "value", width: 90 },
  ];
  const filters = cleanFilters(options.filters);
  const rows = [
    { field: "Generado", value: new Date().toISOString() },
    { field: "Tipo de exportación", value: options.type },
    { field: "Origen", value: "PostgreSQL local_bd_afiliaciones - cuotas SIE" },
    { field: "Criterios", value: JSON.stringify(filters) },
    { field: "Filas exportadas", value: rowCount },
    { field: "Truncado", value: truncated ? `Sí (máximo ${MAX_EXPORT_ROWS})` : "No" },
    { field: "Nota monetaria", value: "PEN y USD se reportan en columnas separadas. No se suman monedas distintas." },
    { field: "Nota contable", value: "FACTURADO no equivale a PAGADO. PENDIENTE no equivale automáticamente a deuda exigible." },
  ];
  for (const row of rows) sheet.addRow({ field: row.field, value: safeCell(row.value) });
  sheet.getRow(1).font = { bold: true };
}

function addDataSheet(workbook: ExcelJS.Workbook, name: string, columns: Array<{ header: string; key: string; width: number; text?: boolean }>, rows: Array<Record<string, unknown>>): void {
  const sheet = workbook.addWorksheet(name);
  sheet.columns = columns.map((column) => ({ header: column.header, key: column.key, width: column.width, style: column.text ? { numFmt: "@" } : undefined }));
  for (const row of rows) sheet.addRow(Object.fromEntries(Object.entries(row).map(([key, value]) => [key, safeCell(value)])));
  sheet.getRow(1).font = { bold: true };
  sheet.views = [{ state: "frozen", ySplit: 1 }];
}

export class QuotaExportService {
  constructor(
    private readonly dashboard: QuotaDashboardService,
    private readonly query: QuotaQueryService,
    private readonly history: QuotaHistoryService,
    private readonly incidences: QuotaIncidenceService,
    private readonly audit: QuotaExportAudit = defaultAudit,
  ) {}

  async build(options: QuotaExportOptions): Promise<QuotaExportResult> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "IIMP - Afiliaciones";
    workbook.created = new Date();
    let rowCount = 0;
    let truncated = false;

    if (options.type === "associates") {
      const page = await this.query.listAssociates({ ...options.filters, page: 1, pageSize: MAX_EXPORT_ROWS }, options.canViewDocument);
      truncated = page.meta.total > MAX_EXPORT_ROWS;
      rowCount = page.data.length;
      addMetadataSheet(workbook, options, rowCount, truncated);
      addDataSheet(workbook, "Asociados", [
        { header: "Código Institucional", key: "code", width: 18, text: true },
        { header: "Nombre", key: "name", width: 34 },
        { header: "Tipo Documento", key: "documentType", width: 16 },
        { header: "Documento", key: "documentNumber", width: 18, text: true },
        { header: "Categoría", key: "category", width: 20 },
        { header: "Estado Membresía", key: "membership", width: 20 },
        { header: "Cobertura", key: "coverage", width: 16 },
        { header: "Estado Financiero", key: "financialStatus", width: 18 },
        { header: "Cuotas", key: "quotaCount", width: 10 },
        { header: "Facturadas", key: "facturadoCount", width: 12 },
        { header: "Pendientes", key: "pendienteCount", width: 12 },
        { header: "Facturado PEN", key: "facturadoPen", width: 16 },
        { header: "Facturado USD", key: "facturadoUsd", width: 16 },
        { header: "Pendiente PEN", key: "pendientePen", width: 16 },
        { header: "Pendiente USD", key: "pendienteUsd", width: 16 },
        { header: "Años pendientes", key: "pendingYears", width: 20 },
        { header: "Última sincronización", key: "lastSync", width: 22 },
      ], page.data.map((row) => ({
        code: row.institutionalCode ?? "",
        name: row.fullName,
        documentType: row.documentType,
        documentNumber: row.documentNumber ?? "",
        category: row.categoryName ?? row.categoryCode ?? "Sin categoría",
        membership: row.membershipStatus ?? "Sin estado",
        coverage: row.coverageStatus,
        financialStatus: row.financialStatus,
        quotaCount: row.quotaCount,
        facturadoCount: row.facturadoCount,
        pendienteCount: row.pendienteCount,
        facturadoPen: row.facturadoPen,
        facturadoUsd: row.facturadoUsd,
        pendientePen: row.pendientePen,
        pendienteUsd: row.pendienteUsd,
        pendingYears: row.pendingYears.join(", "),
        lastSync: row.lastSync?.toISOString() ?? "",
      })));
    } else if (options.type === "history" || options.type === "pending") {
      const filters = options.type === "pending" ? { ...options.filters, concept: "CUOTA" as const, accountingStatus: "PENDIENTE" as const } : options.filters;
      const page = await this.history.listForExport(filters, options.canViewDocument, MAX_EXPORT_ROWS);
      truncated = page.meta.total > MAX_EXPORT_ROWS;
      rowCount = page.data.length;
      addMetadataSheet(workbook, options, rowCount, truncated);
      addDataSheet(workbook, options.type === "pending" ? "Cuotas pendientes" : "Histórico", [
        { header: "Código Institucional", key: "code", width: 18, text: true },
        { header: "Asociado", key: "person", width: 32 },
        { header: "Documento", key: "documentNumber", width: 18, text: true },
        { header: "Categoría", key: "category", width: 18 },
        { header: "Concepto", key: "concept", width: 14 },
        { header: "N° Cuota", key: "quotaNumber", width: 10 },
        { header: "Año", key: "year", width: 8 },
        { header: "Moneda", key: "currency", width: 8 },
        { header: "Importe", key: "amount", width: 14 },
        { header: "Estado contable", key: "status", width: 14 },
        { header: "Inicio período", key: "periodStart", width: 14 },
        { header: "Fin período", key: "periodEnd", width: 14 },
        { header: "Fecha pago reportada", key: "paidAt", width: 18 },
        { header: "Serie comprobante", key: "receiptSerie", width: 16, text: true },
        { header: "N° comprobante", key: "receiptNumber", width: 16, text: true },
        { header: "Origen", key: "provider", width: 10 },
        { header: "Última sincronización", key: "lastSeenAt", width: 22 },
        { header: "Presente última sync", key: "present", width: 18 },
      ], page.data.map((row) => ({
        code: row.institutionalCode ?? "",
        person: row.personName ?? "",
        documentNumber: row.documentNumber ?? "",
        category: row.categoryName ?? row.categoryCode ?? "Sin categoría",
        concept: row.concept,
        quotaNumber: row.quotaNumber ?? "",
        year: row.year,
        currency: row.currency,
        amount: row.amount,
        status: row.accountingStatus,
        periodStart: row.periodStart ?? "",
        periodEnd: row.periodEnd ?? "",
        paidAt: row.paidAt ?? "",
        receiptSerie: row.receiptSerie ?? "",
        receiptNumber: row.receiptNumber ?? "",
        provider: row.provider,
        lastSeenAt: row.lastSeenAt.toISOString(),
        present: row.isPresentInLastSuccessfulSync ? "Sí" : "No",
      })));
    } else if (options.type === "incidences") {
      const page = await this.incidences.listForExport({ ...options.filters, includeResolved: true }, MAX_EXPORT_ROWS);
      truncated = page.meta.total > MAX_EXPORT_ROWS;
      rowCount = page.data.length;
      addMetadataSheet(workbook, options, rowCount, truncated);
      addDataSheet(workbook, "Incidencias", [
        { header: "Item", key: "itemId", width: 10 },
        { header: "Persona", key: "personId", width: 10 },
        { header: "Código Institucional", key: "code", width: 18, text: true },
        { header: "Estado sync", key: "status", width: 14 },
        { header: "Código error", key: "errorCode", width: 28 },
        { header: "Intentos", key: "attempts", width: 10 },
        { header: "Categoría", key: "category", width: 14 },
        { header: "Inicio", key: "startedAt", width: 22 },
        { header: "Fin", key: "finishedAt", width: 22 },
        { header: "Resuelto", key: "resolved", width: 10 },
      ], page.data.map((row) => ({
        itemId: row.itemId,
        personId: row.personId ?? "",
        code: row.institutionalCode ?? "",
        status: row.status,
        errorCode: row.errorCode ?? "",
        attempts: row.attempts,
        category: row.categoryCode ?? "",
        startedAt: row.startedAt.toISOString(),
        finishedAt: row.finishedAt?.toISOString() ?? "",
        resolved: row.resolved ? "Sí" : "No",
      })));
    } else {
      const summary = await this.dashboard.getSummary();
      addMetadataSheet(workbook, options, 0, false);
      addDataSheet(workbook, "Resumen", [
        { header: "Indicador", key: "indicator", width: 46 },
        { header: "Valor", key: "value", width: 24 },
      ], [
        { indicator: "Universo", value: summary.universe.total },
        { indicator: "Con información financiera", value: summary.universe.withFinancialInfo },
        { indicator: "Con cuotas pendientes (CUOTA)", value: summary.universe.withPending },
        { indicator: "Sin cuotas pendientes reportadas", value: summary.universe.withoutPending },
        { indicator: "Sin información", value: summary.universe.noInfo },
        { indicator: "No encontrados", value: summary.universe.notFound },
        { indicator: "Con incidencias", value: summary.universe.withIncidences },
        { indicator: "Total registros", value: summary.records.total },
        { indicator: "Total cuotas", value: summary.records.quotas },
        { indicator: "Total inscripciones", value: summary.records.inscriptions },
      ]);
      addDataSheet(workbook, "Por moneda", [
        { header: "Concepto", key: "concept", width: 14 },
        { header: "Moneda", key: "currency", width: 8 },
        { header: "Estado", key: "status", width: 14 },
        { header: "Cantidad", key: "count", width: 12 },
        { header: "Importe", key: "amount", width: 16 },
      ], [
        ...summary.cuota.facturadoByCurrency.map((row) => ({ concept: "CUOTA", currency: row.currency, status: "FACTURADO", count: row.count, amount: row.amount })),
        ...summary.cuota.pendienteByCurrency.map((row) => ({ concept: "CUOTA", currency: row.currency, status: "PENDIENTE", count: row.count, amount: row.amount })),
        ...summary.inscripcion.facturadoByCurrency.map((row) => ({ concept: "INSCRIPCION", currency: row.currency, status: "FACTURADO", count: row.count, amount: row.amount })),
        ...summary.inscripcion.pendienteByCurrency.map((row) => ({ concept: "INSCRIPCION", currency: row.currency, status: "PENDIENTE", count: row.count, amount: row.amount })),
      ]);
      addDataSheet(workbook, "Por año", [
        { header: "Año", key: "year", width: 8 },
        { header: "Concepto", key: "concept", width: 14 },
        { header: "Moneda", key: "currency", width: 8 },
        { header: "Estado", key: "status", width: 14 },
        { header: "Cantidad", key: "count", width: 12 },
        { header: "Importe", key: "amount", width: 16 },
      ], summary.byYear.map((row) => ({ year: row.year, concept: row.concept, currency: row.currency, status: row.accountingStatus, count: row.count, amount: row.amount })));
      addDataSheet(workbook, "Por categoría", [
        { header: "Código", key: "code", width: 10, text: true },
        { header: "Categoría", key: "name", width: 24 },
        { header: "Asociados", key: "associates", width: 12 },
        { header: "Registros", key: "records", width: 12 },
      ], summary.byCategory.map((row) => ({ code: row.categoryCode, name: row.categoryName, associates: row.associates, records: row.records })));
      rowCount = summary.byYear.length;
    }

    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
    const stamp = new Date().toISOString().slice(0, 10);
    const filename = `Cuotas_${options.type}_${stamp}.xlsx`;
    await this.audit({ actorUserId: options.actorUserId, type: options.type, rowCount, truncated, filters: cleanFilters(options.filters) });
    return { buffer, filename, rowCount, truncated };
  }
}
