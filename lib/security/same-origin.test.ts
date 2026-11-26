import { describe, expect, it } from "vitest";
import { isSameOriginRequest } from "./same-origin";

function request(origin?: string): Request {
  return new Request("https://portal.example/api/test", {
    method: "POST",
    headers: origin ? { origin } : undefined,
  });
}

describe("isSameOriginRequest", () => {
  it("acepta el mismo origen", () => {
    expect(isSameOriginRequest(request("https://portal.example"), "https://portal.example")).toBe(true);
  });

  it("rechaza orígenes distintos", () => {
    expect(isSameOriginRequest(request("https://evil.example"), "https://portal.example")).toBe(false);
  });

  it("rechaza la ausencia de Origin", () => {
    expect(isSameOriginRequest(request(), "https://portal.example")).toBe(false);
  });

  it("rechaza valores inválidos", () => {
    expect(isSameOriginRequest(request("no-es-url"), "https://portal.example")).toBe(false);
  });
});
