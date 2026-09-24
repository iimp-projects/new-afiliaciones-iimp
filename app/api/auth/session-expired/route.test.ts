import { beforeEach, describe, expect, it, vi } from "vitest";

const cookiesSet = vi.hoisted(() => vi.fn());

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({ set: cookiesSet })),
}));

import { GET } from "./route";

const QA_URL = "https://afiliaciones-qa.iimp.org.pe";

const SECURE_SESSION_COOKIE = "__Secure-authjs.session-token";
const LEGACY_SECURE_SESSION_COOKIE = "__Secure-next-auth.session-token";

describe("GET /api/auth/session-expired", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", QA_URL);
  });

  it("redirige a /login usando la URL pública canónica (nunca 0.0.0.0)", async () => {
    const response = await GET();

    const location = response.headers.get("location") ?? "";
    expect(response.status).toBe(307);
    expect(location).toBe(`${QA_URL}/login`);
    expect(location).not.toContain("0.0.0.0");
  });

  it("elimina las 4 variantes de cookie de sesión soportadas", async () => {
    await GET();

    const names = cookiesSet.mock.calls.map((call) => call[0]);
    expect(names).toEqual([
      "authjs.session-token",
      "__Secure-authjs.session-token",
      "next-auth.session-token",
      "__Secure-next-auth.session-token",
    ]);
  });

  it("elimina la cookie __Secure- con valor vacío y expiración inmediata", async () => {
    await GET();

    const call = cookiesSet.mock.calls.find(([name]) => name === SECURE_SESSION_COOKIE);
    expect(call).toBeDefined();

    const [, value, options] = call as [string, string, Record<string, unknown>];
    expect(value).toBe("");
    expect(options).toMatchObject({
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: true,
      maxAge: 0,
    });
  });

  it("replica Secure para la variante legacy __Secure-next-auth.session-token", async () => {
    await GET();

    const call = cookiesSet.mock.calls.find(
      ([name]) => name === LEGACY_SECURE_SESSION_COOKIE,
    );
    expect(call).toBeDefined();

    const [, , options] = call as [string, string, Record<string, unknown>];
    expect(options).toMatchObject({
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: true,
      maxAge: 0,
    });
  });

  it("no agrega Secure a las variantes sin prefijo (no seguras)", async () => {
    await GET();

    const call = cookiesSet.mock.calls.find(
      ([name]) => name === "authjs.session-token",
    );
    expect(call).toBeDefined();

    const [, , options] = call as [string, string, Record<string, unknown>];
    expect(options.secure).toBe(false);
    expect(options).toMatchObject({ path: "/", httpOnly: true, sameSite: "lax", maxAge: 0 });
  });

  it("no hardcodea el dominio QA en las cookies eliminadas", async () => {
    await GET();

    for (const call of cookiesSet.mock.calls) {
      const [, , options] = call as [string, string, Record<string, unknown>];
      expect(options.domain).toBeUndefined();
    }
  });
});
