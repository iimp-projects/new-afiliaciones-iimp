import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { OtpVerificationModal, VerificationChannelModal } from "@/modules/shared/Components/VerificationModals";
import { destinationChannels } from "@/modules/shared/Models/Verification";

// Inspect portal contents in SSR unit tests; real layering is tested in Chromium.
vi.mock("react", async (original) => ({ ...await original<typeof import("react")>(), useSyncExternalStore: () => true }));
vi.mock("react-dom", async (original) => ({ ...await original<typeof import("react-dom")>(), createPortal: (children: import("react").ReactNode) => children }));
vi.stubGlobal("document", { body: {} });

describe("shared verification dialogs", () => {
  it("hides unavailable channels and exposes only masked destinations", () => {
    const html = renderToStaticMarkup(<VerificationChannelModal channels={destinationChannels("maria@example.com", "")} channel="EMAIL" onChannel={vi.fn()} onSend={vi.fn()} onClose={vi.fn()} loading={false} />);
    expect(html).toContain("m***@example.com");
    expect(html).not.toContain("maria@example.com");
    expect(html).not.toContain("WhatsApp");
    expect(html).not.toContain("SMS");
  });
  it("disables sending with no destination and shows a controlled state", () => {
    const html = renderToStaticMarkup(<VerificationChannelModal channels={[]} channel="EMAIL" onChannel={vi.fn()} onSend={vi.fn()} onClose={vi.fn()} loading={false} />);
    expect(html).toContain("No hay medios de contacto registrados");
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Enviar/);
  });
  it("shows the resend countdown and prevents submitting an incomplete OTP", () => {
    const html = renderToStaticMarkup(<OtpVerificationModal code="123" onCode={vi.fn()} onVerify={vi.fn()} onResend={vi.fn()} onChangeChannel={vi.fn()} onClose={vi.fn()} loading={false} sentAt={Date.now()} destination="*** *** 812" />);
    expect(html).toContain("Reenviar en 60s");
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Validar/);
    expect(html).toContain('autoComplete="one-time-code"');
  });
});
