import { describe, expect, it, vi } from "vitest";
import { isUnstartedDraft } from "../Models/ApplicationAction";
import { ApplicationRepository } from "../Repositories/ApplicationRepository";
import { ApplicationFlowError } from "../Services/Exceptions/ApplicationFlowError";

function applicationRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 5411,
    applicationCode: "APP-1",
    trackingCode: "tracking-1",
    personId: null,
    documentType: "DNI",
    documentNumber: "73026904",
    email: "postulante@example.com",
    phone: "999999999",
    affiliateType: "STUDENT",
    status: "DRAFT",
    currentStep: 1,
    draftData: {},
    correspondencePreference: null,
    submittedAt: null,
    verifiedAt: null,
    lastAccessAt: null,
    expiresAt: null,
    createdAt: new Date("2026-11-13T02:49:12.000Z"),
    updatedAt: new Date("2026-11-13T02:49:12.000Z"),
    deletedAt: null,
    ...overrides,
  };
}

function repositoryWith(existing: unknown[], updated = applicationRow()) {
  const tx = {
    $executeRaw: vi.fn().mockResolvedValue(undefined),
    membershipApplication: {
      findMany: vi.fn(async (args: { where: { documentNumber?: string } }) => (args.where.documentNumber ? existing : [])),
      create: vi.fn(),
      update: vi.fn().mockResolvedValue(updated),
    },
    person: { findUnique: vi.fn().mockResolvedValue(null) },
  };
  return { tx, repository: new ApplicationRepository({ $transaction: (callback: (client: unknown) => unknown) => callback(tx) } as never) };
}

const startDto = {
  applicationCode: "APP-NEW",
  trackingCode: "tracking-new",
  affiliateType: "STUDENT" as const,
  documentType: "DNI" as const,
  documentNumber: "73026904",
  email: "nuevo@example.com",
  phone: "988888888",
  status: "DRAFT" as const,
  currentStep: 1,
  draftData: {},
};

describe("isUnstartedDraft", () => {
  it("marca como no iniciado un borrador sin datos personales", () => {
    expect(isUnstartedDraft("DRAFT", {})).toBe(true);
    expect(isUnstartedDraft("DRAFT", null)).toBe(true);
    expect(isUnstartedDraft("DRAFT", { personalInformation: {} })).toBe(true);
  });

  it("no marca como no iniciado un borrador con documento personal", () => {
    expect(isUnstartedDraft("DRAFT", { personalInformation: { documentNumber: "73026904" } })).toBe(false);
  });

  it("no aplica a estados distintos de DRAFT", () => {
    expect(isUnstartedDraft("OBSERVED", {})).toBe(false);
    expect(isUnstartedDraft("PENDING", null)).toBe(false);
  });

  it("no clasifica cuando la consulta no cargó draftData", () => {
    expect(isUnstartedDraft("DRAFT", undefined)).toBe(false);
  });
});

describe("createDraftIfAllowed con borradores huérfanos", () => {
  it("reutiliza el borrador vacío en lugar de crear otro o bloquear el inicio", async () => {
    const { tx, repository } = repositoryWith([applicationRow()]);

    const result = await repository.createDraftIfAllowed(startDto, []);

    expect(tx.membershipApplication.create).not.toHaveBeenCalled();
    expect(tx.membershipApplication.update).toHaveBeenCalledWith({
      where: { id: 5411 },
      data: { email: "nuevo@example.com", phone: "988888888", currentStep: 1 },
    });
    expect(result.trackingCode).toBe("tracking-1");
  });

  it("mantiene el bloqueo cuando el borrador ya tiene datos personales", async () => {
    const { tx, repository } = repositoryWith([
      applicationRow({ draftData: { personalInformation: { documentNumber: "73026904" } } }),
    ]);

    await expect(repository.createDraftIfAllowed(startDto, [])).rejects.toBeInstanceOf(ApplicationFlowError);
    expect(tx.membershipApplication.create).not.toHaveBeenCalled();
    expect(tx.membershipApplication.update).not.toHaveBeenCalled();
  });
});
