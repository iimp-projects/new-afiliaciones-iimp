import { describe, expect, it, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  requireRole: vi.fn(),
  getCurrentUser: vi.fn(),
  consume: vi.fn(),
  sendIndividual: vi.fn(),
  sendTest: vi.fn(),
  start: vi.fn(),
  processBatch: vi.fn(),
  retryFailed: vi.fn(),
  getProgress: vi.fn(),
  recoverStaleCampaign: vi.fn(),
}));

vi.mock("@/modules/auth/context/service", () => ({
  contextService: { requireRole: mocks.requireRole, getCurrentUser: mocks.getCurrentUser },
}));
vi.mock("@/modules/auth/rate-limit/VerificationTokenRateLimiter", () => ({
  verificationTokenRateLimiter: { consume: mocks.consume },
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("../Services/CampaignMailService", () => ({
  CampaignMailService: class {
    sendIndividual = mocks.sendIndividual;
    sendTest = mocks.sendTest;
  },
  CampaignMailError: class extends Error {
    constructor(message: string, readonly status = 400, readonly code?: string) { super(message); }
  },
}));
vi.mock("../Services/CampaignSendService", () => ({
  CampaignSendService: class {
    start = mocks.start;
    processBatch = mocks.processBatch;
    retryFailed = mocks.retryFailed;
    getProgress = mocks.getProgress;
    recoverStaleCampaign = mocks.recoverStaleCampaign;
  },
}));

import {
  fetchDeliveryHistoryAction,
  getCampaignSendProgressAction,
  processCampaignBatchAction,
  recoverStaleCampaignAction,
  retryCampaignFailedAction,
  sendIndividualEmailAction,
  sendTestEmailAction,
  startCampaignSendAction,
} from "../Actions/send.actions";

describe("send actions — SUPER_ADMIN only", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("envío individual denegado sin SUPER_ADMIN", async () => {
    mocks.requireRole.mockRejectedValue(new Error("No autorizado."));
    const response = await sendIndividualEmailAction(1, 7);
    expect(response.success).toBe(false);
    expect(mocks.sendIndividual).not.toHaveBeenCalled();
  });

  it("test email denegado sin SUPER_ADMIN", async () => {
    mocks.requireRole.mockRejectedValue(new Error("No autorizado."));
    const response = await sendTestEmailAction(1, "prueba@iimp.org.pe", null);
    expect(response.success).toBe(false);
    expect(mocks.sendTest).not.toHaveBeenCalled();
  });

  it("test email requiere rate limit y rate limit rechaza", async () => {
    mocks.requireRole.mockResolvedValue(undefined);
    mocks.getCurrentUser.mockResolvedValue({ id: 1, email: "admin@iimp.org.pe" });
    mocks.consume.mockResolvedValue(false);
    const response = await sendTestEmailAction(1, "prueba@iimp.org.pe", null);
    expect(response).toMatchObject({ success: false, status: 429 });
    expect(mocks.sendTest).not.toHaveBeenCalled();
  });

  it("inicio de envío masivo denegado sin SUPER_ADMIN", async () => {
    mocks.requireRole.mockRejectedValue(new Error("No autorizado."));
    const response = await startCampaignSendAction(1);
    expect(response.success).toBe(false);
    expect(mocks.start).not.toHaveBeenCalled();
  });

  it("procesamiento de lote denegado sin SUPER_ADMIN", async () => {
    mocks.requireRole.mockRejectedValue(new Error("No autorizado."));
    const response = await processCampaignBatchAction(1);
    expect(response.success).toBe(false);
    expect(mocks.processBatch).not.toHaveBeenCalled();
  });

  it("reintento denegado sin SUPER_ADMIN", async () => {
    mocks.requireRole.mockRejectedValue(new Error("No autorizado."));
    const response = await retryCampaignFailedAction(1);
    expect(response.success).toBe(false);
    expect(mocks.retryFailed).not.toHaveBeenCalled();
  });

  it("recuperación de campaña atascada denegada sin SUPER_ADMIN", async () => {
    mocks.requireRole.mockRejectedValue(new Error("No autorizado."));
    const response = await recoverStaleCampaignAction(1);
    expect(response.success).toBe(false);
    expect(mocks.recoverStaleCampaign).not.toHaveBeenCalled();
  });

  it("consulta de progreso denegada sin SUPER_ADMIN", async () => {
    mocks.requireRole.mockRejectedValue(new Error("No autorizado."));
    const response = await getCampaignSendProgressAction(1);
    expect(response.success).toBe(false);
    expect(mocks.getProgress).not.toHaveBeenCalled();
  });

  it("inicio de envío masivo permitido a SUPER_ADMIN", async () => {
    mocks.requireRole.mockResolvedValue(undefined);
    mocks.getCurrentUser.mockResolvedValue({ id: 1, email: "admin@iimp.org.pe" });
    mocks.start.mockResolvedValue({ recipientCount: 100 });
    const response = await startCampaignSendAction(1);
    expect(response).toMatchObject({ success: true, recipientCount: 100 });
    expect(mocks.start).toHaveBeenCalledWith(1, { userId: 1, email: "admin@iimp.org.pe" });
  });

  it("historial de entregas denegado sin SUPER_ADMIN", async () => {
    mocks.requireRole.mockRejectedValue(new Error("No autorizado."));
    await expect(fetchDeliveryHistoryAction(1, 7)).rejects.toThrow("No autorizado.");
  });
});
