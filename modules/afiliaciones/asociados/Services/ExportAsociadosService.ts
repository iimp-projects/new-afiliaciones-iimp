import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";
import { documentTypeLabel } from "@/modules/shared/Utils/documentType";
import { formatPeruDateTime } from "@/modules/shared/Utils/formatPeruDateTime";
import { buildHistoricalWhere, buildV2Where, resolveInstitutionalCode } from "./asociadosQuery";

const USER_STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Activo",
  INACTIVE: "Inactivo",
  BLOCKED: "Suspendido",
  PENDING: "Pendiente",
};

export interface ExportAsociadosFilters {
  search?: string;
  membershipType?: string;
  sort?: string;
}

/**
 * Genera el Excel del padrón de asociados aplicando los mismos filtros que el
 * directorio (búsqueda, tipo de membresía y orden). Devuelve el workbook como
 * Buffer para responder como descarga.
 */
export class ExportAsociadosService {
  private resolvePhone(contacts: Array<{ isPrimary?: boolean | null; phoneNumber?: string | null }> | undefined): string {
    const primary = contacts?.find((contact) => contact.isPrimary) ?? contacts?.[0];
    return primary?.phoneNumber || "";
  }

  private fullName(person: { firstName?: string; paternalLastName?: string; maternalLastName?: string | null } | null): string {
    if (!person) return "Sin nombre";
    return `${person.firstName ?? ""} ${person.paternalLastName ?? ""} ${person.maternalLastName ?? ""}`.trim();
  }

  private membershipLabel(affiliateType: string | null | undefined): string {
    return affiliateType === "STUDENT" ? "Asociado Estudiante" : "Asociado Activo";
  }

  async execute(filters: ExportAsociadosFilters): Promise<Buffer> {
    const { search, membershipType, sort = "desc" } = filters;
    const orderByConfig = sort === "asc" ? ({ updatedAt: "asc" } as const) : ({ updatedAt: "desc" } as const);

    const [v2Rows, histRows] = await Promise.all([
      prisma.membershipApplication.findMany({
        where: buildV2Where(search, membershipType),
        orderBy: orderByConfig,
        include: {
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

    const rows: Array<Record<string, string>> = [];

    for (const application of v2Rows) {
      const person = application.person;
      rows.push({
        "Código Institucional": resolveInstitutionalCode(person) ?? "",
        "Tipo de Documento": documentTypeLabel(application.documentType),
        "N° Documento": application.documentNumber,
        "Nombres y Apellidos": this.fullName(person),
        "Email": person?.user?.email ?? application.email ?? "",
        "Teléfono": this.resolvePhone(person?.contacts),
        "Membresía": this.membershipLabel(application.affiliateType),
        "Estado": USER_STATUS_LABELS[person?.user?.status ?? ""] ?? person?.user?.status ?? "Activo",
        "Origen": "Postulación",
        "Fecha de Registro": formatPeruDateTime(person?.user?.createdAt ?? application.createdAt),
        "Última Actualización": formatPeruDateTime(application.updatedAt),
      });
    }

    for (const record of histRows) {
      if (!record.person) continue;
      const person = record.person;
      rows.push({
        "Código Institucional": record.externalCode ?? "",
        "Tipo de Documento": documentTypeLabel(person.documentType),
        "N° Documento": person.documentNumber,
        "Nombres y Apellidos": this.fullName(person),
        "Email": person.user?.email ?? "",
        "Teléfono": this.resolvePhone(person.contacts),
        "Membresía": this.membershipLabel(record.category?.mappedAffiliateType),
        "Estado": "Completado",
        "Origen": "SIE Histórico",
        "Fecha de Registro": formatPeruDateTime(person.createdAt),
        "Última Actualización": formatPeruDateTime(record.updatedAt),
      });
    }

    rows.sort((left, right) =>
      sort === "asc"
        ? left["Última Actualización"].localeCompare(right["Última Actualización"])
        : right["Última Actualización"].localeCompare(left["Última Actualización"]),
    );

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Plataforma de Afiliaciones IIMP";
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet("Padrón de Asociados");

    const headers = [
      "Código Institucional",
      "Tipo de Documento",
      "N° Documento",
      "Nombres y Apellidos",
      "Email",
      "Teléfono",
      "Membresía",
      "Estado",
      "Origen",
      "Fecha de Registro",
      "Última Actualización",
    ];

    worksheet.columns = headers.map((header) => ({ header, key: header, width: header.length + 10 }));

    worksheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    worksheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFB58B35" } };
    worksheet.getRow(1).alignment = { vertical: "middle", horizontal: "center" };

    for (const row of rows) {
      worksheet.addRow(row);
    }

    worksheet.views = [{ state: "frozen", ySplit: 1 }];
    worksheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: headers.length } };

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }
}
