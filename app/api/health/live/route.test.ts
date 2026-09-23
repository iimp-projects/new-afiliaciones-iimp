import { describe, expect, it } from "vitest";

import { GET } from "./route";

describe("health live route", () => {
  it("returns 200 with status ok without touching any dependency", async () => {
    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: "ok" });
  });

  it("sets Cache-Control: no-store", async () => {
    const response = await GET();

    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });
});
