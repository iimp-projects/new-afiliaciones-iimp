import { beforeEach, describe, expect, it, vi } from "vitest";

const cookiesDelete = vi.hoisted(() => vi.fn());

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({ delete: cookiesDelete })),
}));

import { GET } from "./route";

const QA_URL = "https://afiliaciones-qa.iimp.org.pe";

describe("GET /api/auth/session-expired redirect", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", QA_URL);
  });

  it("redirige a /login usando la URL pública canónica (nunca 0.0.0.0)", async () => {
    // El origen público no depende del request: debe usar la URL canónica.
    const response = await GET();

    const location = response.headers.get("location") ?? "";
    expect(response.status).toBe(307);
    expect(location).toBe(`${QA_URL}/login`);
    expect(location).not.toContain("0.0.0.0");
  });
});
