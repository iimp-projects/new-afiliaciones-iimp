import { afterEach, describe, expect, it, vi } from "vitest";
import { CampaignMailService } from "../Services/CampaignMailService";

/**
 * Pruebas focalizadas de la cuenta SMTP activa para campañas de asociados.
 *
 * La implementación canónica (base de integración e856422, igual que PROD y QA)
 * usa la cuenta SMTP DEFAULT (`new MailService()`), NO la cuenta PROV. Estas
 * pruebas protegen contra la regresión observada en master/HEAD, donde
 * CampaignMailService pasó a usar `new MailService("PROV")` (cuenta que no está
 * configurada en producción).
 */
describe("CampaignMailService — cuenta SMTP activa de campañas", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("usa SMTP DEFAULT: valida correctamente con variables SMTP_* (sin PROV_MAIL_*)", () => {
    vi.stubEnv("SMTP_HOST", "smtp.gmail.com");
    vi.stubEnv("SMTP_PORT", "465");
    vi.stubEnv("SMTP_USER", "asociados@iimp.org.pe");
    vi.stubEnv("SMTP_PASS", "test-pass");
    vi.stubEnv("PROV_MAIL_HOST", "");
    vi.stubEnv("PROV_MAIL_PORT", "");
    vi.stubEnv("PROV_MAIL_USERNAME", "");
    vi.stubEnv("PROV_MAIL_PASSWORD", "");

    const service = new CampaignMailService();
    expect(() => service.validateSendConfiguration()).not.toThrow();
  });

  it("aisla SMTP PROV: falla si solo existen variables PROV_MAIL_* (sin SMTP_*)", () => {
    vi.stubEnv("SMTP_HOST", "");
    vi.stubEnv("SMTP_PORT", "");
    vi.stubEnv("SMTP_USER", "");
    vi.stubEnv("SMTP_PASS", "");
    vi.stubEnv("PROV_MAIL_HOST", "smtp.prov.example");
    vi.stubEnv("PROV_MAIL_PORT", "465");
    vi.stubEnv("PROV_MAIL_USERNAME", "prov@example.com");
    vi.stubEnv("PROV_MAIL_PASSWORD", "prov-pass");

    const service = new CampaignMailService();
    expect(() => service.validateSendConfiguration()).toThrow();
  });
});
