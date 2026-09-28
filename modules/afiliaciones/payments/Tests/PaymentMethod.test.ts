import { describe, expect, it } from "vitest";
import { paymentMethodLabel } from "../Models/PaymentMethod";

describe("paymentMethodLabel", () => {
  it("resuelve WALLET con marcas conocidas", () => {
    expect(paymentMethodLabel("WALLET", "YAPE")).toBe("Yape");
    expect(paymentMethodLabel("WALLET", "PLIN")).toBe("Plin");
  });

  it("cae a la categoría cuando WALLET no tiene marca", () => {
    expect(paymentMethodLabel("WALLET", null)).toBe("Billetera digital");
    expect(paymentMethodLabel("WALLET", undefined)).toBe("Billetera digital");
  });

  it("no muestra marcas arbitrarias sin normalización", () => {
    expect(paymentMethodLabel("WALLET", "SOME_UNKNOWN_WALLET")).toBe("Billetera digital");
    expect(paymentMethodLabel("WALLET", "<script>")).toBe("Billetera digital");
  });

  it("resuelve categorías sin marca", () => {
    expect(paymentMethodLabel("CARD", null)).toBe("Tarjeta");
    expect(paymentMethodLabel("BANK_TRANSFER", null)).toBe("Transferencia bancaria");
    expect(paymentMethodLabel("CASH", null)).toBe("Efectivo");
    expect(paymentMethodLabel("POINTS", null)).toBe("Puntos / Millas");
    expect(paymentMethodLabel("UNKNOWN", null)).toBe("No identificado");
    expect(paymentMethodLabel(undefined, null)).toBe("No identificado");
  });

  it("ignora la marca para métodos que no son WALLET", () => {
    expect(paymentMethodLabel("CARD", "YAPE")).toBe("Tarjeta");
  });
});
