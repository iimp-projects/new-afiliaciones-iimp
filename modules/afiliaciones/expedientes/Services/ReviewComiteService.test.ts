import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findUser: vi.fn(),
  findApplication: vi.fn(),
  updateValidation: vi.fn(),
  createHistory: vi.fn(),
  createSecurityEvent: vi.fn(),
  recalculate: vi.fn(),
  processAfterCommit: vi.fn(),
  provision: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findFirst: mocks.findUser },
    membershipApplication: { findUnique: mocks.findApplication },
    $transaction: async (callback: (tx: unknown) => Promise<void>) =>
      callback({
        membershipValidation: { update: mocks.updateValidation },
        membershipValidationHistory: { create: mocks.createHistory },
        securityEvent: { create: mocks.createSecurityEvent },
      }),
  },
}));

vi.mock("@/modules/afiliaciones/postulacion/Services/ApplicationStatusCalculatorService", () => ({
  ApplicationStatusCalculatorService: class {
    recalculate = mocks.recalculate;
  },
}));

vi.mock("@/modules/afiliaciones/associates-integration/Services/AssociatesIntegrationService", () => ({
  AssociatesIntegrationService: class {},
}));

vi.mock("@/modules/afiliaciones/expedientes/Services/AdministrativeStatusPostCommitService", () => ({
  processPreparedStudentIntegrationAfterCommit: mocks.processAfterCommit,
}));

vi.mock("@/modules/afiliaciones/asociados/Services/AssociateProvisioningService", () => ({
  AssociateProvisioningService: class {
    provisionCompletedApplication = mocks.provision;
  },
}));

import { ReviewComiteError, ReviewComiteService } from "./ReviewComiteService";
import { signComiteReviewToken } from "./ComiteReviewToken";

function application(status: "PENDING" | "APPROVED" = "PENDING") {
  return {
    id: 7,
    validations: [
      { id: 70, status, department: { code: "COMITE" } },
    ],
  };
}

describe("ReviewComiteService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.JWT_SECRET = "test-comite-review-secret";
    mocks.findUser.mockResolvedValue({
      id: 42,
      email: "comite@iimp.org.pe",
      person: { firstName: "Comité", paternalLastName: "Uno" },
    });
    mocks.findApplication.mockResolvedValue(application());
  });

  it("registra la aprobación del miembro del comité", async () => {
    const token = signComiteReviewToken({ applicationId: 7, committeeUserId: 42 });

    await new ReviewComiteService().execute(token, "APPROVE");

    expect(mocks.updateValidation).toHaveBeenCalledWith({
      where: { id: 70 },
      data: expect.objectContaining({ status: "APPROVED", validatedById: 42 }),
    });
    expect(mocks.createHistory).toHaveBeenCalledWith({
      data: expect.objectContaining({ validationId: 70, userId: 42, action: "APPROVED" }),
    });
    expect(mocks.recalculate).toHaveBeenCalledWith(7, expect.anything(), expect.any(Function));
  });

  it("exige motivo al rechazar", async () => {
    const token = signComiteReviewToken({ applicationId: 7, committeeUserId: 42 });

    await expect(new ReviewComiteService().execute(token, "REJECT")).rejects.toMatchObject({
      code: "INVALID_COMMENT",
    });
    expect(mocks.updateValidation).not.toHaveBeenCalled();
  });

  it("rechaza el enlace si el usuario ya no es miembro activo del comité", async () => {
    mocks.findUser.mockResolvedValue(null);
    const token = signComiteReviewToken({ applicationId: 7, committeeUserId: 42 });

    await expect(new ReviewComiteService().execute(token, "APPROVE")).rejects.toBeInstanceOf(
      ReviewComiteError,
    );
    expect(mocks.findApplication).not.toHaveBeenCalled();
  });

  it("no permite procesar una evaluación ya resuelta", async () => {
    mocks.findApplication.mockResolvedValue(application("APPROVED"));
    const token = signComiteReviewToken({ applicationId: 7, committeeUserId: 42 });

    await expect(new ReviewComiteService().execute(token, "APPROVE")).rejects.toMatchObject({
      code: "ALREADY_PROCESSED",
    });
    expect(mocks.updateValidation).not.toHaveBeenCalled();
  });
});
