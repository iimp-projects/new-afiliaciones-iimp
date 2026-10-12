import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  membershipObservation: { findMany: vi.fn() },
  specialty: { findUnique: vi.fn() },
  university: { findUnique: vi.fn() },
  $transaction: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({ prisma: db }));
vi.mock("../Services/NotifyApplicantService", () => ({ NotifyApplicantService: class { notifyCorrectionReceived = vi.fn(); } }));

import { UpdateDraftService } from "../Services/UpdateDraftService";
import { queryAuthorization } from "@/modules/afiliaciones/consulta/Services/QueryAuthorizationService";

const token = (id: number) => queryAuthorization.createAccess([id], id);

function repo() {
  return {
    findByTrackingCode: vi.fn(),
    updateDraft: vi.fn(),
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("AUTH_SECRET", "containment-tests-only-secret");
  db.membershipObservation.findMany.mockResolvedValue([]);
  db.specialty.findUnique.mockResolvedValue({ code: "ESP-MIN", name: "Ingeniería de Minas" });
  db.university.findUnique.mockResolvedValue({ name: "Universidad Nacional de Ingeniería" });
});

describe("Contención temporal de subsanaciones", () => {
  it("bloquea el guardado OBSERVED (Legacy) sin realizar escrituras", async () => {
    db.membershipObservation.findMany.mockResolvedValue([{ fieldPaths: ["academicStudies.0.universityLetter"] }]);
    const r = repo();
    r.findByTrackingCode.mockResolvedValue({
      id: 3145,
      trackingCode: "LEGACY-8109",
      status: "OBSERVED",
      affiliateType: "STUDENT",
      draftData: { academicStudies: [{ specialtyId: 575, specialty: "Ingeniería de Metalurgia y Materiales", admissionYear: 2022 }] },
    });

    const service = new UpdateDraftService(r as never);
    await expect(
      service.execute("LEGACY-8109", { currentStep: 1, draftData: { academicStudies: [{ specialtyId: 575, specialty: "Ingeniería de Metalurgia y Materiales", admissionYear: 2022, universityLetter: { url: "x", name: "c.pdf", type: "application/pdf" } }] } } as never, token(3145)),
    ).rejects.toThrow("mantenimiento");

    expect(r.updateDraft).not.toHaveBeenCalled();
  });

  it("bloquea el guardado OBSERVED (nuevo) sin realizar escrituras", async () => {
    const r = repo();
    r.findByTrackingCode.mockResolvedValue({
      id: 500,
      trackingCode: "uuid-nuevo",
      status: "OBSERVED",
      affiliateType: "STUDENT",
      draftData: { academicStudies: [{ specialtyId: 1, specialty: "Ingeniería de Minas", admissionYear: 2022 }] },
    });

    const service = new UpdateDraftService(r as never);
    await expect(
      service.execute("uuid-nuevo", { currentStep: 1, draftData: {} } as never, token(500)),
    ).rejects.toThrow("mantenimiento");

    expect(r.updateDraft).not.toHaveBeenCalled();
  });

  it("no bloquea la postulación en BORRADOR", async () => {
    const r = repo();
    r.findByTrackingCode.mockResolvedValue({
      id: 600,
      trackingCode: "uuid-draft",
      status: "DRAFT",
      affiliateType: "ACTIVE",
      draftData: {},
    });
    r.updateDraft.mockResolvedValue({ id: 600 });

    const service = new UpdateDraftService(r as never);
    await expect(
      service.execute("uuid-draft", { currentStep: 1, draftData: {} } as never, token(600)),
    ).resolves.toBeDefined();

    expect(r.updateDraft).toHaveBeenCalled();
  });
});
