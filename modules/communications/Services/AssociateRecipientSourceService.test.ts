import { describe, expect, it, vi } from "vitest";
import { AssociateRecipientSourceService } from "./AssociateRecipientSourceService";
import type { AssociateRecipientRepository } from "../Repositories/AssociateRecipientRepository";
import type { AssociateRecipientCandidate } from "../Models/AssociateRecipient";

function candidate(overrides: Partial<AssociateRecipientCandidate> = {}): AssociateRecipientCandidate {
  return {
    userId: 1,
    personId: 10,
    nombreCompleto: "Juan Pérez",
    correoAcceso: "juan@iimp.org.pe",
    tipoAsociado: "ACTIVO",
    accountStatus: "ACTIVE",
    documentNumber: "12345678",
    ...overrides,
  };
}

describe("AssociateRecipientSourceService", () => {
  it("preview filtra correos de acceso inválidos", async () => {
    const repository = {
      listEligible: vi.fn().mockResolvedValue([
        candidate({ userId: 1, correoAcceso: "ok@iimp.org.pe" }),
        candidate({ userId: 2, correoAcceso: "invalido" }),
      ]),
      listExcluded: vi.fn().mockResolvedValue({ items: [], total: 0 }),
    };
    const service = new AssociateRecipientSourceService(repository as unknown as AssociateRecipientRepository);
    const result = await service.preview("ALL");
    expect(result.totalEligible).toBe(1);
    expect(result.eligible.map((item) => item.userId)).toEqual([1]);
  });

  it("collectEligible pagina en lotes y deduplica por cuenta", async () => {
    const repository = {
      countEligible: vi.fn().mockResolvedValue(3),
      listEligible: vi.fn()
        .mockResolvedValueOnce([candidate({ userId: 1 }), candidate({ userId: 2 })])
        .mockResolvedValueOnce([candidate({ userId: 2 }), candidate({ userId: 3, correoAcceso: "invalido" })]),
    };
    const service = new AssociateRecipientSourceService(repository as unknown as AssociateRecipientRepository);
    const result = await service.collectEligible("ALL");
    expect(result.map((item) => item.userId)).toEqual([1, 2]);
    expect(result.every((item) => item.source === "associates")).toBe(true);
    expect(result.every((item) => item.correoAcceso === "juan@iimp.org.pe")).toBe(true);
  });
});
