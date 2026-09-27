import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { ApplicationFlowError } from "@/modules/afiliaciones/postulacion/Services/Exceptions/ApplicationFlowError";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  hasPermission: vi.fn(),
  applicationAccessRequire: vi.fn(),
  applicationFindUnique: vi.fn(),
  applicationUpdate: vi.fn(),
  personFindFirst: vi.fn(),
  approvalFindFirst: vi.fn(),
  transaction: vi.fn(),
  recalculate: vi.fn(),
  sendSingleSponsorNotification: vi.fn(),
  sendApplicantReplacementConfirmation: vi.fn(),
}));

vi.mock("@/modules/auth/context/service", () => ({
  contextService: { getCurrentUser: mocks.getCurrentUser, hasPermission: mocks.hasPermission },
}));

vi.mock("@/modules/afiliaciones/postulacion/Services/ApplicationAccessService", () => ({
  ApplicationAccessService: class {
    require = mocks.applicationAccessRequire;
  },
}));

vi.mock("@/modules/afiliaciones/consulta/Services/QueryAuthorizationService", () => ({
  QUERY_COOKIE: "iimp_application_access",
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    membershipApplication: {
      findUnique: mocks.applicationFindUnique,
      update: mocks.applicationUpdate,
    },
    person: { findFirst: mocks.personFindFirst },
    membershipApproval: { findFirst: mocks.approvalFindFirst },
    $transaction: mocks.transaction,
  },
}));

vi.mock("@/modules/afiliaciones/postulacion/Services/ApplicationStatusCalculatorService", () => ({
  ApplicationStatusCalculatorService: class {
    recalculate = mocks.recalculate;
  },
}));

vi.mock("@/modules/afiliaciones/postulacion/Services/NotifySponsorsService", () => ({
  NotifySponsorsService: class {
    sendSingleSponsorNotification = mocks.sendSingleSponsorNotification;
    sendApplicantReplacementConfirmation = mocks.sendApplicantReplacementConfirmation;
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
  new NextRequest("http://localhost/api/consulta/reemplazar-aval", {
    method: "POST",
    headers: { "content-type": "application/json", cookie: "iimp_application_access=public-token" },
    body: JSON.stringify(body),
  });

describe("reemplazar aval route — flujo dual institucional/público", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCurrentUser.mockResolvedValue(null);
    mocks.hasPermission.mockResolvedValue(false);
    mocks.applicationAccessRequire.mockImplementation(() => undefined);
    mocks.applicationFindUnique.mockResolvedValue({
      id: 26,
      status: "OBSERVED",
      deletedAt: null,
      email: "postulante@example.com",
      trackingCode: "T-26",
      applicationCode: "APP-26",
      person: { firstName: "Postulante", paternalLastName: "Uno" },
      approvals: [{ id: 15, sponsorPersonId: 1, status: "REJECTED" }],
      draftData: {},
    });
    mocks.personFindFirst.mockResolvedValue({
      id: 9,
      firstName: "Nuevo",
      paternalLastName: "Aval",
      documentNumber: "12345678",
      user: { email: "nuevo@example.com" },
      contacts: [],
    });
    mocks.approvalFindFirst.mockResolvedValue(null);
    mocks.transaction.mockResolvedValue({ newApproval: { id: 20 } });
    mocks.recalculate.mockResolvedValue("PENDING");
    mocks.sendSingleSponsorNotification.mockResolvedValue(undefined);
    mocks.sendApplicantReplacementConfirmation.mockResolvedValue(undefined);
    mocks.applicationUpdate.mockResolvedValue({ id: 26 });
  });

  it("ATENCION_ASOCIADO con update:applications → camino institucional permitido (sin exigir OBSERVED)", async () => {
    mocks.getCurrentUser.mockResolvedValue(internalUser);
    mocks.hasPermission.mockResolvedValue(true);
    mocks.applicationFindUnique.mockResolvedValue({
      id: 26,
      status: "PENDING",
      deletedAt: null,
      email: "postulante@example.com",
      trackingCode: "T-26",
      applicationCode: "APP-26",
      person: { firstName: "Postulante", paternalLastName: "Uno" },
      approvals: [{ id: 15, sponsorPersonId: 1, status: "REJECTED" }],
      draftData: {},
    });
    const response = await POST(request({ application_id: 26, approval_id: 15, dni: "12345678" }));
    expect(response.status).toBe(200);
    expect(mocks.hasPermission).toHaveBeenCalledWith("update", "applications");
    expect(mocks.applicationAccessRequire).not.toHaveBeenCalled();
  });

  it("usuario interno sin update:applications → 403 y no cae al flujo público", async () => {
    mocks.getCurrentUser.mockResolvedValue(internalUser);
    mocks.hasPermission.mockResolvedValue(false);
    const response = await POST(request({ application_id: 26, approval_id: 15, dni: "12345678" }));
    expect(response.status).toBe(403);
    expect(mocks.applicationAccessRequire).not.toHaveBeenCalled();
    expect(mocks.applicationFindUnique).not.toHaveBeenCalled();
  });

  it("postulante público con QUERY_COOKIE válido → flujo público preservado", async () => {
    mocks.getCurrentUser.mockResolvedValue(null);
    const response = await POST(request({ application_id: 26, approval_id: 15, dni: "12345678" }));
    expect(response.status).toBe(200);
    expect(mocks.applicationAccessRequire).toHaveBeenCalled();
    expect(mocks.hasPermission).not.toHaveBeenCalled();
  });

  it("postulante público sin verificación → 401 VERIFICATION_REQUIRED preservado", async () => {
    mocks.getCurrentUser.mockResolvedValue(null);
    mocks.applicationAccessRequire.mockImplementation(() => {
      throw new ApplicationFlowError("VERIFICATION_REQUIRED", "Verifica tu identidad para acceder a esta solicitud.", 401);
    });
    const response = await POST(request({ application_id: 26, approval_id: 15, dni: "12345678" }));
    expect(response.status).toBe(401);
    expect(mocks.applicationFindUnique).not.toHaveBeenCalled();
  });
});
