import { beforeEach, describe, expect, it, vi } from "vitest";
import { DocumentType } from "@prisma/client";

const db = vi.hoisted(() => ({
  person: { findUnique: vi.fn() },
  membershipApplication: { findFirst: vi.fn(), findMany: vi.fn() },
}));
vi.mock("@/lib/prisma", () => ({ prisma: db }));
vi.mock("@/modules/shared/Services/ApisNetPeService", () => ({ ApisNetPeService: class {} }));

import { ValidateDocumentService } from "../../postulacion/Services/ValidateDocumentService";
import { QueryVerificationService } from "../Services/QueryVerificationService";

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("AUTH_SECRET", "test-only-channel-boundary-secret");
  vi.stubEnv("WHATSAPP_PHONE_NUMBER_ID", "phone-id");
  vi.stubEnv("WHATSAPP_ACCESS_TOKEN", "token");
  vi.stubEnv("SMTP_HOST", "smtp.example.com");
  vi.stubEnv("SMTP_USER", "user");
  vi.stubEnv("SMTP_PASS", "pass");
  vi.stubEnv("SMTP_PORT", "587");
  vi.stubEnv("OTP_WHATSAPP_ENABLED", "true");
  vi.stubEnv("OTP_SMS_ENABLED", "true");
  vi.stubEnv("OTP_EMAIL_ENABLED", "true");
  db.person.findUnique.mockResolvedValue(null);
});

describe("public consultation channel disclosure boundary", () => {
  it("returns identical, destination-less channels for existing and nonexistent documents", async () => {
    db.membershipApplication.findMany.mockResolvedValue([{ id: 7, status: "DRAFT", trackingCode: "APP-7", phone: "999111812", email: "maria@example.com" }]);
    const existing = await new QueryVerificationService().lookup({ documentType: "DNI", documentNumber: "12345678" });
    const nonexistent = await new QueryVerificationService().lookup({ documentType: "DNI", documentNumber: "00000000" });

    expect(existing.channels).toEqual(nonexistent.channels);
    expect(existing.channels).toEqual([{ channel: "WHATSAPP" }, { channel: "SMS" }, { channel: "EMAIL" }]);
    expect(existing.channels.every((option) => option.destination === undefined)).toBe(true);
    expect(JSON.stringify(existing)).not.toContain("999111812");
    expect(JSON.stringify(existing)).not.toContain("maria@example.com");
  });

  it("reflects global provider availability only", async () => {
    vi.stubEnv("OTP_EMAIL_ENABLED", "false");
    vi.stubEnv("OTP_WHATSAPP_ENABLED", "false");
    const result = await new QueryVerificationService().lookup({ documentType: "DNI", documentNumber: "12345678" });
    expect(result.channels).toEqual([{ channel: "SMS" }]);
  });

  it("keeps the postulation lookup with masked destinations and never exposes them publicly", async () => {
    const application = { id: 7, status: "DRAFT", trackingCode: "APP-7", phone: "999111812", email: "maria@example.com" };
    db.membershipApplication.findMany.mockResolvedValue([application]);
    const recovery = await new ValidateDocumentService().execute(DocumentType.DNI, "12345678");
    const query = await new QueryVerificationService().lookup({ documentType: "DNI", documentNumber: "12345678" });

    expect(recovery.channels[0]?.destination).toBe("*** *** 812");
    expect(query.channels).not.toEqual(recovery.channels);
    expect(query.channels.every((option) => option.destination === undefined)).toBe(true);
  });
});
