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

  it("sustituye las variables del origen 'Asociados del sistema'", () => {
    const template = "{{nombre_completo}}|{{correo_acceso}}|{{tipo_asociado}}|{{enlace_acceso}}|{{enlace_activacion}}";
    const result = renderTemplate(template, {
      nombreCompleto: "Ana Torres Ramos",
      correoAcceso: "ana@iimp.org.pe",
      tipoAsociado: "Asociado Activo",
      enlaceAcceso: "https://portal.iimp.org.pe/login",
      enlaceActivacion: "https://portal.iimp.org.pe/activar-cuenta?token=abc",
    });
    expect(result).toBe("Ana Torres Ramos|ana@iimp.org.pe|Asociado Activo|https://portal.iimp.org.pe/login|https://portal.iimp.org.pe/activar-cuenta?token=abc");
  });

  it("variables de asociados sin valor quedan vacías sin 'undefined'", () => {
    expect(renderTemplate("{{nombre_completo}}/{{enlace_activacion}}", {})).toBe("/");
  });

  it("bloque condicional se conserva cuando la variable tiene valor", () => {
    const template = "Inicio {{#enlace_activacion}}<a href=\"{{enlace_activacion}}\">ACTIVAR</a>{{/enlace_activacion}} Fin";
    const result = renderTemplate(template, { enlaceActivacion: "https://portal/activar?token=t" });
    expect(result).toBe("Inicio <a href=\"https://portal/activar?token=t\">ACTIVAR</a> Fin");
  });

  it("bloque condicional se elimina cuando la variable está vacía", () => {
    const template = "Inicio {{#enlace_activacion}}<a href=\"{{enlace_activacion}}\">ACTIVAR</a>{{/enlace_activacion}} Fin";
    expect(renderTemplate(template, {})).toBe("Inicio  Fin");
  });

  it("bloque condicional de variable desconocida queda literal", () => {
    expect(renderTemplate("{{#desconocida}}X{{/desconocida}}", {})).toBe("{{#desconocida}}X{{/desconocida}}");
  });
});
