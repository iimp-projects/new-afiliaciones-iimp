import { describe, expect, it } from "vitest";
import { escapeHtml, escapeHtmlAttribute, safeUrl } from "./EmailEscaping";

describe("EmailEscaping", () => {
  it("escapes executable markup and event-handler-looking input", () => {
    expect(escapeHtml('<script>alert(1)</script>')).toBe("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(escapeHtml('<IMG SRC=x onerror=alert(1)>')).toBe("&lt;IMG SRC=x onerror=alert(1)&gt;");
  });

  it("preserves text meaning while escaping HTML-significant characters", () => {
    expect(escapeHtml("Carlos & María")).toBe("Carlos &amp; María");
    expect(escapeHtmlAttribute('"quoted value"')).toBe("&quot;quoted value&quot;");
  });

  it("preserves valid absolute URLs as safe attributes", () => {
    expect(safeUrl("https://portal.example/revisar?token=demo-token&source=email")).toBe("https://portal.example/revisar?token=demo-token&amp;source=email");
  });
});
