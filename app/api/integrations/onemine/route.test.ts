import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAffiliate: vi.fn(),
}));

vi.mock("@/modules/auth/context/service", () => ({
  contextService: { requireAffiliate: mocks.requireAffiliate },
}));

import { GET } from "./route";

describe("GET /api/integrations/onemine", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("ONEMINE_SSO_SECRET", "test-secret");
  });

  it("rejects a request without a valid session", async () => {
    mocks.requireAffiliate.mockRejectedValue(new Error("session expired"));

    await expect(GET()).rejects.toThrow("session expired");
  });

  it("rejects an authenticated user without associate access", async () => {
    mocks.requireAffiliate.mockRejectedValue(new Error("not an affiliate"));

    await expect(GET()).rejects.toThrow("not an affiliate");
  });

  it("redirects an authorized associate with an encoded, non-PII SSO URL", async () => {
    mocks.requireAffiliate.mockResolvedValue({ id: 42 });

    const response = await GET();
    const location = response.headers.get("location") ?? "";
    const url = new URL(location);

    expect(response.status).toBe(307);
    expect(url.origin).toBe("https://www.onemine.org");
    expect(url.pathname).toBe("/sso/instituto-de-ingenieros-de-minas-del-per-");
    expect(url.searchParams.get("ts")).toMatch(/^\d{14}$/);
    expect(url.searchParams.get("secureCode")).toMatch(/^[A-Za-z0-9+/]{22}==$/);
    expect(location).toContain("secureCode=");
    expect(location).not.toContain("test-secret");
    expect(location).not.toContain("42");
  });

  it("returns a controlled response when the server secret is absent", async () => {
    mocks.requireAffiliate.mockResolvedValue({ id: 42 });
    vi.stubEnv("ONEMINE_SSO_SECRET", "");

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body).toEqual({
      success: false,
      message: "El acceso a OneMine no está configurado. Contacta al administrador.",
    });
    expect(JSON.stringify(body)).not.toContain("ONEMINE_SSO_SECRET");
  });
});
