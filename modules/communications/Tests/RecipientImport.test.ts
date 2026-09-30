import { describe, expect, it, vi } from "vitest";
import { normalizeEmail, splitEmails, isValidEmail, normalizeHeader } from "../Services/Import/EmailProcessing";
import { detectFieldMapping } from "../Services/Import/RecipientImportMapper";
import { validateRecipientFile } from "../Services/Import/FileValidation";
import { classifyRows, RecipientImportService } from "../Services/RecipientImportService";
import type { RecipientRepository } from "../Repositories/RecipientRepository";
import type { FieldMapping, ParsedRow, ParsedSheet } from "../Models/RecipientImport";

const MAPPING: FieldMapping = { email: "CORREO", name: "NOMBRES Y APELLIDOS", company: "EMPRESA", position: "CARGO" };

function row(rowNumber: number, correo: string, nombre?: string): ParsedRow {
  return {
    rowNumber,
    cells: { CORREO: correo, ...(nombre ? { "NOMBRES Y APELLIDOS": nombre } : {}), EMPRESA: "Empresa A", CARGO: "Gerente" },
  };
}

describe("EmailProcessing", () => {
  it("normaliza mayúsculas/minúsculas", () => {
    expect(normalizeEmail("Persona@Empresa.com")).toBe("persona@empresa.com");
    expect(normalizeEmail("PERSONA@EMPRESA.COM")).toBe("persona@empresa.com");
  });

  it("elimina espacios externos", () => {
    expect(normalizeEmail("  persona@empresa.com  ")).toBe("persona@empresa.com");
  });

  it("separa emails por ';'", () => {
    expect(splitEmails("a@x.com; b@x.com")).toEqual(["a@x.com", "b@x.com"]);
  });

  it("separa emails por ','", () => {
    expect(splitEmails("a@x.com, b@x.com")).toEqual(["a@x.com", "b@x.com"]);
  });

  it("separa múltiples emails combinando separadores", () => {
    expect(splitEmails("a@x.com ; b@x.com, c@x.com")).toEqual(["a@x.com", "b@x.com", "c@x.com"]);
  });

  it("valida formato de email", () => {
    expect(isValidEmail("persona@empresa.com")).toBe(true);
    expect(isValidEmail("correo-invalido")).toBe(false);
    expect(isValidEmail("sin-arroba.com")).toBe(false);
  });

  it("normaliza encabezados (sin tildes)", () => {
    expect(normalizeHeader(" CORREO ELECTRÓNICO ")).toBe("CORREO ELECTRONICO");
    expect(normalizeHeader("NÚMERO DE CONTACTO")).toBe("NUMERO DE CONTACTO");
  });
});

describe("detectFieldMapping", () => {
  it("detecta columna de email y campos opcionales", () => {
    const mapping = detectFieldMapping(["N°", "EMPRESA", "NOMBRES Y APELLIDOS", "CARGO", "CORREO"]);
    expect(mapping).toEqual({ email: "CORREO", name: "NOMBRES Y APELLIDOS", company: "EMPRESA", position: "CARGO" });
  });

  it("detecta variantes de email (CORREO ELECTRONICO / EMAIL)", () => {
    expect(detectFieldMapping(["CORREO ELECTRONICO"])?.email).toBe("CORREO ELECTRONICO");
    expect(detectFieldMapping(["EMAIL"])?.email).toBe("EMAIL");
    expect(detectFieldMapping(["E-MAIL"])?.email).toBe("E-MAIL");
  });

  it("devuelve null cuando no hay columna de email (requiere configuración)", () => {
    expect(detectFieldMapping(["NOMBRE", "EMPRESA", "TELEFONO"])).toBeNull();
  });
});

describe("classifyRows", () => {
  it("normaliza y clasifica emails válidos", () => {
    const rows = classifyRows("Auspiciadores", [row(2, " Persona@Empresa.com ")], MAPPING, new Set());
    expect(rows).toHaveLength(1);
    expect(rows[0].email).toBe("persona@empresa.com");
    expect(rows[0].status).toBe("VALID");
  });

  it("procesa múltiples emails en una celda", () => {
    const rows = classifyRows("Auspiciadores", [row(2, "a@x.com; b@x.com")], MAPPING, new Set());
    expect(rows.map((r) => r.email)).toEqual(["a@x.com", "b@x.com"]);
    expect(rows.every((r) => r.status === "VALID")).toBe(true);
  });

  it("detecta email inválido", () => {
    const rows = classifyRows("Auspiciadores", [row(2, "correo-invalido")], MAPPING, new Set());
    expect(rows[0].status).toBe("INVALID");
  });

  it("detecta duplicado dentro de la misma hoja", () => {
    const rows = classifyRows("Auspiciadores", [row(2, "juan@empresa.com"), row(3, "JUAN@EMPRESA.COM")], MAPPING, new Set());
    expect(rows[0].status).toBe("VALID");
    expect(rows[1].status).toBe("DUPLICATE_FILE");
  });

  it("clasifica destinatario existente como ALREADY_EXISTS", () => {
    const rows = classifyRows("Auspiciadores", [row(2, "juan@empresa.com")], MAPPING, new Set(["juan@empresa.com"]));
    expect(rows[0].status).toBe("ALREADY_EXISTS");
  });

  it("mismo email en dos hojas NO es duplicado (memberships independientes)", () => {
    const a = classifyRows("Auspiciadores", [row(2, "juan@empresa.com")], MAPPING, new Set());
    const b = classifyRows("Exhibición", [row(5, "juan@empresa.com")], MAPPING, new Set());
    expect(a[0].status).toBe("VALID");
    expect(b[0].status).toBe("VALID");
  });

  it("conserva name/company/position extraídos del mapping", () => {
    const rows = classifyRows("Auspiciadores", [row(2, "juan@empresa.com", "Juan Pérez")], MAPPING, new Set());
    expect(rows[0].name).toBe("Juan Pérez");
    expect(rows[0].company).toBe("Empresa A");
    expect(rows[0].position).toBe("Gerente");
  });
});

describe("validateRecipientFile", () => {
  it("rechaza archivos que no son .xlsx", () => {
    expect(validateRecipientFile("lista.xls", 1000, true)).toContain(".xlsx");
    expect(validateRecipientFile("lista.csv", 1000, true)).toContain(".xlsx");
  });

  it("rechaza archivos demasiado grandes", () => {
    expect(validateRecipientFile("lista.xlsx", 6 * 1024 * 1024, true)).toContain("5 MB");
  });

  it("rechaza archivos sin firma ZIP", () => {
    expect(validateRecipientFile("lista.xlsx", 1000, false)).toContain("XLSX");
  });

  it("acepta un .xlsx válido", () => {
    expect(validateRecipientFile("lista.xlsx", 1000, true)).toBeNull();
  });
});

describe("RecipientImportService.buildPreview", () => {
  it("calcula totales y clasifica por hoja (dedup por hoja, existentes globales)", async () => {
    const repository = {
      findExistingEmails: vi.fn().mockResolvedValue(new Set(["existente@empresa.com"])),
    } as unknown as RecipientRepository;
    const service = new RecipientImportService(repository);

    const sheets: ParsedSheet[] = [
      {
        sheetName: "Auspiciadores",
        headers: ["EMPRESA", "NOMBRES Y APELLIDOS", "CARGO", "CORREO"],
        rows: [
          row(2, "juan@empresa.com", "Juan Pérez"),
          row(3, "juan@empresa.com"),
          row(4, "correo-invalido"),
        ],
      },
      {
        sheetName: "Exhibición",
        headers: ["EMPRESA", "CORREO"],
        rows: [row(2, "juan@empresa.com"), row(3, "existente@empresa.com")],
      },
    ];

    const preview = await service.buildPreview(sheets, "lista.xlsx");

    expect(preview.totals.found).toBe(5);
    expect(preview.totals.unique).toBe(2); // juan@empresa.com y existente@empresa.com (inválido excluido)
    expect(preview.totals.valid).toBe(2); // juan (Auspiciadores) + juan (Exhibición)
    expect(preview.totals.invalid).toBe(1);
    expect(preview.totals.duplicate).toBe(1);
    expect(preview.totals.existing).toBe(1);
    expect(repository.findExistingEmails).toHaveBeenCalled();
  });
});
