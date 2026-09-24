import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("next-auth/react", () => ({
  signIn: vi.fn(),
}));

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: import("react").ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock("@/modules/auth/login/action", () => ({
  checkLockStatus: vi.fn(async () => ({ locked: false })),
}));

import { LoginView } from "./LoginView";

describe("LoginView", () => {
  it("conserva el ingreso por correo/contraseña y la recuperación", () => {
    const html = renderToStaticMarkup(<LoginView />);

    expect(html).toContain("Correo Electrónico");
    expect(html).toContain("Contraseña");
    expect(html).toContain("Recordarme");
    expect(html).toContain("¿Olvidaste tu contraseña?");
  });

  it("no muestra opciones de login social", () => {
    const html = renderToStaticMarkup(<LoginView />);

    expect(html).not.toContain("Google");
    expect(html).not.toContain("LinkedIn");
    expect(html).not.toContain("continuar con");
  });
});
