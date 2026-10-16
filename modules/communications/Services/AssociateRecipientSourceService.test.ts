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

function repository(overrides: Partial<{
  listEligible: unknown;
  listExcluded: unknown;
  countEligibleValid: unknown;
  countEligible: unknown;
}> = {}) {
  return {
    listEligible: overrides.listEligible ?? vi.fn().mockResolvedValue([]),
    listExcluded: overrides.listExcluded ?? vi.fn().mockResolvedValue({ items: [], total: 0, byReason: {}, nonAssociate: 0 }),
    countEligibleValid: overrides.countEligibleValid ?? vi.fn().mockResolvedValue(0),
    countEligible: overrides.countEligible ?? vi.fn().mockResolvedValue(0),
  } as unknown as AssociateRecipientRepository;
}

describe("AssociateRecipientSourceService.preview", () => {
  it("reporta totalEligible real (no el tamaño de la muestra)", async () => {
    const repo = repository({
      listEligible: vi.fn().mockResolvedValue(Array.from({ length: 50 }, (_, i) => candidate({ userId: i + 1 }))),
      countEligibleValid: vi.fn().mockResolvedValue(3361),
    });
    const service = new AssociateRecipientSourceService(repo);
    const result = await service.preview("ALL");

    expect(result.totalEligible).toBe(3361);
    expect(result.shownCount).toBe(50);
    expect(result.eligible).toHaveLength(50);
  });

  it("filtra correos inválidos de la muestra y mantiene totalEligible real", async () => {
    const repo = repository({
      listEligible: vi.fn().mockResolvedValue([
        candidate({ userId: 1, correoAcceso: "ok@iimp.org.pe" }),
        candidate({ userId: 2, correoAcceso: "invalido" }),
      ]),
      countEligibleValid: vi.fn().mockResolvedValue(3361),
    });
    const service = new AssociateRecipientSourceService(repo);
    const result = await service.preview("ALL");

    expect(result.totalEligible).toBe(3361);
    expect(result.shownCount).toBe(1);
    expect(result.eligible.map((item) => item.userId)).toEqual([1]);
  });

  it("propaga el filtro a listEligible, listExcluded y countEligibleValid", async () => {
    const repo = repository({
      listEligible: vi.fn().mockResolvedValue([]),
      listExcluded: vi.fn().mockResolvedValue({ items: [], total: 0, byReason: {}, nonAssociate: 0 }),
      countEligibleValid: vi.fn().mockResolvedValue(0),
    });
    const service = new AssociateRecipientSourceService(repo);
    await service.preview("STUDENT");

    expect(repo.listEligible).toHaveBeenCalledWith("STUDENT", 0, 50);
    expect(repo.listExcluded).toHaveBeenCalledWith("STUDENT");
    expect(repo.countEligibleValid).toHaveBeenCalledWith("STUDENT");
  });

  it("propaga el desglose de excluidos y no-asociados", async () => {
    const repo = repository({
      listEligible: vi.fn().mockResolvedValue([]),
      listExcluded: vi.fn().mockResolvedValue({
        items: [{ personId: 1, documentNumber: "1", nombre: "A", correoContacto: "a@x.com", reason: "NO_ACCOUNT" }],
        total: 425,
        byReason: { NO_ACCOUNT: 402, NO_ACCESS_EMAIL: 22, NOT_ELIGIBLE_ACCOUNT: 1 },
        nonAssociate: 4676,
      }),
      countEligibleValid: vi.fn().mockResolvedValue(3361),
    });
    const service = new AssociateRecipientSourceService(repo);
    const result = await service.preview("ALL");

    expect(result.totalExcluded).toBe(425);
    expect(result.totalNonAssociate).toBe(4676);
    expect(result.excludedByReason).toEqual({ NO_ACCOUNT: 402, NO_ACCESS_EMAIL: 22, NOT_ELIGIBLE_ACCOUNT: 1 });
  });
});

describe("AssociateRecipientSourceService.collectEligible", () => {
  it("pagina en lotes y deduplica por cuenta", async () => {
    const repo = repository({
      countEligible: vi.fn().mockResolvedValue(3),
      listEligible: vi.fn()
        .mockResolvedValueOnce([candidate({ userId: 1 }), candidate({ userId: 2 })])
        .mockResolvedValueOnce([candidate({ userId: 2 }), candidate({ userId: 3, correoAcceso: "invalido" })]),
    });
    const service = new AssociateRecipientSourceService(repo);
    const result = await service.collectEligible("ALL");

    expect(result.map((item) => item.userId)).toEqual([1, 2]);
    expect(result.every((item) => item.source === "associates")).toBe(true);
    expect(result.every((item) => item.correoAcceso === "juan@iimp.org.pe")).toBe(true);
  });

  it("usa countEligible como total y no depende de countEligibleValid", async () => {
    const repo = repository({
      countEligible: vi.fn().mockResolvedValue(0),
      listEligible: vi.fn().mockResolvedValue([]),
    });
    const service = new AssociateRecipientSourceService(repo);
    await service.collectEligible("ACTIVE");

    expect(repo.countEligible).toHaveBeenCalledWith("ACTIVE");
    expect(repo.countEligibleValid).not.toHaveBeenCalled();
  });
});
