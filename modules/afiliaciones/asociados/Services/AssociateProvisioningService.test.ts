import { describe, expect, it, beforeEach, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({ $transaction: vi.fn() }));
const createAndSendActivation = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/modules/auth/account-activation/service", () => ({ accountActivationService: { createAndSendActivation } }));

import { AssociateProvisioningService } from "./AssociateProvisioningService";

type Tx = Record<string, any>;

function buildTx(overrides: Partial<Tx> = {}): Tx {
  return {
    membershipApplication: { findUnique: vi.fn() },
    $executeRaw: vi.fn(),
    role: { findUnique: vi.fn() },
    user: { findUnique: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
    auditLog: { create: vi.fn() },
    ...overrides,
  };
}

function completedApplication(affiliateType: "ACTIVE" | "STUDENT") {
  return {
    id: 42,
    deletedAt: null,
    status: "COMPLETED",
    affiliateType,
    email: "asociado@example.com",
    person: {
      id: 7,
      deletedAt: null,
      documentNumber: "12345678",
      contacts: [{ email: "asociado@example.com" }],
      user: null,
    },
  };
}

describe("AssociateProvisioningService.provisionCompletedApplication", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createAndSendActivation.mockResolvedValue(undefined);
  });

  it.each([
    ["ACTIVE", "ASOCIADO_ACTIVO"],
    ["STUDENT", "ASOCIADO_ESTUDIANTE"],
  ] as const)("crea cuenta PENDING para %s con rol %s y dispara la activación", async (affiliateType, roleSlug) => {
    const tx = buildTx();
    tx.membershipApplication.findUnique.mockResolvedValue(completedApplication(affiliateType));
    tx.role.findUnique.mockResolvedValue({ id: 2, slug: roleSlug, isActive: true });
    tx.user.findUnique.mockResolvedValue(null);
    tx.user.findFirst.mockResolvedValue(null);
    tx.user.create.mockResolvedValue({ id: 55 });
    prismaMock.$transaction.mockImplementation((callback: (client: Tx) => unknown) => callback(tx));

    const result = await new AssociateProvisioningService().provisionCompletedApplication(42);

    expect(result).toMatchObject({ userId: 55, created: true, role: roleSlug, activationRequired: true });
    const createCall = tx.user.create.mock.calls[0][0];
    expect(createCall.data).toMatchObject({ email: "asociado@example.com", personId: 7, roleId: 2, type: "AFFILIATE", status: "PENDING" });
    expect(createCall.data).not.toHaveProperty("password");
    expect(createCall.data).not.toHaveProperty("credentials");
    expect(tx.credential).toBeUndefined();
    expect(createAndSendActivation).toHaveBeenCalledWith(55);
  });

  it("reutiliza una cuenta existente sin volver a crearla y sin credencial fija", async () => {
    const tx = buildTx();
    tx.membershipApplication.findUnique.mockResolvedValue({
      ...completedApplication("ACTIVE"),
      person: { ...completedApplication("ACTIVE").person, user: { id: 55, status: "PENDING" } },
    });
    tx.role.findUnique.mockResolvedValue({ id: 2, slug: "ASOCIADO_ACTIVO", isActive: true });
    tx.user.findUnique.mockResolvedValue({ id: 55, status: "PENDING" });
    tx.user.update.mockResolvedValue({ id: 55, status: "PENDING" });
    prismaMock.$transaction.mockImplementation((callback: (client: Tx) => unknown) => callback(tx));

    const result = await new AssociateProvisioningService().provisionCompletedApplication(42);

    expect(result).toMatchObject({ userId: 55, created: false, activationRequired: true });
    expect(tx.user.create).not.toHaveBeenCalled();
    expect(createAndSendActivation).toHaveBeenCalledWith(55);
  });
});
