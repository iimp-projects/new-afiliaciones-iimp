import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ queryRaw: vi.fn() }));

vi.mock("@/lib/prisma", () => ({ prisma: { $queryRaw: mocks.queryRaw } }));

import { GET } from "./route";

describe("health ready route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 200 and status ready when the database responds", async () => {
    mocks.queryRaw.mockResolvedValue([{ "?column?": 1 }]);

    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: "ready" });
    expect(mocks.queryRaw).toHaveBeenCalledTimes(1);
  });

  it("returns 503 and status not_ready when Prisma fails", async () => {
    mocks.queryRaw.mockRejectedValue(new Error("connection refused"));

    const response = await GET();

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ status: "not_ready" });
  });

  it("does not leak the internal exception message", async () => {
    mocks.queryRaw.mockRejectedValue(
      new Error("password authentication failed for user postgres"),
    );

    const response = await GET();
    const body = await response.text();

    expect(response.status).toBe(503);
    expect(body).not.toContain("password");
    expect(body).not.toContain("postgres");
    expect(body).not.toContain("authentication");
  });

  it("sets Cache-Control: no-store on success and failure", async () => {
    mocks.queryRaw.mockResolvedValue([]);
    const ok = await GET();
    expect(ok.headers.get("Cache-Control")).toBe("no-store");

    mocks.queryRaw.mockRejectedValue(new Error("boom"));
    const failure = await GET();
    expect(failure.headers.get("Cache-Control")).toBe("no-store");
  });
});
