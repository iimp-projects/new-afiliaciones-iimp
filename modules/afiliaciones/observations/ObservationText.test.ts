import { describe, expect, it } from "vitest";
import { stripObservationMarkup } from "./ObservationText";

describe("stripObservationMarkup", () => {
  it("elimina etiquetas de script", () => {
    expect(stripObservationMarkup("<script>alert(1)</script>")).toBe("alert(1)");
  });

  it("elimina etiquetas con atributos", () => {
    expect(stripObservationMarkup("<img src=x onerror=alert(1)>")).toBe("");
  });

  it("conserva texto normal", () => {
    expect(stripObservationMarkup("Documento legible requerido")).toBe("Documento legible requerido");
  });

  it("conserva acentos y caracteres especiales", () => {
    expect(stripObservationMarkup("José Pérez – dirección nº 12")).toBe("José Pérez – dirección nº 12");
  });

  it("normaliza espacios y elimina ángulos sueltos", () => {
    expect(stripObservationMarkup("  hola   <b>mundo</b> 5 < 6  ")).toBe("hola mundo 5 6");
  });
});
