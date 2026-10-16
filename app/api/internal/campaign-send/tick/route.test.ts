import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

const mocks = vi.hoisted(() => ({
  processAllSendingCampaigns: vi.fn(),
}));

vi.mock("@/modules/communications/Services/CampaignSendService", () => ({
  CampaignSendService: class {
    processAllSendingCampaigns = mocks.processAllSendingCampaigns;
  },
  CAMPAIGN_SEND_SYSTEM_ACTOR: { userId: null, email: "system-worker@iimp.org.pe" },
}));

import { POST } from "./route";

describe("campaign-send tick route", () => {
  beforeEach(() => {
    vi.stubEnv("CAMPAIGN_SEND_TICK_SECRET", "test-secret");
    mocks.processAllSendingCampaigns.mockReset().mockResolvedValue({ campaignsProcessed: 1, campaignsPaused: 0 });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("rechaza sin secreto (401)", async () => {
    const response = await POST(new Request("http://localhost/api/internal/campaign-send/tick", { method: "POST" }));
    expect(response.status).toBe(401);
    expect(mocks.processAllSendingCampaigns).not.toHaveBeenCalled();
  });

  it("rechaza con secreto incorrecto (401)", async () => {
    const response = await POST(new Request("http://localhost/api/internal/campaign-send/tick", { method: "POST", headers: { "x-campaign-send-tick-secret": "wrong" } }));
    expect(response.status).toBe(401);
  });

  it("ejecuta el tick con el secreto correcto (200)", async () => {
    const response = await POST(new Request("http://localhost/api/internal/campaign-send/tick", { method: "POST", headers: { "x-campaign-send-tick-secret": "test-secret" } }));
    expect(response.status).toBe(200);
    expect(mocks.processAllSendingCampaigns).toHaveBeenCalledOnce();
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.campaignsProcessed).toBe(1);
  });
});
