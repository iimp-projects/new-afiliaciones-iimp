import { afterEach, describe, expect, it, vi } from "vitest";
import { WhatsAppService } from "./WhatsAppService";

const configured = () => { vi.stubEnv("WHATSAPP_PHONE_NUMBER_ID", "phone-id"); vi.stubEnv("WHATSAPP_ACCESS_TOKEN", "secret-token"); vi.stubEnv("WHATSAPP_GRAPH_API_VERSION", "v26.0"); };

describe("WhatsAppService", () => {
  afterEach(() => vi.unstubAllEnvs());
  it.each(["999999999", "51999999999", "+51 999-999-999"])("normalizes %s without duplicating Peru's prefix", async (phone) => {
    configured();
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ messages: [{ id: "wamid.1" }] }), { status: 200 }));
    await expect(new WhatsAppService().sendOtp({ phone, code: "123456" })).resolves.toEqual({ accepted: true, messageId: "wamid.1" });
    const payload = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(payload).toMatchObject({ to: "51999999999", template: { name: "iimp_codigo_token", language: { code: "es_PE" } } });
    expect(payload.template.components[0].parameters[0].text).toBe("123456");
    expect(payload.template.components[1].parameters[0].text).toBe("123456");
    fetchMock.mockRestore();
  });
  it.each([[401, "AUTH_ERROR"], [403, "AUTH_ERROR"], [429, "RATE_LIMIT"], [500, "PROVIDER_ERROR"]])("maps Meta HTTP %s to %s", async (status, code) => {
    configured(); const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}", { status }));
    await expect(new WhatsAppService().sendOtp({ phone: "999999999", code: "123456" })).rejects.toMatchObject({ code });
    fetchMock.mockRestore();
  });
  it("keeps only Meta diagnostic fields and logs no token, OTP, or full recipient", async () => {
    configured();
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ error: { code: 132001, error_subcode: 2494073, type: "OAuthException", fbtrace_id: "trace-safe" } }), { status: 400 }));
    try {
      await new WhatsAppService().sendOtp({ phone: "999999999", code: "123456" });
    } catch (serviceError) {
      expect(serviceError).toMatchObject({ code: "TEMPLATE_ERROR", diagnostic: { status: 400, metaCode: 132001, metaSubcode: 2494073, metaType: "OAuthException", fbtraceId: "trace-safe" } });
      expect(JSON.stringify(serviceError)).not.toContain("secret-token");
      expect(JSON.stringify(serviceError)).not.toContain("123456");
      expect(JSON.stringify(serviceError)).not.toContain("51999999999");
    }
    expect(info).toHaveBeenCalledWith(expect.objectContaining({ operation: "WHATSAPP_OTP_SEND", endpointHost: "graph.facebook.com", recipientMask: "***999", template: "iimp_codigo_token", language: "es_PE" }));
    expect(JSON.stringify([...info.mock.calls, ...error.mock.calls])).not.toContain("secret-token");
    expect(JSON.stringify([...info.mock.calls, ...error.mock.calls])).not.toContain("123456");
    expect(JSON.stringify([...info.mock.calls, ...error.mock.calls])).not.toContain("51999999999");
    fetchMock.mockRestore(); info.mockRestore(); error.mockRestore();
  });
  it.each(["WHATSAPP_PHONE_NUMBER_ID", "WHATSAPP_ACCESS_TOKEN"])("reports missing %s without exposing the secret", async (variable) => {
    configured(); vi.stubEnv(variable, "");
    try {
      await new WhatsAppService().sendOtp({ phone: "999999999", code: "123456" });
    } catch (error) {
      expect(error).toMatchObject({ code: "CONFIGURATION_ERROR" });
      expect(String(error)).not.toContain("secret-token");
    }
  });
  it("maps network failures safely", async () => {
    configured(); const fetchMock = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network"));
    await expect(new WhatsAppService().sendOtp({ phone: "999999999", code: "123456" })).rejects.toMatchObject({ code: "NETWORK_ERROR" });
    fetchMock.mockRestore();
  });
});
