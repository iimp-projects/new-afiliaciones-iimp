import ExcelJS from "exceljs";
import { ExpedienteRepository } from "../Repositories/ExpedienteRepository";
import type { ExpedienteFilters } from "../Repositories/ExpedienteRepository";
import { documentTypeLabel } from "@/modules/shared/Utils/documentType";
import { formatPeruDateTime } from "@/modules/shared/Utils/formatPeruDateTime";
import { formatFullName } from "@/modules/shared/Utils/personName";

type ExpedienteRecord = Awaited<ReturnType<ExpedienteRepository["getAllFiltered"]>>[number];

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
  { header: "Asesoría Legal", code: "LEGAL" },
  { header: "Comunicaciones", code: "COMUNICACIONES" },
];

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

  private mapRow(record: ExpedienteRecord): Record<string, string | number> {
    const person = record.person;
    const fullName = formatFullName(person?.firstName, person?.paternalLastName, person?.maternalLastName) || "Postulante desconocido";

    const isStudent = record.affiliateType === "STUDENT";
    const lastPayment = record.payments?.[0];
    const approvedCount = record.approvals?.filter((a) => a.status === "APPROVED").length || 0;

    const row: Record<string, string | number> = {
      "Código": record.trackingCode || record.applicationCode || "",
      "Tipo de Documento": documentTypeLabel(record.documentType),
      "N° Documento": record.documentNumber,
      "Nombres y Apellidos": fullName,
      "Modalidad": isStudent ? "Asociado Estudiante" : "Asociado Activo",
      "Estado": APPLICATION_STATUS_LABELS[record.status] ?? record.status,
      "Estado de Pago": isStudent ? "Gratuito" : lastPayment ? (lastPayment.status === "PAID" ? "Pagado" : "Pendiente") : "Sin pago",
      "Avales": isStudent ? "No aplica" : `${approvedCount}/2`,
    };

    for (const area of AREA_COLUMNS) {
      row[area.header] = this.areaStatus(record, area.code);
    }

    row["Email"] = record.email || "";
    row["Teléfono"] = record.phone || "";
    row["Fecha de Postulación"] = formatPeruDateTime(record.createdAt);
    row["Última Actualización"] = formatPeruDateTime(record.updatedAt);

    return row;
  }

  async execute(filters: Omit<ExpedienteFilters, "page" | "pageSize">, options: { isComite: boolean } = { isComite: false }): Promise<Buffer> {
    let records = await this.repository.getAllFiltered(filters);

    // Misma regla que el listado para el Comité Evaluador: solo expedientes
    // con Logística, Asociados y Avales en regla.
    if (options.isComite) {
      records = records.filter((record) => this.isComiteReady(record));
    }

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Plataforma de Afiliaciones IIMP";
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet("Expedientes");

    const headers = [
      "Código",
      "Tipo de Documento",
      "N° Documento",
      "Nombres y Apellidos",
      "Modalidad",
      "Estado",
      "Estado de Pago",
      "Avales",
      ...AREA_COLUMNS.map((area) => area.header),
      "Email",
      "Teléfono",
      "Fecha de Postulación",
      "Última Actualización",
    ];

    worksheet.columns = headers.map((header) => ({ header, key: header, width: header.length + 8 }));

    worksheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    worksheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFC5A059" } };
    worksheet.getRow(1).alignment = { vertical: "middle", horizontal: "center" };

    for (const record of records) {
      worksheet.addRow(this.mapRow(record));
    }

    worksheet.views = [{ state: "frozen", ySplit: 1 }];
    worksheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: headers.length } };

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }
}
