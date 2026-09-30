import { detectFieldMapping } from "./Import/RecipientImportMapper";
import { isValidEmail, normalizeEmail, splitEmails } from "./Import/EmailProcessing";
import { RecipientRepository, type RecipientImportPlan } from "../Repositories/RecipientRepository";
import type {
  FieldMapping,
  ImportConfirmInput,
  ImportPreview,
  ImportResult,
  ParsedRow,
  ParsedSheet,
  RecipientPreviewRow,
  SheetPreview,
} from "../Models/RecipientImport";

/**
 * Clasifica los destinatarios de una hoja: split, normalización, validación y
 * deduplicación dentro de la hoja. Devuelve una fila por email detectado.
 * Función pura (inyecta `existingEmails`), testeable sin ExcelJS.
 */
export function classifyRows(
  sheetName: string,
  rows: ParsedRow[],
  mapping: FieldMapping,
  existingEmails: Set<string>,
): RecipientPreviewRow[] {
  const seenInSheet = new Set<string>();
  const result: RecipientPreviewRow[] = [];

  for (const row of rows) {
    const rawEmails = splitEmails(row.cells[mapping.email] ?? "");
    for (const rawEmail of rawEmails) {
      const email = normalizeEmail(rawEmail);
      let status: RecipientPreviewRow["status"];
      if (!isValidEmail(email)) {
        status = "INVALID";
      } else if (seenInSheet.has(email)) {
        status = "DUPLICATE_FILE";
      } else if (existingEmails.has(email)) {
        status = "ALREADY_EXISTS";
      } else {
        status = "VALID";
      }
      if (isValidEmail(email)) seenInSheet.add(email);

      result.push({
        sheetName,
        rowNumber: row.rowNumber,
        rawEmail,
        email,
        status,
        ...(mapping.name && row.cells[mapping.name] ? { name: row.cells[mapping.name] } : {}),
        ...(mapping.company && row.cells[mapping.company] ? { company: row.cells[mapping.company] } : {}),
        ...(mapping.position && row.cells[mapping.position] ? { position: row.cells[mapping.position] } : {}),
        ...(mapping.ruc && row.cells[mapping.ruc] ? { ruc: row.cells[mapping.ruc] } : {}),
        ...(mapping.phone && row.cells[mapping.phone] ? { phone: row.cells[mapping.phone] } : {}),
      });
    }
  }

  return result;
}

export class RecipientImportService {
  constructor(private readonly repository = new RecipientRepository()) {}

  async buildPreview(sheets: ParsedSheet[], fileName: string): Promise<ImportPreview> {
    const previewSheets: SheetPreview[] = [];
    const candidateEmails: string[] = [];

    for (const sheet of sheets) {
      const mapping = detectFieldMapping(sheet.headers);
      let rows: RecipientPreviewRow[] = [];
      if (mapping) {
        rows = classifyRows(sheet.sheetName, sheet.rows, mapping, new Set());
        for (const row of rows) {
          if (row.status === "VALID") candidateEmails.push(row.email);
        }
      }
      previewSheets.push({ sheetName: sheet.sheetName, listName: sheet.sheetName, headers: sheet.headers, mapping, rows, sourceRows: sheet.rows });
    }

    const existingEmails = await this.repository.findExistingEmails(candidateEmails);

    for (const preview of previewSheets) {
      if (!preview.mapping) continue;
      const sheet = sheets.find((item) => item.sheetName === preview.sheetName);
      if (!sheet) continue;
      preview.rows = classifyRows(sheet.sheetName, sheet.rows, preview.mapping, existingEmails);
    }

    return { fileName, sheets: previewSheets, totals: this.computeTotals(previewSheets) };
  }

  async confirmImport(input: ImportConfirmInput, actor: { userId: number; email: string }): Promise<ImportResult> {
    const candidateEmails: string[] = [];
    const classifiedSheets: Array<{ sheetName: string; listName: string; mapping: FieldMapping; rawRows: ParsedRow[]; rows: RecipientPreviewRow[] }> = [];

    for (const sheet of input.sheets) {
      const rows = classifyRows(sheet.sheetName, sheet.rows, sheet.mapping, new Set());
      for (const row of rows) {
        if (row.status === "VALID") candidateEmails.push(row.email);
      }
      classifiedSheets.push({ sheetName: sheet.sheetName, listName: sheet.listName, mapping: sheet.mapping, rawRows: sheet.rows, rows });
    }

    const existingEmails = await this.repository.findExistingEmails(candidateEmails);

    const plan = this.buildPersistPlan(classifiedSheets, existingEmails, input.fileName);
    const summary = this.computeSummary(classifiedSheets);

    const persistence = await this.repository.importRecipients(plan, actor, {
      file: input.fileName,
      listNames: plan.lists.map((list) => list.name),
      processedRows: summary.processedRows,
      foundEmails: summary.found,
      invalid: summary.invalid,
      duplicate: summary.duplicate,
    });

    return {
      listsCreated: persistence.listsCreated,
      listsExisting: persistence.listsExisting,
      recipientsNew: persistence.recipientsNew,
      recipientsExisting: persistence.recipientsExisting,
      membershipsCreated: persistence.membershipsCreated,
      invalid: summary.invalid,
      duplicate: summary.duplicate,
      processedRows: summary.processedRows,
      foundEmails: summary.found,
    };
  }

  private buildPersistPlan(
    classifiedSheets: Array<{ sheetName: string; listName: string; mapping: FieldMapping; rawRows: ParsedRow[]; rows: RecipientPreviewRow[] }>,
    existingEmails: Set<string>,
    fileName: string,
  ): RecipientImportPlan {
    const lists = classifiedSheets.map((sheet) => {
      const finalRows = classifyRows(sheet.sheetName, sheet.rawRows, sheet.mapping, existingEmails);
      const seen = new Set<string>();
      const members = finalRows
        .filter((row) => row.status === "VALID" || row.status === "ALREADY_EXISTS")
        .filter((row) => {
          if (seen.has(row.email)) return false;
          seen.add(row.email);
          return true;
        })
        .map((row) => {
          const sourceRow = sheet.rawRows.find((r) => r.rowNumber === row.rowNumber);
          return {
            email: row.email,
            ...(row.name !== undefined ? { name: row.name } : {}),
            ...(row.company !== undefined ? { company: row.company } : {}),
            ...(row.position !== undefined ? { position: row.position } : {}),
            ...(row.ruc !== undefined ? { ruc: row.ruc } : {}),
            ...(row.phone !== undefined ? { phone: row.phone } : {}),
            metadata: {
              sourceSheet: sheet.sheetName,
              sourceRow: row.rowNumber,
              originalData: sourceRow?.cells ?? {},
            },
          };
        });
      return { name: sheet.listName, sourceSheet: sheet.sheetName, members };
    });
    return { fileName, lists };
  }

  private computeTotals(sheets: SheetPreview[]): ImportPreview["totals"] {
    const totals = { found: 0, unique: 0, valid: 0, invalid: 0, duplicate: 0, existing: 0 };
    const unique = new Set<string>();
    for (const sheet of sheets) {
      for (const row of sheet.rows) {
        totals.found += 1;
        if (row.status === "VALID") totals.valid += 1;
        else if (row.status === "INVALID") totals.invalid += 1;
        else if (row.status === "DUPLICATE_FILE") totals.duplicate += 1;
        else if (row.status === "ALREADY_EXISTS") totals.existing += 1;
        if (row.status !== "INVALID") unique.add(row.email);
      }
    }
    totals.unique = unique.size;
    return totals;
  }

  private computeSummary(sheets: Array<{ rows: RecipientPreviewRow[] }>): { found: number; invalid: number; duplicate: number; processedRows: number } {
    let found = 0;
    let invalid = 0;
    let duplicate = 0;
    let processedRows = 0;
    for (const sheet of sheets) {
      for (const row of sheet.rows) {
        found += 1;
        if (row.status === "INVALID") invalid += 1;
        else if (row.status === "DUPLICATE_FILE") duplicate += 1;
        else processedRows += 1;
      }
    }
    return { found, invalid, duplicate, processedRows };
  }
}
