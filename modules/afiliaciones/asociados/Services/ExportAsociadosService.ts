/* eslint-disable @typescript-eslint/no-explicit-any -- Prisma payloads are structurally mapped to Excel cells. */
import ExcelJS from "exceljs";
import type { DocumentCategory } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { documentTypeLabel } from "@/modules/shared/Utils/documentType";
import { formatPeruDateTime } from "@/modules/shared/Utils/formatPeruDateTime";
import { formatFullName } from "@/modules/shared/Utils/personName";
import { resolveAssociateCode } from "@/modules/shared/Utils/associateCode";
import {
  EXPEDIENTE_DOCUMENT_SLOTS,
  buildCurrentExpedienteDocuments,
  buildExpedienteDocumentCells,
  buildExpedienteDocumentLink,
} from "@/modules/afiliaciones/expedientes/Services/ExpedienteDocumentCatalog";
import { buildHistoricalWhere, buildV2Where, resolveInstitutionalCode } from "./asociadosQuery";

const USER_STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Activo",
  INACTIVE: "Inactivo",
  BLOCKED: "Suspendido",
  PENDING: "Pendiente",
};

const COLUMNS = {
  code: "Código Institucional",
  documentType: "Tipo de Documento",
  documentNumber: "N° Documento",
  fullName: "Nombres y Apellidos",
  membership: "Membresía",
  status: "Estado",
  origin: "Origen",
  email: "Email",
  phone: "Teléfono",
  createdAt: "Fecha de Registro",
  updatedAt: "Última Actualización",
} as const;

const SPONSOR_COLUMNS = ["Aval 1", "Aval 2"] as const;
const SPONSOR_FIELDS = [
  { header: "Nombre", key: "name" },
  { header: "Celular", key: "phone" },
  { header: "Correo", key: "email" },
] as const;

const AREA_REVIEWER_COLUMNS = [
  { header: "Revisor Asociados", code: "ASOCIADOS" },
  { header: "Revisor Logística", code: "LOGISTICA" },
  { header: "Revisor Comité", code: "COMITE" },
] as const;

const DOCUMENT_COLUMNS = {
  code: "Código Institucional",
  document: "Documento",
  file: "Archivo",
  uploaded: "Cargado",
  link: "Enlace",
} as const;

type ExcelCellValue =
  | string
  | number
  | { text: string; hyperlink: string; tooltip?: string };

interface AsociadoContact {
  isPrimary?: boolean | null;
  phoneNumber?: string | null;
  email?: string | null;
}

interface AsociadoSponsorPerson {
  firstName?: string | null;
  paternalLastName?: string | null;
  maternalLastName?: string | null;
  contacts?: AsociadoContact[] | null;
  user?: { email?: string | null } | null;
}

interface AsociadoApproval {
  sponsorPerson?: AsociadoSponsorPerson | null;
}

interface AsociadoReviewerPerson {
  firstName?: string | null;
  paternalLastName?: string | null;
  maternalLastName?: string | null;
}

interface AsociadoValidation {
  department?: { code?: string | null } | null;
  validatedBy?: { person?: AsociadoReviewerPerson | null } | null;
}

interface AsociadoApplicationSource {
  updatedAt: Date | string;
  draftData?: unknown;
  documents: Array<{
    category: DocumentCategory;
    fileUrl: string;
    fileName: string;
    mimeType: string;
    createdAt: Date | string;
    updatedAt: Date | string;
  }>;
  approvals?: AsociadoApproval[];
  validations?: AsociadoValidation[];
}

export interface AsociadoExportRecord {
  values: Record<string, ExcelCellValue>;
  application: AsociadoApplicationSource | null;
}

export interface ExportAsociadosFilters {
  search?: string;
  membershipType?: string;
  sort?: string;
}

function resolvePhone(contacts: AsociadoContact[] | undefined | null): string {
  const primary = contacts?.find((contact) => contact.isPrimary) ?? contacts?.[0];
  return primary?.phoneNumber || "";
}

function fullName(person: {
  firstName?: string | null;
  paternalLastName?: string | null;
  maternalLastName?: string | null;
} | null | undefined): string {
  if (!person) return "Sin nombre";
  return `${person.firstName ?? ""} ${person.paternalLastName ?? ""} ${person.maternalLastName ?? ""}`.trim() || "Sin nombre";
}

function reviewerName(
  validations: AsociadoValidation[] | undefined,
  code: string,
): string {
  const validation = validations?.find((item) => item.department?.code === code);
  if (!validation) return "Sin asignar";
  const person = validation.validatedBy?.person;
  if (!person) return "Sin revisor";
  return (
    formatFullName(person.firstName, person.paternalLastName, person.maternalLastName) ||
    "Sin revisor"
  );
}

function sponsorDetails(approval: AsociadoApproval) {
  const person = approval.sponsorPerson;
  if (!person) return { name: "", phone: "", email: "" };
  const contacts = person.contacts ?? [];
  const primary = contacts.find((contact) => contact.isPrimary) ?? contacts[0];

  return {
    name:
      formatFullName(person.firstName, person.paternalLastName, person.maternalLastName) ||
      "",
    phone: primary?.phoneNumber ?? "",
    email: primary?.email ?? person.user?.email ?? "",
  };
}

/**
 * Genera el Excel del padrón de asociados aplicando los mismos filtros que el
 * directorio (búsqueda, tipo de membresía y orden). Devuelve el workbook como
 * Buffer para responder como descarga.
 */
export class ExportAsociadosService {
  async getRecords(filters: ExportAsociadosFilters): Promise<AsociadoExportRecord[]> {
    const { search, membershipType, sort = "desc" } = filters;
    const orderByConfig =
      sort === "asc" ? ({ updatedAt: "asc" } as const) : ({ updatedAt: "desc" } as const);

    const [v2Rows, histRows] = await Promise.all([
      prisma.membershipApplication.findMany({
        where: buildV2Where(search, membershipType),
        orderBy: orderByConfig,
        include: {
          documents: true,
          approvals: {
            include: {
              sponsorPerson: {
                include: {
                  contacts: true,
                  user: { select: { email: true } },
                },
              },
            },
            orderBy: { id: "asc" },
          },
          validations: {
            include: { department: true, validatedBy: { include: { person: true } } },
            orderBy: { department: { displayOrder: "asc" } },
          },
          person: {
            include: {
              contacts: true,
              user: { include: { role: true } },
              sieAssociateRecords: { where: { linkStatus: "LINKED" }, include: { category: true } },
              applications: { where: { deletedAt: null }, include: { associateIntegration: true } },
            },
          },
        },
      }),
      prisma.sieAssociateRecord.findMany({
        where: buildHistoricalWhere(search, membershipType),
        orderBy: orderByConfig,
        include: {
          person: {
            include: {
              contacts: true,
              user: { include: { role: true } },
            },
          },
          category: true,
        },
      }),
    ]);

    const records: AsociadoExportRecord[] = [];

    for (const application of v2Rows) {
      const person = application.person;
      const isStudent = application.affiliateType === "STUDENT";
      const currentDocuments = buildCurrentExpedienteDocuments(application);
      const documentCells = buildExpedienteDocumentCells(currentDocuments);
      const sponsors = isStudent
        ? []
        : (application.approvals ?? [])
            .slice(0, SPONSOR_COLUMNS.length)
            .map((approval: AsociadoApproval) => sponsorDetails(approval));

      const values: Record<string, ExcelCellValue> = {
        [COLUMNS.code]: resolveAssociateCode(person) ?? resolveInstitutionalCode(person) ?? "",
        [COLUMNS.documentType]: documentTypeLabel(application.documentType),
        [COLUMNS.documentNumber]: application.documentNumber,
        [COLUMNS.fullName]: fullName(person),
        [COLUMNS.membership]: this.membershipLabel(application.affiliateType),
        [COLUMNS.status]:
          USER_STATUS_LABELS[person?.user?.status ?? ""] ??
          person?.user?.status ??
          "Activo",
        [COLUMNS.origin]: "Postulación",
      };

      for (const [index, column] of SPONSOR_COLUMNS.entries()) {
        const details = sponsors[index];
        for (const field of SPONSOR_FIELDS) {
          values[`${column} ${field.header}`] = isStudent
            ? "No aplica"
            : (details?.[field.key] ?? "");
        }
      }

      for (const area of AREA_REVIEWER_COLUMNS) {
        values[area.header] = reviewerName(application.validations, area.code);
      }

      for (const { label } of EXPEDIENTE_DOCUMENT_SLOTS) {
        values[label] = documentCells.get(label) ?? "";
      }

      values[COLUMNS.email] = person?.user?.email ?? application.email ?? "";
      values[COLUMNS.phone] = resolvePhone(person?.contacts);
      values[COLUMNS.createdAt] = formatPeruDateTime(
        person?.user?.createdAt ?? application.createdAt,
      );
      values[COLUMNS.updatedAt] = formatPeruDateTime(application.updatedAt);

      records.push({ values, application });
    }

    for (const record of histRows) {
      if (!record.person) continue;
      const person = record.person;

      const values: Record<string, ExcelCellValue> = {
        [COLUMNS.code]: resolveAssociateCode(person) ?? record.externalCode?.trim() ?? "",
        [COLUMNS.documentType]: documentTypeLabel(person.documentType),
        [COLUMNS.documentNumber]: person.documentNumber,
        [COLUMNS.fullName]: fullName(person),
        [COLUMNS.membership]: this.membershipLabel(record.category?.mappedAffiliateType),
        [COLUMNS.status]: "Completado",
        [COLUMNS.origin]: "SIE Histórico",
      };

      for (const column of SPONSOR_COLUMNS) {
        for (const field of SPONSOR_FIELDS) {
          values[`${column} ${field.header}`] = "No aplica";
        }
      }
      for (const area of AREA_REVIEWER_COLUMNS) {
        values[area.header] = "No aplica";
      }
      for (const { label } of EXPEDIENTE_DOCUMENT_SLOTS) {
        values[label] = "";
      }

      values[COLUMNS.email] = person.user?.email ?? "";
      values[COLUMNS.phone] = resolvePhone(person.contacts);
      values[COLUMNS.createdAt] = formatPeruDateTime(person.createdAt);
      values[COLUMNS.updatedAt] = formatPeruDateTime(record.updatedAt);

      records.push({ values, application: null });
    }

    records.sort((left, right) => {
      const leftValue = String(left.values[COLUMNS.updatedAt] ?? "");
      const rightValue = String(right.values[COLUMNS.updatedAt] ?? "");
      return sort === "asc"
        ? leftValue.localeCompare(rightValue)
        : rightValue.localeCompare(leftValue);
    });

    return records;
  }

  async buildBuffer(records: AsociadoExportRecord[]): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Plataforma de Afiliaciones IIMP";
    workbook.created = new Date();

    const headers = [
      COLUMNS.code,
      COLUMNS.documentType,
      COLUMNS.documentNumber,
      COLUMNS.fullName,
      COLUMNS.membership,
      COLUMNS.status,
      COLUMNS.origin,
      ...SPONSOR_COLUMNS.flatMap((column) =>
        SPONSOR_FIELDS.map((field) => `${column} ${field.header}`),
      ),
      ...AREA_REVIEWER_COLUMNS.map((area) => area.header),
      ...EXPEDIENTE_DOCUMENT_SLOTS.map(({ label }) => label),
      COLUMNS.email,
      COLUMNS.phone,
      COLUMNS.createdAt,
      COLUMNS.updatedAt,
    ];

    const worksheet = workbook.addWorksheet("Padrón de Asociados");
    worksheet.columns = headers.map((header) => ({
      header,
      key: header,
      width: EXPEDIENTE_DOCUMENT_SLOTS.some(({ label }) => label === header)
        ? 55
        : Math.max(16, header.length + 8),
    }));

    worksheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    worksheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFB58B35" } };
    worksheet.getRow(1).alignment = { vertical: "middle", horizontal: "center" };

    for (const record of records) {
      worksheet.addRow(record.values);
    }

    worksheet.views = [{ state: "frozen", ySplit: 1 }];
    worksheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: headers.length },
    };

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
              : 28,
    }));
    documentsSheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    documentsSheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFB58B35" } };
    documentsSheet.getRow(1).alignment = { vertical: "middle", horizontal: "center" };

    for (const record of records) {
      if (!record.application) continue;
      const code = String(record.values[COLUMNS.code] || record.values[COLUMNS.documentNumber] || "");
      for (const document of buildCurrentExpedienteDocuments(record.application)) {
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

  async execute(filters: ExportAsociadosFilters): Promise<Buffer> {
    return this.buildBuffer(await this.getRecords(filters));
  }

  private membershipLabel(affiliateType: string | null | undefined): string {
    return affiliateType === "STUDENT" ? "Asociado Estudiante" : "Asociado Activo";
  }
}
