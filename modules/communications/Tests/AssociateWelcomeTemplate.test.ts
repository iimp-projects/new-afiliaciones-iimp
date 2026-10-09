import { describe, expect, it } from "vitest";
import { associateWelcomeEmail } from "../Services/AssociateWelcomeTemplate";

describe("associateWelcomeEmail", () => {
  it("genera un correo institucional con nombre y botón de acceso", () => {
    const email = associateWelcomeEmail({ name: "Juan Pérez", accessUrl: "https://afiliaciones.iimp.org.pe/login" });
    expect(email.subject).toBe("Bienvenido al nuevo Sistema de Afiliaciones IIMP");
    expect(email.html).toContain("Juan Pérez");
    expect(email.html).toContain("ACCEDER AL SISTEMA");
    expect(email.html).toContain("Instituto de Ingenieros de Minas del Perú");
    expect(email.text).toContain("Juan Pérez");
  });

  it("nunca incluye contraseñas ni credenciales", () => {
    const email = associateWelcomeEmail({ name: "Juan Pérez", accessUrl: "https://afiliaciones.iimp.org.pe/login" });
    expect(email.html).not.toContain("contraseña:");
    expect(email.text).not.toMatch(/password|clave|contraseña:\s*\S/);
  });

  it("escapa el nombre para evitar inyección HTML", () => {
    const email = associateWelcomeEmail({ name: "<script>alert(1)</script>", accessUrl: "https://afiliaciones.iimp.org.pe/login" });
    expect(email.html).not.toContain("<script>");
    expect(email.html).toContain("&lt;script&gt;");
  });

  it("omite el enlace de recuperación cuando no se provee o es inválido", () => {
    const sinUrl = associateWelcomeEmail({ name: "Ana", accessUrl: "https://afiliaciones.iimp.org.pe/login" });
    expect(sinUrl.html).not.toContain("Recuperar acceso</a>");
    const invalida = associateWelcomeEmail({ name: "Ana", accessUrl: "https://afiliaciones.iimp.org.pe/login", recoveryUrl: "javascript:alert(1)" });
    expect(invalida.html).not.toContain("javascript:");
  });

  it("incluye enlace de recuperación seguro cuando es HTTP(S)", () => {
    const email = associateWelcomeEmail({ name: "Ana", accessUrl: "https://afiliaciones.iimp.org.pe/login", recoveryUrl: "https://afiliaciones.iimp.org.pe/reset-password" });
    expect(email.html).toContain("https://afiliaciones.iimp.org.pe/reset-password");
  });
});
