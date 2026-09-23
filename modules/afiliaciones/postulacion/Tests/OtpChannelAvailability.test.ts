import { describe, expect, it } from "vitest";
import { destinationChannels } from "@/modules/shared/Models/Verification";
import { resolveOtpChannelAvailability } from "../Services/OtpChannelAvailability";

const whatsapp = { WHATSAPP_PHONE_NUMBER_ID: "phone-id", WHATSAPP_ACCESS_TOKEN: "token" };
const smtp = { SMTP_HOST: "smtp.example.com", SMTP_USER: "user", SMTP_PASS: "pass", SMTP_PORT: "587" };

describe("resolveOtpChannelAvailability", () => {
  it("enables WhatsApp only when both required values are present", () => {
    expect(resolveOtpChannelAvailability(whatsapp).WHATSAPP).toBe(true);
    expect(resolveOtpChannelAvailability({ WHATSAPP_PHONE_NUMBER_ID: "phone-id" }).WHATSAPP).toBe(false);
    expect(resolveOtpChannelAvailability({ WHATSAPP_ACCESS_TOKEN: "token" }).WHATSAPP).toBe(false);
    expect(resolveOtpChannelAvailability({}).WHATSAPP).toBe(false);
  });

  it("enables Email only with a complete SMTP configuration", () => {
    expect(resolveOtpChannelAvailability(smtp).EMAIL).toBe(true);
    expect(resolveOtpChannelAvailability({ ...smtp, SMTP_PASS: "" }).EMAIL).toBe(false);
    expect(resolveOtpChannelAvailability({ SMTP_USER: "user", SMTP_PASS: "pass", SMTP_PORT: "587" }).EMAIL).toBe(false);
  });

  it("honors explicit feature flags even when the provider is configured", () => {
    expect(resolveOtpChannelAvailability({ ...whatsapp, OTP_WHATSAPP_ENABLED: "false" }).WHATSAPP).toBe(false);
    expect(resolveOtpChannelAvailability({ ...smtp, OTP_EMAIL_ENABLED: "false" }).EMAIL).toBe(false);
    expect(resolveOtpChannelAvailability({ OTP_SMS_ENABLED: "false" }).SMS).toBe(false);
    expect(resolveOtpChannelAvailability({ OTP_SMS_ENABLED: "true" }).SMS).toBe(true);
  });

  it("keeps SMS enabled by default (AWS credential chain, no local config to probe)", () => {
    expect(resolveOtpChannelAvailability({}).SMS).toBe(true);
  });
});

describe("destinationChannels availability", () => {
  const all = { EMAIL: true, SMS: true, WHATSAPP: true };

  it("omits a channel whose provider is disabled while keeping the destination", () => {
    expect(destinationChannels("ana@example.com", "999111812", { ...all, SMS: false }).map((item) => item.channel)).toEqual(["WHATSAPP", "EMAIL"]);
    expect(destinationChannels("ana@example.com", "999111812", { ...all, WHATSAPP: false }).map((item) => item.channel)).toEqual(["SMS", "EMAIL"]);
    expect(destinationChannels("ana@example.com", "999111812", { ...all, EMAIL: false }).map((item) => item.channel)).toEqual(["WHATSAPP", "SMS"]);
  });

  it("returns nothing when every provider is disabled", () => {
    expect(destinationChannels("ana@example.com", "999111812", { EMAIL: false, SMS: false, WHATSAPP: false })).toEqual([]);
  });

  it("still requires a destination to offer its channel", () => {
    expect(destinationChannels("", "999111812", all).map((item) => item.channel)).toEqual(["WHATSAPP", "SMS"]);
    expect(destinationChannels("ana@example.com", "", all).map((item) => item.channel)).toEqual(["EMAIL"]);
  });
});
