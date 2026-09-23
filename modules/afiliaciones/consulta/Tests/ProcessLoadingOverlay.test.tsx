import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ client: false, portal: vi.fn(() => null) }));
vi.mock("react", async (importOriginal) => ({
  ...await importOriginal<typeof import("react")>(),
  useSyncExternalStore: (_subscribe: unknown, client: () => boolean, server: () => boolean) => state.client ? client() : server(),
}));
vi.mock("react-dom", async (importOriginal) => ({
  ...await importOriginal<typeof import("react-dom")>(),
  createPortal: state.portal,
}));

import { ProcessLoadingOverlay } from "@/modules/shared/Components/ProcessLoadingOverlay";
import { ConsultationForm } from "../Components/ConsultationForm";

beforeEach(() => { state.client = false; state.portal.mockClear(); });
afterEach(() => { vi.unstubAllGlobals(); });

describe("global verification loading overlay", () => {
  it("does not access document during SSR or the initial hydration render", () => {
    expect(renderToStaticMarkup(<ProcessLoadingOverlay open title="Enviando código..." description="Espera un momento." />)).toBe("");
    expect(state.portal).not.toHaveBeenCalled();
  });

  it("does not mount a portal when closed", () => {
    state.client = true;
    expect(renderToStaticMarkup(<ProcessLoadingOverlay open={false} title="Enviando código..." description="Espera un momento." />)).toBe("");
    expect(state.portal).not.toHaveBeenCalled();
  });

  it("renders outside the step into document.body at viewport size and above layout controls", () => {
    state.client = true;
    const body = {};
    vi.stubGlobal("document", { body });
    const localMarkup = renderToStaticMarkup(<div style={{ transform: "translateY(0)", position: "relative" }}>
      <ProcessLoadingOverlay open title="Enviando código..." description="Espera un momento." />
      <footer>Guardar y continuar</footer>
    </div>);
    expect(localMarkup).not.toContain("Enviando código");
    expect(state.portal).toHaveBeenCalledWith(expect.anything(), body);
    const overlay = state.portal.mock.calls[0] as unknown as [ReactNode, unknown];
    const portalMarkup = renderToStaticMarkup(overlay[0]);
    expect(portalMarkup).toContain("fixed inset-0 z-[9999]");
    expect(portalMarkup).toContain("Enviando código...");
    expect(portalMarkup).toContain('aria-busy="true"');
  });
});

it("ConsultationForm initially shows only document identity", () => {
  const markup = renderToStaticMarkup(<ConsultationForm onSubmit={vi.fn()} />);
  expect(markup).toContain("Tipo de Documento");
  expect(markup).toContain("Número de Documento");
  expect(markup).toContain("Consultar Estado");
  expect(markup).not.toContain("Correo registrado");
  expect(markup).not.toContain("Verifica tu identidad");
  expect(markup).not.toContain("seguimiento");
  expect(markup).not.toContain("query-tracking-code");
});
