import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";
import { fullName } from "../DTOs/access.dto";
import {
  prismaAccessRepository,
  type MovementFilters,
  type PrismaAccessRepository,
} from "../Repositories/PrismaAccessRepository";

const MAX_EXPORT_ROWS = 50_000;

function safeCell(value: unknown): string | null {
  if (value == null) return null;
  const text = String(value).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");
  return /^[=+\-@]/.test(text) ? `'${text}` : text;
}

function formatDate(value: Date): string {
  return new Intl.DateTimeFormat("es-PE", {
    dateStyle: "short",
    timeStyle: "medium",
    timeZone: "America/Lima",
  }).format(value);
}

export class AccessExportService {
  public constructor(private readonly repo: PrismaAccessRepository = prismaAccessRepository) {}

  public async exportMovements(filters: MovementFilters, actorUserId: number) {
    const rows = await this.repo.exportMovements(filters, MAX_EXPORT_ROWS);
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "IIMP — Control de accesos";
    const sheet = workbook.addWorksheet("Movimientos");
    sheet.columns = [
      { header: "Fecha y hora", key: "date", width: 22 },
      { header: "Asociado", key: "person", width: 38 },
      { header: "Código", key: "code", width: 16 },
      { header: "Sede", key: "site", width: 26 },
      { header: "Punto de acceso", key: "point", width: 26 },
      { header: "Movimiento", key: "type", width: 14 },
      { header: "Resultado", key: "result", width: 18 },
      { header: "Motivo", key: "reason", width: 20 },
      { header: "Origen", key: "source", width: 18 },
      { header: "Registrado por", key: "registeredBy", width: 28 },
    ];
    sheet.getRow(1).font = { bold: true };

    for (const row of rows) {
      sheet.addRow({
        date: formatDate(row.occurredAt),
        person: safeCell(fullName(row.person)),
        code: safeCell(row.person.associateCode),
        site: safeCell(row.site.name),
        point: safeCell(row.accessPoint.name),
        type: row.movementType === "ENTRY" ? "Ingreso" : "Salida",
        result: row.validationResult,
        reason: safeCell(row.reasonCode),
        source: row.source,
        registeredBy: safeCell(row.registeredByUser?.name ?? ""),
      });
    }

    const buffer = await workbook.xlsx.writeBuffer();

    await prisma.auditLog.create({
      data: {
        userId: actorUserId,
        action: "EXPORT_ACCESS_CONTROL",
        entity: "AccessMovement",
        newValues: {
          rowCount: rows.length,
          siteId: filters.siteId ?? null,
          from: filters.from?.toISOString() ?? null,
          to: filters.to?.toISOString() ?? null,
        },
      },
    });

    return { buffer: Buffer.from(buffer), filename: "Control_Accesos.xlsx", rowCount: rows.length };
  }
}

export const accessExportService = new AccessExportService();
