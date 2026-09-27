import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  hasPermission: vi.fn(),
  approvalFindUnique: vi.fn(),
  approvalUpdate: vi.fn(),
  applicationFindUnique: vi.fn(),
  sendSingleSponsorNotification: vi.fn(),
}));

vi.mock("@/modules/auth/context/service", () => ({
  contextService: { getCurrentUser: mocks.getCurrentUser, hasPermission: mocks.hasPermission },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    membershipApproval: {
      findUnique: mocks.approvalFindUnique,
      update: mocks.approvalUpdate,
    },
    membershipApplication: {
      findUnique: mocks.applicationFindUnique,
    },
  },
}));

vi.mock("@/modules/afiliaciones/postulacion/Services/NotifySponsorsService", () => ({
  NotifySponsorsService: class {
    sendSingleSponsorNotification = mocks.sendSingleSponsorNotification;
  },
}));

import { POST } from "./route";

const internalUser = {
  id: 1,
  status: "ACTIVE",
  type: "VALIDATOR",
  role: { slug: "ATENCION_ASOCIADO" },
  person: { firstName: "Ana", paternalLastName: "Pérez" },
  permissions: new Set<string>(),
};

const request = (body: unknown) =>
  new Request("http://localhost/api/afiliaciones/postulacion/avales/reenviar", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

describe("reenviar aval route — autorización institucional", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCurrentUser.mockResolvedValue(internalUser);
    mocks.hasPermission.mockResolvedValue(true);
    mocks.approvalFindUnique.mockResolvedValue({
      id: 15,
      applicationId: 26,
      status: "PENDING",
      resendHistory: [],
      sponsorPerson: {
        id: 9,
        firstName: "Aval",
        paternalLastName: "Hábil",
        user: { email: "aval@example.com" },
        contacts: [],
      },
    });
    mocks.applicationFindUnique.mockResolvedValue({
      id: 26,
      person: { firstName: "Postulante", paternalLastName: "Uno" },
      draftData: {},
    });
    mocks.approvalUpdate.mockResolvedValue({ id: 15 });
    mocks.sendSingleSponsorNotification.mockResolvedValue(undefined);
  });

  it("ATENCION_ASOCIADO con update:applications → 200 y reenvía", async () => {
    const response = await POST(request({ applicationId: 26, approvalId: 15, sponsorEmail: "aval@example.com" }));
    expect(response.status).toBe(200);
    expect(mocks.hasPermission).toHaveBeenCalledWith("update", "applications");
    expect(mocks.sendSingleSponsorNotification).toHaveBeenCalled();
    expect(mocks.approvalUpdate).toHaveBeenCalled();
  });

  it("usuario interno sin update:applications → 403", async () => {
    mocks.hasPermission.mockResolvedValue(false);
    const response = await POST(request({ applicationId: 26, approvalId: 15 }));
    expect(response.status).toBe(403);
    expect(mocks.approvalFindUnique).not.toHaveBeenCalled();
  });

  it("usuario no autenticado → 401", async () => {
    mocks.getCurrentUser.mockResolvedValue(null);
    const response = await POST(request({ applicationId: 26, approvalId: 15 }));
    expect(response.status).toBe(401);
  });

  it("approval que no pertenece a la application → 400", async () => {
    mocks.approvalFindUnique.mockResolvedValue({ id: 15, applicationId: 999, status: "PENDING", resendHistory: [] });
    const response = await POST(request({ applicationId: 26, approvalId: 15 }));
    expect(response.status).toBe(400);
    expect(mocks.sendSingleSponsorNotification).not.toHaveBeenCalled();
  });

  it("approval con status != PENDING → 400", async () => {
    mocks.approvalFindUnique.mockResolvedValue({ id: 15, applicationId: 26, status: "APPROVED", resendHistory: [] });
    const response = await POST(request({ applicationId: 26, approvalId: 15 }));
    expect(response.status).toBe(400);
  });
});
