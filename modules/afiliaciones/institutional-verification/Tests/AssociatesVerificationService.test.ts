import { describe, expect, it, vi } from "vitest";
import type { SieAssociateState } from "@/modules/afiliaciones/associates-integration/Models/AssociateIntegration";
import { AssociatesVerificationService } from "../Services/AssociatesVerificationService";

const NOW = new Date("2026-06-15T12:00:00.000Z");

function client(state: SieAssociateState) {
  return { getAssociateState: vi.fn().mockResolvedValue(state) };
}

describe("AssociatesVerificationService", () => {
  it("consulta SIE por tipo y número de documento sin depender de Person ni User", async () => {
    const sie = client({ status: false, message: "No encontrado" });
    const service = new AssociatesVerificationService(sie, () => NOW);

    const result = await service.verify({ documentType: "DNI", documentNumber: "12345678" });

    expect(sie.getAssociateState).toHaveBeenCalledWith({ tipoDocumento: "1", numDocumento: "12345678" });
    expect(result).toMatchObject({ status: "NOT_ASSOCIATE", associate: false });
    expect(result.verifiedAt).toBe(NOW.toISOString());
  });

  it.each([
    ["DNI", "1", "12345678"],
    ["CE", "4", "12345678901"],
    ["PASSPORT", "7", "A1234567"],
  ] as const)("mapea %s al tipo de documento SIE %s", async (documentType, sieType, documentNumber) => {
    const sie = client({ status: false, message: "No encontrado" });
    const service = new AssociatesVerificationService(sie, () => NOW);

    await service.verify({ documentType, documentNumber });

    expect(sie.getAssociateState).toHaveBeenCalledWith({ tipoDocumento: sieType, numDocumento: documentNumber });
  });

  it("5. verifica un asociado histórico (sin Person ni User) exclusivamente contra SIE", async () => {
    const sie = client({
      status: true,
      cuotas: [{
        concepto: "CUOTA", numero: 1, monto: 100, moneda: "S/", anno: 2026, tipo: "Vitalicio",
        estadoContable: "Pendiente", fechaPago: "", fechaInicio: "", fechaFin: "", docGSer: "", docGNro: "",
      }],
    });
    const service = new AssociatesVerificationService(sie, () => NOW);

    const result = await service.verify({ documentType: "DNI", documentNumber: "99999999" });

    expect(result).toMatchObject({ status: "ELIGIBLE", membershipType: "VITALICIO", eligible: true });
  });
});
