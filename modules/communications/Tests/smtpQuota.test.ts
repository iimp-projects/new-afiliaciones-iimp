import { afterEach, describe, expect, it, vi } from "vitest";
import { getSmtpDailyCampaignLimit } from "../Config/smtpQuota";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("getSmtpDailyCampaignLimit", () => {
  it("DEFAULT usa SMTP_DEFAULT_DAILY_LIMIT - SMTP_DEFAULT_TRANSACTIONAL_RESERVE", () => {
    vi.stubEnv("SMTP_DEFAULT_DAILY_LIMIT", "2000");
    vi.stubEnv("SMTP_DEFAULT_TRANSACTIONAL_RESERVE", "500");
    expect(getSmtpDailyCampaignLimit("DEFAULT")).toBe(1500);
  });

  it("DEFAULT sin variables usa valores por defecto conservadores", () => {
    vi.stubEnv("SMTP_DEFAULT_DAILY_LIMIT", "");
    vi.stubEnv("SMTP_DEFAULT_TRANSACTIONAL_RESERVE", "");
    expect(getSmtpDailyCampaignLimit("DEFAULT")).toBe(1500);
  });

  it("PROV sin SMTP_PROV_DAILY_LIMIT no tiene límite (null)", () => {
    vi.stubEnv("SMTP_PROV_DAILY_LIMIT", "");
    expect(getSmtpDailyCampaignLimit("PROV")).toBeNull();
  });

  it("PROV con límite lo respeta", () => {
    vi.stubEnv("SMTP_PROV_DAILY_LIMIT", "10000");
    expect(getSmtpDailyCampaignLimit("PROV")).toBe(10000);
  });

  it("no devuelve límites negativos", () => {
    vi.stubEnv("SMTP_DEFAULT_DAILY_LIMIT", "100");
    vi.stubEnv("SMTP_DEFAULT_TRANSACTIONAL_RESERVE", "500");
    expect(getSmtpDailyCampaignLimit("DEFAULT")).toBe(0);
  });
});
