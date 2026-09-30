export type EmailImportStatus = "VALID" | "INVALID" | "DUPLICATE_FILE" | "ALREADY_EXISTS";

export interface ParsedRow {
  rowNumber: number;
  cells: Record<string, string>;
}

export interface ParsedSheet {
  sheetName: string;
  headers: string[];
  rows: ParsedRow[];
}

export interface FieldMapping {
  email: string;
  name?: string;
  company?: string;
  position?: string;
  ruc?: string;
  phone?: string;
}

export interface RecipientPreviewRow {
  sheetName: string;
  rowNumber: number;
  rawEmail: string;
  email: string;
  status: EmailImportStatus;
  name?: string;
  company?: string;
  position?: string;
  ruc?: string;
  phone?: string;
}

export interface SheetPreview {
  sheetName: string;
  listName: string;
  headers: string[];
  mapping: FieldMapping | null;
  rows: RecipientPreviewRow[];
  sourceRows: ParsedRow[];
}

export interface ImportPreview {
  fileName: string;
  sheets: SheetPreview[];
  totals: {
    found: number;
    unique: number;
    valid: number;
    invalid: number;
    duplicate: number;
    existing: number;
  };
}

export interface ImportConfirmSheet {
  sheetName: string;
  listName: string;
  mapping: FieldMapping;
  rows: ParsedRow[];
}

export interface ImportConfirmInput {
  fileName: string;
  sheets: ImportConfirmSheet[];
}

export interface ImportResult {
  listsCreated: number;
  listsExisting: number;
  recipientsNew: number;
  recipientsExisting: number;
  membershipsCreated: number;
  invalid: number;
  duplicate: number;
  processedRows: number;
  foundEmails: number;
}
