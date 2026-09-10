export type WhatsAppErrorCode = "CONFIGURATION_ERROR" | "INVALID_PHONE" | "AUTH_ERROR" | "TEMPLATE_ERROR" | "RATE_LIMIT" | "PROVIDER_ERROR" | "NETWORK_ERROR";

export type WhatsAppDiagnostic = {
  status?: number;
  metaCode?: number;
  metaSubcode?: number;
  metaType?: string;
  fbtraceId?: string;
  message: string;
};

export class WhatsAppServiceError extends Error {
  constructor(public readonly code: WhatsAppErrorCode, public readonly diagnostic: WhatsAppDiagnostic) { super(diagnostic.message); this.name = "WhatsAppServiceError"; }
}

type WhatsAppApiResponse = { messages?: Array<{ id?: string }> };
type WhatsAppMetaErrorResponse = { error?: { code?: number; error_subcode?: number; type?: string; fbtrace_id?: string } };
const DEFAULT_GRAPH_API_VERSION = "v26.0";
const REQUEST_TIMEOUT_MS = 10_000;

export class WhatsAppService {
  public async sendOtp({ phone, code }: { phone: string; code: string }): Promise<{ accepted: true; messageId?: string }> {
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      const { phoneNumberId, accessToken, graphApiVersion } = this.getConfiguration();
      const to = this.normalizePhone(phone);
      this.logAttempt({ graphVersion: graphApiVersion, phoneNumberIdConfigured: Boolean(phoneNumberId), recipientMask: this.maskRecipient(to) });
      const controller = new AbortController();
      timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
      const response = await fetch(`https://graph.facebook.com/${graphApiVersion}/${phoneNumberId}/messages`, {
        method: "POST", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ messaging_product: "whatsapp", recipient_type: "individual", to, type: "template", template: {
          name: "iimp_codigo_token", language: { code: "es_PE" }, components: [
            { type: "body", parameters: [{ type: "text", text: code }] },
            { type: "button", sub_type: "url", index: "0", parameters: [{ type: "text", text: code }] },
          ],
        } }), signal: controller.signal,
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({})) as WhatsAppMetaErrorResponse;
        const metaError = body.error;
        throw new WhatsAppServiceError(this.errorCodeFor(response.status), {
          status: response.status,
          metaCode: metaError?.code,
          metaSubcode: metaError?.error_subcode,
          metaType: metaError?.type,
          fbtraceId: metaError?.fbtrace_id,
          message: "Meta rejected the WhatsApp OTP request.",
        });
      }
      const result = await response.json().catch(() => ({})) as WhatsAppApiResponse;
      const messageId = result.messages?.[0]?.id;
      return messageId ? { accepted: true, messageId } : { accepted: true };
    } catch (error) {
      const serviceError = error instanceof WhatsAppServiceError
        ? error
        : new WhatsAppServiceError("NETWORK_ERROR", { message: "WhatsApp OTP request could not reach Meta." });
      this.logFailure(serviceError);
      throw serviceError;
    } finally { if (timeout) clearTimeout(timeout); }
  }

  private getConfiguration() {
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim();
    const accessToken = process.env.WHATSAPP_ACCESS_TOKEN?.trim();
    const graphApiVersion = process.env.WHATSAPP_GRAPH_API_VERSION?.trim() || DEFAULT_GRAPH_API_VERSION;
    void process.env.WHATSAPP_WABA_ID;
    if (!phoneNumberId || !accessToken || !/^v\d+\.\d+$/.test(graphApiVersion)) {
      throw new WhatsAppServiceError("CONFIGURATION_ERROR", { message: "WhatsApp server configuration is incomplete or invalid." });
    }
    return { phoneNumberId, accessToken, graphApiVersion };
  }

  private normalizePhone(phone: string): string {
    let normalized = phone.replace(/\D/g, "");
    if (normalized.startsWith("00")) normalized = normalized.slice(2);
    // The application stores no country metadata. Preserve international numbers and prefix only its nine-digit Peruvian local format.
    if (normalized.length === 9) normalized = `51${normalized}`;
    if (!/^\d{8,15}$/.test(normalized)) throw new WhatsAppServiceError("INVALID_PHONE", { message: "WhatsApp recipient phone format is invalid." });
    return normalized;
  }

  private errorCodeFor(status: number): WhatsAppErrorCode {
    if (status === 401 || status === 403) return "AUTH_ERROR";
    if (status === 429) return "RATE_LIMIT";
    if (status === 400 || status === 404 || status === 422) return "TEMPLATE_ERROR";
    return "PROVIDER_ERROR";
  }

  private maskRecipient(phone: string): string { return `***${phone.slice(-3)}`; }

  private logAttempt(details: { graphVersion: string; phoneNumberIdConfigured: boolean; recipientMask: string }) {
    console.info({ operation: "WHATSAPP_OTP_SEND", endpointHost: "graph.facebook.com", ...details, template: "iimp_codigo_token", language: "es_PE" });
  }

  private logFailure(error: WhatsAppServiceError) {
    console.error({ operation: "WHATSAPP_OTP_SEND", internalType: error.code, ...error.diagnostic });
  }
}
