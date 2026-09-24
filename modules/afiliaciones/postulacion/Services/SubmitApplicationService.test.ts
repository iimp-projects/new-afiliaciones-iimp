import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  applicantExecute: vi.fn(),
  sponsorExecute: vi.fn(),
  generatePdf: vi.fn(),
  getObjectBuffer: vi.fn(),
}));

vi.mock("./NotifyApplicantService", () => ({ NotifyApplicantService: class { execute = mocks.applicantExecute; } }));
vi.mock("./NotifySponsorsService", () => ({ NotifySponsorsService: class { execute = mocks.sponsorExecute; } }));
vi.mock("./DeclarationPdfService", () => ({ DeclarationPdfService: class { generate = mocks.generatePdf; } }));
vi.mock("./ApplicationAccessService", () => ({ ApplicationAccessService: class { require() {} } }));
vi.mock("@/modules/shared/Services/S3StorageService", () => ({ S3StorageService: class { getObjectBuffer = mocks.getObjectBuffer; } }));

import { SubmitApplicationService } from "./SubmitApplicationService";

const app = (overrides: Record<string, unknown> = {}) => ({
  id: 7,
  status: "DRAFT",
  trackingCode: "private-7",
  affiliateType: "ACTIVE",
  draftData: { membershipType: "ACTIVE" },
  ...overrides,
});

function repo(overrides: Record<string, unknown> = {}) {
  return {
    findByTrackingCode: vi.fn().mockResolvedValue(app()),
    submitApplication: vi.fn().mockResolvedValue(app({ status: "PENDING" })),
    findSwornDeclaration: vi.fn().mockResolvedValue(null),
    ...overrides,
  };
}

describe("SubmitApplicationService — adjunta la Declaración Jurada firmada", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.applicantExecute.mockResolvedValue(undefined);
    mocks.sponsorExecute.mockResolvedValue(undefined);
    mocks.generatePdf.mockResolvedValue(new Uint8Array(Buffer.from("GENERATED_UNSIGNED_PDF")));
    mocks.getObjectBuffer.mockResolvedValue(Buffer.from("SIGNED_PDF"));
  });

  it("adjunta el buffer firmado al postulante y a los avales, sin regenerar el PDF", async () => {
    const repository = repo({
      findSwornDeclaration: vi.fn().mockResolvedValue({
        id: "doc-1",
        applicationId: 7,
        category: "SWORN_DECLARATION",
        fileUrl: "afiliaciones/applications/7/declarations/signed.pdf",
      }),
    });
    const validator = { validate: vi.fn().mockReturnValue({ valid: true, errors: [] }) };

    await new SubmitApplicationService(repository as never, validator as never).execute("private-7", "token");

    expect(mocks.getObjectBuffer).toHaveBeenCalledWith(
      "afiliaciones/applications/7/declarations/signed.pdf",
      ["afiliaciones/applications/7"],
    );
    expect(mocks.generatePdf).not.toHaveBeenCalled();

    const applicantBuffer = mocks.applicantExecute.mock.calls[0][2] as Buffer;
    const sponsorBuffer = mocks.sponsorExecute.mock.calls[0][2] as Buffer;
    expect(applicantBuffer.toString()).toBe("SIGNED_PDF");
    expect(sponsorBuffer.toString()).toBe("SIGNED_PDF");
    expect(applicantBuffer.toString()).not.toBe("GENERATED_UNSIGNED_PDF");
  });

  it("bloquea la descarga de un documento perteneciente a otra aplicación", async () => {
    const repository = repo({
      findSwornDeclaration: vi.fn().mockResolvedValue({
        id: "doc-1",
        applicationId: 999,
        category: "SWORN_DECLARATION",
        fileUrl: "afiliaciones/applications/999/declarations/signed.pdf",
      }),
    });
    const validator = { validate: vi.fn().mockReturnValue({ valid: true, errors: [] }) };

    await new SubmitApplicationService(repository as never, validator as never).execute("private-7", "token");

    expect(mocks.getObjectBuffer).not.toHaveBeenCalled();
    expect(mocks.applicantExecute.mock.calls[0][2]).toBeUndefined();
  });

  it("no regenera el PDF cuando falta SWORN_DECLARATION (sin fallback)", async () => {
    const repository = repo({ findSwornDeclaration: vi.fn().mockResolvedValue(null) });
    const validator = { validate: vi.fn().mockReturnValue({ valid: true, errors: [] }) };

    await new SubmitApplicationService(repository as never, validator as never).execute("private-7", "token");

    expect(mocks.generatePdf).not.toHaveBeenCalled();
    expect(mocks.applicantExecute.mock.calls[0][2]).toBeUndefined();
  });
});
