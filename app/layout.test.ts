import { describe, expect, it, vi } from "vitest";

vi.mock("next/font/google", () => ({
  Geist: () => ({ variable: "--font-geist-sans" }),
  Geist_Mono: () => ({ variable: "--font-geist-mono" }),
  Montserrat: () => ({ variable: "--font-montserrat" }),
}));

vi.mock("./globals.css", () => ({}));

import { metadata } from "./layout";

describe("root layout metadata", () => {
  it("usa el título institucional", () => {
    expect(metadata.title).toBe("Afiliaciones IIMP");
  });

  it("usa la descripción institucional", () => {
    expect(metadata.description).toBe(
      "Sistema de Afiliaciones del Instituto de Ingenieros de Minas del Perú",
    );
  });

  it("referencia el favicon institucional", () => {
    const icons = (metadata.icons ?? {}) as { icon?: string };
    expect(icons.icon).toBe("https://afiliacion.iimp.org.pe/img/favicon.ico");
  });
});
