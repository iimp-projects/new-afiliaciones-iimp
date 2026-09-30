import { describe, expect, it, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  requireRole: vi.fn(),
  getCurrentUser: vi.fn(),
  createCampaign: vi.fn(),
}));

vi.mock("@/modules/auth/context/service", () => ({
  contextService: { requireRole: mocks.requireRole, getCurrentUser: mocks.getCurrentUser },
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("../Services/CampaignService", () => ({
  CampaignService: class {
    createCampaign = mocks.createCampaign;
  },
  CampaignServiceError: class extends Error {
    constructor(message: string, readonly status = 400, readonly fields: string[] = []) { super(message); }
  },
}));

import { createCampaignAction } from "../Actions/campaign.actions";

describe("campaign actions — SUPER_ADMIN only", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("SUPER_ADMIN puede crear campaña", async () => {
    mocks.requireRole.mockResolvedValue(undefined);
    mocks.getCurrentUser.mockResolvedValue({ id: 1, email: "admin@iimp.org.pe" });
    mocks.createCampaign.mockResolvedValue({ id: 7 });

    const response = await createCampaignAction({ name: "Campaña", subject: "Asunto", htmlContent: "<p>Hola</p>" });

    expect(mocks.requireRole).toHaveBeenCalledWith(["SUPER_ADMIN"]);
    expect(response).toEqual({ success: true, id: 7 });
  });

  it("otro rol es denegado", async () => {
    mocks.requireRole.mockRejectedValue(new Error("No autorizado."));

    const response = await createCampaignAction({ name: "Campaña", subject: "Asunto", htmlContent: "<p>Hola</p>" });

    expect(response.success).toBe(false);
    expect(mocks.createCampaign).not.toHaveBeenCalled();
  });
});
