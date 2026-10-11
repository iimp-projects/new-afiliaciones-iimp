import { describe, expect, it } from "vitest";
import { createOneMineSsoUrl } from "./sso";

describe("createOneMineSsoUrl", () => {
  it("reproduces the fixed legacy OneMine SSO vector using a UTC timestamp", () => {
    const secret = "test-secret";
    const url = createOneMineSsoUrl(secret, new Date("2026-10-07T16:20:35.987Z"));
    const timestamp = "20261007162035";
    // Fixed independently generated vector for
    // MD5("instituto-de-ingenieros-de-minas-del-per-20261007162035test-secret")
    // encoded as Base64 from the raw 16-byte digest.
    const expectedCode = "rjIDINvMSn3+RWAbGXlddQ==";

    expect(url.origin).toBe("https://www.onemine.org");
    expect(url.pathname).toBe("/sso/instituto-de-ingenieros-de-minas-del-per-");
    expect(url.searchParams.get("ts")).toBe(timestamp);
    expect(url.searchParams.get("secureCode")).toBe(expectedCode);
    expect(url.toString()).toContain("secureCode=rjIDINvMSn3%2BRWAbGXlddQ%3D%3D");
    expect(url.toString()).not.toContain(secret);
  });

  it("rejects an empty SSO secret", () => {
    expect(() => createOneMineSsoUrl("  ")).toThrow("La clave SSO de OneMine no está configurada.");
  });

  it("builds a well-formed URL even when the timestamp contains '42'", () => {
    const secret = "test-secret";
    const url = createOneMineSsoUrl(secret, new Date("2026-10-11T05:28:42.000Z"));

    expect(url.searchParams.get("ts")).toBe("20261011052842");
    expect(url.searchParams.get("ts")).toContain("42");
    expect(url.searchParams.get("secureCode")).toMatch(/^[A-Za-z0-9+/]{22}==$/);
    expect([...url.searchParams.keys()].sort()).toEqual(["secureCode", "ts"]);
    expect(url.searchParams.get("id")).toBeNull();
    expect(url.toString()).not.toContain(secret);
  });
});
