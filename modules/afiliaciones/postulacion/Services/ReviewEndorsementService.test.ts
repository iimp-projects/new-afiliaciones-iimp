import { beforeEach, describe, expect, it, vi } from "vitest";
import jwt from "jsonwebtoken";
import { ENDORSEMENT_AUDIENCE, ENDORSEMENT_ISSUER, signEndorsementToken } from "./EndorsementToken";

const mocks = vi.hoisted(() => ({
  findFirst: vi.fn(),
  update: vi.fn(),
  securityEventCreate: vi.fn(),
  transaction: vi.fn(),
  recalculate: vi.fn(),
  sendMail: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    membershipApproval: { findFirst: mocks.findFirst },
    $transaction: mocks.transaction,
  },
}));
vi.mock("./ApplicationStatusCalculatorService", () => ({
  ApplicationStatusCalculatorService: class { recalculate = mocks.recalculate; },
}));
vi.mock("@/modules/shared/Services/MailService", () => ({
  MailService: class { sendMail = mocks.sendMail; },
}));

import { ReviewEndorsementService } from "./ReviewEndorsementService";

const SECRET = "test-endorsement-secret";
const approval = {
  id: 11,
  status: "PENDING",
  applicationId: 7,
  sponsorPersonId: 42,
  application: { person: { firstName: "Ana", paternalLastName: "Pérez" }, email: "ana@example.com" },
  sponsorPerson: { firstName: "Luis", paternalLastName: "Gómez", contacts: [] },
};

describe("ReviewEndorsementService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.JWT_SECRET = SECRET;
    mocks.findFirst.mockResolvedValue(approval);
    mocks.transaction.mockImplementation(async (callback: (tx: unknown) => unknown) =>
      callback({ membershipApproval: { update: mocks.update }, securityEvent: { create: mocks.securityEventCreate } }),
    );
    mocks.recalculate.mockResolvedValue(undefined);
    mocks.sendMail.mockResolvedValue(undefined);
  });

  it("registra un aval con un token válido", async () => {
    const token = signEndorsementToken({ applicationId: 7, sponsorPersonId: 42 });

    await new ReviewEndorsementService().execute(token, "APPROVE");

    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 11 },
      data: expect.objectContaining({ status: "APPROVED" }),
    }));
  });

  it("rechaza un token expirado", async () => {
    const token = jwt.sign({ applicationId: 7, sponsorPersonId: 42 }, SECRET, { expiresIn: -10 });

    await expect(new ReviewEndorsementService().execute(token, "APPROVE")).rejects.toThrow("El enlace ha expirado.");
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("rechaza un token destinado a otro flujo", async () => {
    const token = jwt.sign({ applicationId: 7, sponsorPersonId: 42, purpose: "payment-restore" }, SECRET, {
      issuer: ENDORSEMENT_ISSUER,
      audience: ENDORSEMENT_AUDIENCE,
    });

    await expect(new ReviewEndorsementService().execute(token, "APPROVE")).rejects.toThrow("El enlace es inválido o no posee un formato correcto.");
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("bloquea el replay de un aval ya procesado", async () => {
    mocks.findFirst.mockResolvedValue({ ...approval, status: "APPROVED" });
    const token = signEndorsementToken({ applicationId: 7, sponsorPersonId: 42 });

    await expect(new ReviewEndorsementService().execute(token, "APPROVE")).rejects.toThrow(/ya fue procesada/);
    expect(mocks.update).not.toHaveBeenCalled();
  });
});
