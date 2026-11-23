import { describe, expect, it } from "vitest";
import { ExpedienteMapper } from "./ExpedienteMapper";

const app = (documentType: unknown, documentNumber: string) => ({
  id: 1,
  trackingCode: "APP-1",
  status: "COMPLETED",
  affiliateType: "ACTIVE",
  documentType,
  documentNumber,
  updatedAt: new Date("2026-09-03T10:00:00.000Z"),
  person: { firstName: "Andrea", paternalLastName: "Paredes", maternalLastName: null },
  documents: [],
  payments: [],
  approvals: [],
  validations: [],
  areaValidations: [],
  observations: [],
  operationalAlerts: undefined,
});

describe("ExpedienteMapper — subtítulo de documento", () => {
  it("usa el tipo real DNI", async () => {
    const card = await ExpedienteMapper.toCardData(app("DNI", "41000057"));
    expect(card.identity.subtitle).toBe("DNI 41000057");
  });

  it("usa el tipo real CE", async () => {
    const card = await ExpedienteMapper.toCardData(app("CE", "001234567"));
    expect(card.identity.subtitle).toBe("CE 001234567");
  });

  it("muestra Pasaporte y conserva el número alfanumérico", async () => {
    const card = await ExpedienteMapper.toCardData(app("PASSPORT", "P14138404"));
    expect(card.identity.subtitle).toBe("Pasaporte P14138404");
  });

  it("muestra Documento para OTHER sin alterar el número", async () => {
    const card = await ExpedienteMapper.toCardData(app("OTHER", "G33052626"));
    expect(card.identity.subtitle).toBe("Documento G33052626");
  });

  it("muestra Documento cuando el tipo no está registrado", async () => {
    const card = await ExpedienteMapper.toCardData(app(null, "P11219869"));
    expect(card.identity.subtitle).toBe("Documento P11219869");
  });
});

describe("ExpedienteMapper — origen del pago", () => {
  const paidApp = (payment: Record<string, unknown>) => ({ ...app("DNI", "41000057"), payments: [payment] });
  const paymentValidation = async (payment: Record<string, unknown>) => {
    const card = await ExpedienteMapper.toCardData(paidApp(payment));
    return card.atomicValidations?.find((validation) => validation.label === "Pago");
  };

  it("muestra Manual para pagos migrados con gateway BANK_TRANSFER", async () => {
    const validation = await paymentValidation({ status: "PAID", gateway: "BANK_TRANSFER" });
    expect(validation?.statusLabel).toBe("Pagado");
    expect(validation?.assignee?.name).toBe("Manual");
  });

  it("muestra Manual para pagos registrados manualmente", async () => {
    const validation = await paymentValidation({
      status: "PAID",
      gateway: "BANK_TRANSFER",
      paymentChannel: "MANUAL",
      gatewayPayload: { manualPayment: true },
    });
    expect(validation?.assignee?.name).toBe("Manual");
  });

  it("muestra Pasarela para pagos Niubiz", async () => {
    const validation = await paymentValidation({ status: "PAID", gateway: "NIUBIZ", paymentChannel: "web" });
    expect(validation?.assignee?.name).toBe("Pasarela");
  });

  it("no muestra origen cuando el pago está pendiente", async () => {
    const validation = await paymentValidation({ status: "PENDING", gateway: "NIUBIZ" });
    expect(validation?.statusLabel).toBe("Pendiente");
    expect(validation?.assignee?.name).toBe("");
  });
});
