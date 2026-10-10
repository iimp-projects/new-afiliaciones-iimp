import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  requireApiPermission: vi.fn(),
  transaction: vi.fn(),
  departmentFindUnique: vi.fn(),
  validationFindUnique: vi.fn(),
  validationUpdate: vi.fn(),
  historyCreate: vi.fn(),
  observationCreate: vi.fn(),
  recalculate: vi.fn(),
  processPostCommit: vi.fn(),
  provision: vi.fn(),
  notifyComite: vi.fn(),
  notifyApplicant: vi.fn(),
}));

vi.mock("@/modules/auth/context/api-authorization", () => ({
  requireApiPermission: mocks.requireApiPermission,
  apiAuthorizationStatus: (error: unknown, fallback = 500) => {
    const e = error as { status?: number } | null;
    return typeof e === "object" && e !== null && typeof e.status === "number" ? e.status : fallback;
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: mocks.transaction,
  },
}));

vi.mock("@/modules/shared/Services/S3StorageService", () => ({
  S3StorageService: class {
    getObjectKey(url: string) {
      if (!url || url.includes("..") || !url.startsWith("afiliaciones/applications/")) {
        throw new Error("clave inválida");
      }
      return url;
    }
  },
  isObjectKeyAllowed: (key: string, prefixes: readonly string[]) =>
    prefixes.some((prefix) => key.startsWith(`${prefix.replace(/\/+$/, "")}/`)),
}));

vi.mock("@/modules/afiliaciones/postulacion/Services/ApplicationStatusCalculatorService", () => ({
  ApplicationStatusCalculatorService: class { recalculate = mocks.recalculate; },
}));
vi.mock("@/modules/afiliaciones/associates-integration/Services/AssociatesIntegrationService", () => ({
  AssociatesIntegrationService: class {},
}));
vi.mock("@/modules/afiliaciones/expedientes/Services/AdministrativeStatusPostCommitService", () => ({
  processPreparedStudentIntegrationAfterCommit: mocks.processPostCommit,
}));
vi.mock("@/modules/afiliaciones/asociados/Services/AssociateProvisioningService", () => ({
  AssociateProvisioningService: class { provisionCompletedApplication = mocks.provision; },
}));
vi.mock("@/modules/afiliaciones/expedientes/Services/NotifyComiteService", () => ({
  NotifyComiteService: class { execute = mocks.notifyComite; },
}));
vi.mock("@/modules/afiliaciones/postulacion/Services/NotifyApplicantService", () => ({
  NotifyApplicantService: class { notifyObservationCreated = mocks.notifyApplicant; },
}));

import { PATCH } from "./route";

const makeRequest = (body: Record<string, unknown>) =>
  new NextRequest("http://localhost/api/afiliaciones/expedientes/26/status", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

const context = { params: Promise.resolve({ id: "26" }) };

describe("status route — evidencia de cambio de estado", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireApiPermission.mockResolvedValue({ id: 1, role: { slug: "LOGISTICA" } });
    mocks.departmentFindUnique.mockResolvedValue({ id: 9, name: "Logística" });
    mocks.validationFindUnique.mockResolvedValue({ id: 10 });
    mocks.validationUpdate.mockResolvedValue({});
    mocks.historyCreate.mockResolvedValue({});
    mocks.observationCreate.mockResolvedValue({});
    mocks.recalculate.mockResolvedValue("PENDING");
    mocks.processPostCommit.mockResolvedValue(undefined);
    mocks.notifyComite.mockResolvedValue(undefined);
    mocks.notifyApplicant.mockResolvedValue(undefined);
    mocks.transaction.mockImplementation(async (fn: (tx: any) => Promise<any>) => {
      const tx = {
        membershipDepartment: { findUnique: mocks.departmentFindUnique },
        membershipValidation: { findUnique: mocks.validationFindUnique, update: mocks.validationUpdate },
        membershipValidationHistory: { create: mocks.historyCreate },
        membershipObservation: { create: mocks.observationCreate },
      };
      return fn(tx);
    });
  });

  const evidence = {
    attachmentUrl: "afiliaciones/applications/26/observations/evidencia.pdf",
    attachmentName: "evidencia.pdf",
    mimeType: "application/pdf",
  };

  it("APPROVED + evidencia persiste attachmentUrl/name/mimeType en el historial", async () => {
    const res = await PATCH(makeRequest({ newStatus: "APPROVED", reason: "Conforme", ...evidence }), context);
    expect(res.status).toBe(200);
    const data = mocks.historyCreate.mock.calls[0][0].data;
    expect(data).toMatchObject({ attachmentUrl: evidence.attachmentUrl, attachmentName: evidence.attachmentName, mimeType: evidence.mimeType });
    expect(mocks.observationCreate).not.toHaveBeenCalled();
  });

  it("APPROVED sin evidencia persiste historial sin attachment", async () => {
    const res = await PATCH(makeRequest({ newStatus: "APPROVED", reason: "Conforme" }), context);
    expect(res.status).toBe(200);
    const data = mocks.historyCreate.mock.calls[0][0].data;
    expect(data.attachmentUrl).toBeNull();
    expect(data.attachmentName).toBeNull();
    expect(data.mimeType).toBeNull();
  });

  it("OBSERVED + evidencia persiste historial y MembershipObservation.attachmentUrl", async () => {
    const res = await PATCH(makeRequest({ newStatus: "OBSERVED", reason: "Falta info", fieldPaths: ["personalInformation.phone"], ...evidence }), context);
    expect(res.status).toBe(200);
    expect(mocks.historyCreate.mock.calls[0][0].data).toMatchObject({ attachmentUrl: evidence.attachmentUrl });
    expect(mocks.observationCreate.mock.calls[0][0].data).toMatchObject({ attachmentUrl: evidence.attachmentUrl });
  });

  it("OBSERVED sin evidencia deja attachmentUrl nulo en la observación", async () => {
    const res = await PATCH(makeRequest({ newStatus: "OBSERVED", reason: "Falta info", fieldPaths: ["personalInformation.phone"] }), context);
    expect(res.status).toBe(200);
    expect(mocks.observationCreate.mock.calls[0][0].data.attachmentUrl).toBeNull();
  });

  it("OBSERVED + evidencia transmite la referencia del adjunto a la notificación", async () => {
    const res = await PATCH(makeRequest({ newStatus: "OBSERVED", reason: "Falta info", fieldPaths: ["personalInformation.phone"], ...evidence }), context);
    expect(res.status).toBe(200);
    expect(mocks.notifyApplicant).toHaveBeenCalledWith(26, "Falta info", ["personalInformation.phone"], expect.objectContaining({ attachmentUrl: evidence.attachmentUrl }));
  });

  it("APPROVED + evidencia transmite la referencia del adjunto a la notificación del comité", async () => {
    const res = await PATCH(makeRequest({ newStatus: "APPROVED", reason: "Conforme", ...evidence }), context);
    expect(res.status).toBe(200);
    expect(mocks.notifyComite).toHaveBeenCalledWith(26, false, undefined, undefined, undefined, expect.objectContaining({ attachmentUrl: evidence.attachmentUrl }));
  });

  it("REJECTED + evidencia persiste en el historial", async () => {
    const res = await PATCH(makeRequest({ newStatus: "REJECTED", reason: "Rechazado", ...evidence }), context);
    expect(res.status).toBe(200);
    expect(mocks.historyCreate.mock.calls[0][0].data).toMatchObject({ attachmentUrl: evidence.attachmentUrl, attachmentName: evidence.attachmentName, mimeType: evidence.mimeType });
  });

  it("REOPENED (PENDING) + evidencia persiste en el historial", async () => {
    const res = await PATCH(makeRequest({ newStatus: "PENDING", reason: "Reabrir", ...evidence }), context);
    expect(res.status).toBe(200);
    expect(mocks.historyCreate.mock.calls[0][0].data).toMatchObject({ attachmentUrl: evidence.attachmentUrl, attachmentName: evidence.attachmentName, mimeType: evidence.mimeType });
  });

  it("rechaza evidencia de otro expediente (400) y no persiste", async () => {
    const res = await PATCH(makeRequest({ newStatus: "APPROVED", reason: "Conforme", attachmentUrl: "afiliaciones/applications/27/observations/otro.pdf" }), context);
    expect(res.status).toBe(400);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("rechaza URL/key arbitraria (400) y no persiste", async () => {
    const res = await PATCH(makeRequest({ newStatus: "APPROVED", reason: "Conforme", attachmentUrl: "https://evil.example.com/x.pdf" }), context);
    expect(res.status).toBe(400);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
});
