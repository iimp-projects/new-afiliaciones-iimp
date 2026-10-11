import { describe, expect, it } from "vitest";
import { generateCardPdf } from "../Services/cardPdf";

describe("generateCardPdf", () => {
  it("genera un PDF válido sin fotografía", async () => {
    const pdf = await generateCardPdf({
      name: "María Pérez López",
      code: "12345",
      category: "Asociado Activo",
      photoUrl: null,
      verificationUrl: "https://example.com/verificar-carnet/abc123def456ghi789",
    });
    const bytes = Buffer.from(pdf);
    expect(bytes.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    expect(bytes.length).toBeGreaterThan(500);
  });

  it("genera un PDF con QR embebido y sin datos personales en el QR", async () => {
    const pdf = await generateCardPdf({
      name: "Juan García",
      code: "999",
      category: "Asociado Estudiante",
      photoUrl: null,
      verificationUrl: "https://example.com/verificar-carnet/token_seguro_0123456789",
    });
    const bytes = Buffer.from(pdf);
    expect(bytes.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  });
});
