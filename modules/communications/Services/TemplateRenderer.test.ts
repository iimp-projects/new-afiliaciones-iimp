import { describe, expect, it } from "vitest";
import { renderTemplate } from "./TemplateRenderer";

describe("renderTemplate", () => {
  it("sustituye nombre, empresa, cargo y email", () => {
    const result = renderTemplate("Estimado(a) {{nombre}}, de {{empresa}} como {{cargo}} en {{email}}.", {
      name: "Luis Santivañez",
      company: "Antamina",
      position: "CEO",
      email: "lsantivanez@antamina.com",
    });
    expect(result).toBe("Estimado(a) Luis Santivañez, de Antamina como CEO en lsantivanez@antamina.com.");
  });

  it("fallback con nombre vacío produce 'Estimado(a),' sin espacio residual", () => {
    expect(renderTemplate("Estimado(a) {{nombre}},", {})).toBe("Estimado(a),");
    expect(renderTemplate("Estimado(a) {{nombre}},", { name: null })).toBe("Estimado(a),");
    expect(renderTemplate("Estimado(a) {{nombre}},", { name: "" })).toBe("Estimado(a),");
  });

  it("nunca emite 'undefined' ni 'null'", () => {
    const result = renderTemplate("{{nombre}}/{{empresa}}/{{cargo}}/{{email}}", {});
    expect(result).toBe("///");
  });

  it("deja literales las variables desconocidas", () => {
    expect(renderTemplate("Hola {{desconocida}}", { name: "X" })).toBe("Hola {{desconocida}}");
  });

  it("cambiar de destinatario produce una salida distinta", () => {
    const template = "Hola {{nombre}}, de {{empresa}}";
    const first = renderTemplate(template, { name: "Luis Santivañez", company: "Antamina" });
    const second = renderTemplate(template, { name: "Ana Torres", company: "Buenaventura" });
    expect(first).toBe("Hola Luis Santivañez, de Antamina");
    expect(second).toBe("Hola Ana Torres, de Buenaventura");
    expect(first).not.toBe(second);
  });
});
