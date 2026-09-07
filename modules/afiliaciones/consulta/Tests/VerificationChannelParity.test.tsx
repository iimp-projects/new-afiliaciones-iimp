import { renderToStaticMarkup } from "react-dom/server";
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
import { VerificationChannelModal } from "@/modules/shared/Components/VerificationModals";
import type { DestinationChannel } from "@/modules/shared/Models/Verification";

vi.mock("react", async (original) => ({ ...await original<typeof import("react")>(), useSyncExternalStore: () => true }));
vi.mock("react-dom", async (original) => ({ ...await original<typeof import("react-dom")>(), createPortal: (children: import("react").ReactNode) => children }));
vi.stubGlobal("document", { body: {} });

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("AUTH_SECRET", "test-only-channel-parity-secret");
  db.person.findUnique.mockResolvedValue(null);
});

describe("Postulación and Consultar channel parity", () => {
  it.each([
    { name: "phone and email", phone: "999111812", email: "maria@example.com", expected: ["WHATSAPP", "SMS", "EMAIL"] },
    { name: "phone without email", phone: "999111812", email: "", expected: ["WHATSAPP", "SMS"] },
    { name: "email without phone", phone: "", email: "maria@example.com", expected: ["EMAIL"] },
    { name: "no contacts", phone: "", email: "", expected: [] },
  ])("returns and renders identical server-resolved channels: $name", async ({ phone, email, expected }) => {
    const application = { id: 7, status: "DRAFT", trackingCode: "APP-7", phone, email };
    db.membershipApplication.findFirst.mockResolvedValue(application);
    db.membershipApplication.findMany.mockResolvedValue([application]);

    // The request only supplies identity. No phone from a partially filled form
    // and no Person relation are needed for draft recovery.
    const recovery = await new ValidateDocumentService().execute(DocumentType.DNI, "12345678");
    const query = await new QueryVerificationService().lookup({ documentType: "DNI", documentNumber: "12345678" });

    expect(recovery.hasApplication).toBe(true);
    expect(recovery).not.toHaveProperty("status");
    expect(recovery).not.toHaveProperty("trackingCode");
    expect(recovery.channels.map((option) => option.channel)).toEqual(expected);
    expect(recovery.channels).toEqual(query.channels);
    if (phone) expect(recovery.channels[0].destination).toBe("*** *** 812");
    if (email) expect(recovery.channels.find((option) => option.channel === "EMAIL")?.destination).toBe("m***@example.com");

    const render = (channels: DestinationChannel[]) => renderToStaticMarkup(<VerificationChannelModal
      channels={channels} channel={channels[0]?.channel || "EMAIL"}
      onChannel={vi.fn()} onSend={vi.fn()} onClose={vi.fn()} loading={false}
    />);
    const markup = render(recovery.channels);
    expect(markup).toBe(render(query.channels));
    expect(markup).not.toContain("999111812");
    expect(markup).not.toContain("maria@example.com");
    if (!expected.length) {
      expect(markup).toContain("No hay medios de contacto registrados");
      expect(markup).toMatch(/<button[^>]*disabled=""[^>]*>Enviar/);
    }
  });
});
