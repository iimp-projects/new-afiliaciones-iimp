import ExcelJS from "exceljs";
import { ExpedienteRepository } from "../Repositories/ExpedienteRepository";
import type { ExpedienteFilters } from "../Repositories/ExpedienteRepository";
import { documentTypeLabel } from "@/modules/shared/Utils/documentType";
import { formatPeruDateTime } from "@/modules/shared/Utils/formatPeruDateTime";
import { formatFullName } from "@/modules/shared/Utils/personName";
import {
  EXPEDIENTE_DOCUMENT_SLOTS,
  buildCurrentExpedienteDocuments,
  buildExpedienteDocumentCells,
  buildExpedienteDocumentLink,
} from "./ExpedienteDocumentCatalog";

type ExpedienteRecord = Awaited<ReturnType<ExpedienteRepository["getAllFiltered"]>>[number];
type ExcelCellValue =
  | string
  | number
  | { text: string; hyperlink: string; tooltip?: string };

const APPLICATION_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Borrador",
  PENDING: "Pendiente",
  UNDER_EVALUACION: "En Evaluación",
  OBSERVED: "Observado",
  RESOLVED: "Subsanado",
  READY_FOR_PAYMENT: "Apto para Pago",
  COMPLETED: "Completado",
  REJECTED: "Rechazado",
};

const VALIDATION_STATUS_LABELS: Record<string, string> = {
  PENDING: "Pendiente",
  UNDER_EVALUATION: "En Evaluación",
  OBSERVED: "Observado",
  RESOLVED: "Subsanado",
  APPROVED: "Aprobado",
  REJECTED: "Rechazado",
};

const AREA_COLUMNS: Array<{ header: string; code: string }> = [
  { header: "Asociados", code: "ASOCIADOS" },
  { header: "Logística", code: "LOGISTICA" },
  { header: "Comité", code: "COMITE" },
];

const AREA_REVIEWER_COLUMNS: Array<{ header: string; code: string }> = [
  { header: "Revisor Asociados", code: "ASOCIADOS" },
  { header: "Revisor Logística", code: "LOGISTICA" },
  { header: "Revisor Comité", code: "COMITE" },
];

const SPONSOR_COLUMNS = ["Aval 1", "Aval 2"] as const;
const SPONSOR_FIELDS = [
  { header: "Nombre", key: "name" },
  { header: "Celular", key: "phone" },
  { header: "Correo", key: "email" },
] as const;

const COLUMNS = {
  code: "Código",
  documentType: "Tipo de Documento",
  documentNumber: "N° Documento",
  fullName: "Nombres y Apellidos",
  modality: "Modalidad",
  status: "Estado",
  paymentStatus: "Estado de Pago",
  approvals: "Avales",
  email: "Email",
  phone: "Teléfono",
  createdAt: "Fecha de Postulación",
  updatedAt: "Última Actualización",
} as const;

const DOCUMENT_COLUMNS = {
  code: "Código",
  document: "Documento",
  file: "Archivo",
  uploaded: "Cargado",
  link: "Enlace",
} as const;

/**
 * Genera el Excel de expedientes aplicando exactamente los mismos filtros que
 * el listado. Devuelve el workbook como Buffer para responder como descarga.
 */
export class ExportExpedientesService {
  constructor(private readonly repository: ExpedienteRepository) {}

  private isComiteReady(record: ExpedienteRecord): boolean {
    const isStudent = String(record.affiliateType).toUpperCase() === "STUDENT";

    const logistica = record.validations?.find((v) => String(v.department?.code).toUpperCase() === "LOGISTICA");
    const asociados = record.validations?.find((v) => String(v.department?.code).toUpperCase() === "ASOCIADOS");

    const logisticaOk = logistica?.status === "APPROVED" || logistica?.status === "RESOLVED";
    const asociadosOk = asociados?.status === "APPROVED" || asociados?.status === "RESOLVED";

    const avalesAprobados = record.approvals?.filter((a) => a.status === "APPROVED").length || 0;
    const avalesListos = isStudent || avalesAprobados >= 2;

    return logisticaOk && asociadosOk && avalesListos;
  }

  private areaStatus(record: ExpedienteRecord, code: string): string {
    const validation = record.validations?.find((v) => v.department?.code === code);
    return validation ? (VALIDATION_STATUS_LABELS[validation.status] ?? validation.status) : "Sin asignar";
  }

  private reviewerName(record: ExpedienteRecord, code: string): string {
    const validation = record.validations?.find((item) => item.department?.code === code);
    if (!validation) return "Sin asignar";
    const person = validation.validatedBy?.person;
    if (!person) return "Sin revisor";
    return formatFullName(
      person.firstName,
      person.paternalLastName,
      person.maternalLastName,
    ) || "Sin revisor";
  }

  private sponsorDetails(approval: ExpedienteRecord["approvals"][number]) {
    const person = approval.sponsorPerson;
    if (!person) return { name: "", phone: "", email: "" };

    const contacts = person.contacts ?? [];
    const primary = contacts.find((contact) => contact.isPrimary) ?? contacts[0];

    return {
      name:
        formatFullName(
          person.firstName,
          person.paternalLastName,
          person.maternalLastName,
        ) || "",
      phone: primary?.phoneNumber ?? "",
      email: primary?.email ?? person.user?.email ?? "",
    };
  }

  private mapRow(record: ExpedienteRecord): Record<string, ExcelCellValue> {
    const person = record.person;
    const fullName = person
      ? `${person.firstName} ${person.paternalLastName} ${person.maternalLastName || ""}`.trim()
      : "Postulante desconocido";

    const isStudent = record.affiliateType === "STUDENT";
    const lastPayment = record.payments?.[0];
    const approvedCount = record.approvals?.filter((a) => a.status === "APPROVED").length || 0;
    const currentDocuments = buildCurrentExpedienteDocuments(record);
    const documentCells = buildExpedienteDocumentCells(currentDocuments);

    const row: Record<string, ExcelCellValue> = {
      [COLUMNS.code]: record.trackingCode || record.applicationCode || "",
      [COLUMNS.documentType]: documentTypeLabel(record.documentType),
      [COLUMNS.documentNumber]: record.documentNumber,
      [COLUMNS.fullName]: fullName,
      [COLUMNS.modality]: isStudent ? "Asociado Estudiante" : "Asociado Activo",
      [COLUMNS.status]: APPLICATION_STATUS_LABELS[record.status] ?? record.status,
      [COLUMNS.paymentStatus]: isStudent ? "Gratuito" : lastPayment ? (lastPayment.status === "PAID" ? "Pagado" : "Pendiente") : "Sin pago",
      [COLUMNS.approvals]: isStudent ? "No aplica" : `${approvedCount}/2`,
    };

    const sponsors = isStudent
      ? []
      : (record.approvals ?? []).slice(0, SPONSOR_COLUMNS.length).map((approval) =>
          this.sponsorDetails(approval),
        );

    for (const [index, column] of SPONSOR_COLUMNS.entries()) {
      const details = sponsors[index];
      for (const field of SPONSOR_FIELDS) {
        row[`${column} ${field.header}`] = isStudent
          ? "No aplica"
          : (details?.[field.key] ?? "");
      }
    }

    for (const area of AREA_COLUMNS) {
      row[area.header] = this.areaStatus(record, area.code);
    }

    for (const area of AREA_REVIEWER_COLUMNS) {
      row[area.header] = this.reviewerName(record, area.code);
    }

    for (const { label } of EXPEDIENTE_DOCUMENT_SLOTS) {
      row[label] = documentCells.get(label) ?? "";
    }

    row[COLUMNS.email] = record.email || "";
    row[COLUMNS.phone] = record.phone || "";
    row[COLUMNS.createdAt] = formatPeruDateTime(record.createdAt);
    row[COLUMNS.updatedAt] = formatPeruDateTime(record.updatedAt);

    return row;
  }

  async getRecords(
    filters: Omit<ExpedienteFilters, "page" | "pageSize">,
    options: { isComite: boolean } = { isComite: false },
  ): Promise<ExpedienteRecord[]> {
    let records = await this.repository.getAllFiltered(filters);

    // Misma regla que el listado para el ComitǸ Evaluador: solo expedientes
    // con Log��stica, Asociados y Avales en regla.
    if (options.isComite) {
      records = records.filter((record) => this.isComiteReady(record));
    }

    return records;
  }

  async execute(filters: Omit<ExpedienteFilters, "page" | "pageSize">, options: { isComite: boolean } = { isComite: false }): Promise<Buffer> {
    return this.buildBuffer(await this.getRecords(filters, options));
  }

  async buildBuffer(records: ExpedienteRecord[]): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Plataforma de Afiliaciones IIMP";
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet("Expedientes");

    const headers = [
      COLUMNS.code,
      COLUMNS.documentType,
      COLUMNS.documentNumber,
      COLUMNS.fullName,
      COLUMNS.modality,
      COLUMNS.status,
      COLUMNS.paymentStatus,
      COLUMNS.approvals,
      ...SPONSOR_COLUMNS.flatMap((column) =>
        SPONSOR_FIELDS.map((field) => `${column} ${field.header}`),
      ),
      ...AREA_COLUMNS.map((area) => area.header),
      ...AREA_REVIEWER_COLUMNS.map((area) => area.header),
      ...EXPEDIENTE_DOCUMENT_SLOTS.map(({ label }) => label),
      COLUMNS.email,
      COLUMNS.phone,
      COLUMNS.createdAt,
      COLUMNS.updatedAt,
    ];

    worksheet.columns = headers.map((header) => ({
      header,
      key: header,
      width: EXPEDIENTE_DOCUMENT_SLOTS.some(({ label }) => label === header)
        ? 55
        : header.length + 8,
    }));

    worksheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    worksheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFC5A059" } };
    worksheet.getRow(1).alignment = { vertical: "middle", horizontal: "center" };

    for (const record of records) {
      worksheet.addRow(this.mapRow(record));
    }

    worksheet.views = [{ state: "frozen", ySplit: 1 }];
    worksheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: headers.length } };

    const documentsSheet = workbook.addWorksheet("Documentos");
    const documentHeaders = [
      DOCUMENT_COLUMNS.code,
      DOCUMENT_COLUMNS.document,
      DOCUMENT_COLUMNS.file,
      DOCUMENT_COLUMNS.uploaded,
      DOCUMENT_COLUMNS.link,
    ];
    documentsSheet.columns = documentHeaders.map((header) => ({
      header,
      key: header,
      width:
        header === DOCUMENT_COLUMNS.link
          ? 80
          : header === DOCUMENT_COLUMNS.file
            ? 46
            : header === DOCUMENT_COLUMNS.document
              ? 30
              : 24,
    }));
    documentsSheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    documentsSheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFB58B35" } };
    documentsSheet.getRow(1).alignment = { vertical: "middle", horizontal: "center" };

    for (const record of records) {
      const code = record.trackingCode || record.applicationCode || String(record.id);
      for (const document of buildCurrentExpedienteDocuments(record)) {
        const link = buildExpedienteDocumentLink(document.fileUrl);
        documentsSheet.addRow({
          [DOCUMENT_COLUMNS.code]: code,
          [DOCUMENT_COLUMNS.document]: document.label,
          [DOCUMENT_COLUMNS.file]: { text: document.fileName, hyperlink: link },
          [DOCUMENT_COLUMNS.uploaded]: formatPeruDateTime(document.uploadedAt),
          [DOCUMENT_COLUMNS.link]: { text: link, hyperlink: link, tooltip: link },
        });
      }
    }

    documentsSheet.views = [{ state: "frozen", ySplit: 1 }];
    documentsSheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: documentHeaders.length },
    };

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }
}
