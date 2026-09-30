import ExcelJS from "exceljs";
import { cellToString } from "./EmailProcessing";
import type { ParsedRow, ParsedSheet } from "../../Models/RecipientImport";

/**
 * Lee físicamente un workbook XLSX (server-side, en memoria) y lo normaliza a
 * una estructura de hojas → encabezados → filas. No contiene reglas de negocio.
 * La primera fila con contenido de cada hoja se interpreta como encabezados.
 */
export class ExcelRecipientParser {
  async parse(buffer: Buffer): Promise<ParsedSheet[]> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as unknown as Parameters<typeof workbook.xlsx.load>[0]);

    const sheets: ParsedSheet[] = [];

    workbook.eachSheet((worksheet) => {
      const rawRows: Array<{ rowNumber: number; cells: Record<number, string> }> = [];

      worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
        const cells: Record<number, string> = {};
        row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
          cells[colNumber] = cellToString(cell.value);
        });
        const hasContent = Object.values(cells).some((value) => value.trim().length > 0);
        if (hasContent) rawRows.push({ rowNumber, cells });
      });

      if (rawRows.length === 0) {
        sheets.push({ sheetName: worksheet.name, headers: [], rows: [] });
        return;
      }

      const headerRow = rawRows[0];
      const maxColumn = Object.keys(headerRow.cells).reduce((max, key) => Math.max(max, Number(key)), 0);

      const headers: string[] = [];
      for (let column = 1; column <= maxColumn; column += 1) {
        headers.push((headerRow.cells[column] ?? "").trim());
      }

      const rows: ParsedRow[] = [];
      for (let i = 1; i < rawRows.length; i += 1) {
        const cells: Record<string, string> = {};
        for (let column = 1; column <= maxColumn; column += 1) {
          const header = headers[column - 1];
          if (!header) continue;
          cells[header] = (rawRows[i].cells[column] ?? "").trim();
        }
        const hasContent = Object.values(cells).some((value) => value.length > 0);
        if (!hasContent) continue;
        rows.push({ rowNumber: rawRows[i].rowNumber, cells });
      }

      sheets.push({ sheetName: worksheet.name, headers, rows });
    });

    return sheets;
  }
}
