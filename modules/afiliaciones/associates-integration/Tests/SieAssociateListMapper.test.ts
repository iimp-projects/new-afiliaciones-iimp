import { describe, expect, it, vi } from "vitest";
import { mapSieDocumentType, parseAssociateListPage, sanitizeSieAssociate } from "../Mappers/SieAssociateListMapper";

describe("SieAssociateListMapper", () => {
  it("preserva NumDocumento y Codigo como string con ceros a la izquierda", () => {
    const sanitized = sanitizeSieAssociate({ TipoDocumento: "1", NumDocumento: "07123456", Codigo: "00012", Clave: "AB12", Tipo: "A", TipoDescripcion: "Activo" });
    expect(sanitized.documentNumber).toBe("07123456");
    expect(sanitized.externalCode).toBe("00012");
  });

  it("nunca retiene la Clave y solo expone passwordPresent", () => {
    const sanitized = sanitizeSieAssociate({ TipoDocumento: "1", NumDocumento: "07123456", Codigo: "00012", Clave: "SUPERSecreto99", Tipo: "A", TipoDescripcion: "Activo" });
    expect(sanitized.passwordPresent).toBe(true);
    expect(Object.keys(sanitized)).not.toContain("Clave");
    expect(Object.keys(sanitized)).not.toContain("password");
    expect(Object.keys(sanitized)).not.toContain("secret");
    expect(JSON.stringify(sanitized)).not.toContain("SUPERSecreto99");
    expect(JSON.stringify(sanitized)).not.toContain("Clave");
  });

  it("marca passwordPresent=false cuando Clave está ausente o vacía", () => {
    expect(sanitizeSieAssociate({ Clave: "" }).passwordPresent).toBe(false);
    expect(sanitizeSieAssociate({}).passwordPresent).toBe(false);
    expect(sanitizeSieAssociate({ Clave: 123 }).passwordPresent).toBe(false);
  });

  it("extrae los datos personales ampliados sin exponer Clave", () => {
    const sanitized = sanitizeSieAssociate({
      TipoDocumento: "1",
      NumDocumento: "07123456",
      Codigo: "00012",
      Clave: "SECRETO99",
      Tipo: "V",
      TipoDescripcion: "Vitalicio",
      Nombres: "Juan",
      ApellidoPaterno: "Perez",
      ApellidoMaterno: "Gomez",
      FechaNacimiento: "1980-05-05",
      Telefono: "999888777",
      Correo: "juan@example.com",
      Direccion: "Av. Siempre Viva 123",
      Pais: "PE",
      PaisNombre: "Perú",
      Departamento: "15",
      DepartamentoNombre: "Lima",
      Provincia: "01",
      ProvinciaNombre: "Lima",
      Distrito: "01",
      DistritoNombre: "Miraflores",
    });
    expect(sanitized.nombres).toBe("Juan");
    expect(sanitized.apellidoPaterno).toBe("Perez");
    expect(sanitized.apellidoMaterno).toBe("Gomez");
    expect(sanitized.fechaNacimiento).toBe("1980-05-05");
    expect(sanitized.telefono).toBe("999888777");
    expect(sanitized.correo).toBe("juan@example.com");
    expect(sanitized.direccion).toBe("Av. Siempre Viva 123");
    expect(sanitized.distritoNombre).toBe("Miraflores");
    expect(sanitized.passwordPresent).toBe(true);
    expect(JSON.stringify(sanitized)).not.toContain("SECRETO99");
    expect(JSON.stringify(sanitized)).not.toContain("Clave");
  });

  it("mapea tipos de documento conocidos y deja null los desconocidos", () => {
    expect(mapSieDocumentType("1")).toBe("DNI");
    expect(mapSieDocumentType("4")).toBe("CE");
    expect(mapSieDocumentType("7")).toBe("PASSPORT");
    expect(mapSieDocumentType("0")).toBeNull();
    expect(mapSieDocumentType("6")).toBeNull();
    expect(mapSieDocumentType("A")).toBeNull();
    expect(mapSieDocumentType("")).toBeNull();
  });

  it("parsea la página y sanitiza todos los registros sin exponer Clave", () => {
    const page = parseAssociateListPage({
      Pagina: 1,
      TamanioPagina: 500,
      TotalRegistros: 2,
      TotalPaginas: 1,
      Asociados: [
        { TipoDocumento: "1", NumDocumento: "07123456", Codigo: "00012", Clave: "AB12", Tipo: "A", TipoDescripcion: "Activo" },
        { TipoDocumento: "4", NumDocumento: "CE0001", Codigo: "00013", Clave: "XYZ99", Tipo: "E", TipoDescripcion: "Estudiante" },
      ],
    });
    expect(page.totalRegistros).toBe(2);
    expect(page.associates).toHaveLength(2);
    expect(JSON.stringify(page)).not.toContain("AB12");
    expect(JSON.stringify(page)).not.toContain("XYZ99");
    expect(JSON.stringify(page)).not.toContain("Clave");
  });

  it("rechaza una respuesta sin Asociados", () => {
    expect(() => parseAssociateListPage({})).toThrow(/lista inválida/);
    expect(() => parseAssociateListPage({ Asociados: "no-array" })).toThrow(/lista inválida/);
  });

  it("no registra en logger durante el parseo y la sanitización", () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    parseAssociateListPage({
      Asociados: [{ TipoDocumento: "1", NumDocumento: "1", Codigo: "00001", Clave: "SUPERSecreto99", Tipo: "A", TipoDescripcion: "Activo" }],
    });
    expect(log).not.toHaveBeenCalled();
    expect(info).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
    log.mockRestore();
    info.mockRestore();
    error.mockRestore();
  });
});
