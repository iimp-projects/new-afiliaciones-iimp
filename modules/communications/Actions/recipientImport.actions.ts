"use server";

import { contextService } from "@/modules/auth/context/service";
import { ExcelRecipientParser } from "../Services/Import/ExcelRecipientParser";
import { validateRecipientFile } from "../Services/Import/FileValidation";
import { RecipientImportService } from "../Services/RecipientImportService";
import type { ImportConfirmInput, ImportPreview, ImportResult } from "../Models/RecipientImport";

async function readValidatedFile(file: File): Promise<{ buffer: Buffer } | { message: string }> {
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const isZip = buffer.length >= 4 && buffer[0] === 0x50 && buffer[1] === 0x4b;
  const validationError = validateRecipientFile(file.name, file.size, isZip);
  if (validationError) return { message: validationError };
  return { buffer };
}

export async function processRecipientsExcelAction(
  formData: FormData,
): Promise<{ success: true; preview: ImportPreview } | { success: false; message: string }> {
  try {
    await contextService.requireRole(["SUPER_ADMIN"]);

    const file = formData.get("file");
    if (!(file instanceof File)) return { success: false, message: "No se seleccionó ningún archivo." };

    const validated = await readValidatedFile(file);
    if ("message" in validated) return { success: false, message: validated.message };

    const sheets = await new ExcelRecipientParser().parse(validated.buffer);
    const preview = await new RecipientImportService().buildPreview(sheets, file.name);
    return { success: true, preview };
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : "No se pudo procesar el archivo." };
  }
}

export async function confirmRecipientsImportAction(
  input: ImportConfirmInput,
): Promise<{ success: true; result: ImportResult } | { success: false; message: string }> {
  try {
    await contextService.requireRole(["SUPER_ADMIN"]);
    const user = await contextService.getCurrentUser();
    if (!user) return { success: false, message: "No autorizado." };

    if (!input || !Array.isArray(input.sheets) || input.sheets.length === 0) {
      return { success: false, message: "No hay datos para importar." };
    }
    for (const sheet of input.sheets) {
      if (!sheet.mapping || typeof sheet.mapping.email !== "string" || !Array.isArray(sheet.rows)) {
        return { success: false, message: "La estructura de importación es inválida." };
      }
    }

    const result = await new RecipientImportService().confirmImport(input, { userId: user.id, email: user.email });
    return { success: true, result };
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : "No se pudo confirmar la importación." };
  }
}
