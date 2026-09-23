import { describe, expect, it } from "vitest";
import { noConfirmationRedirect } from "./route";

describe("Niubiz callback fallback redirect", () => {
  it("does not reflect an untrusted callback reference", () => {
    const response = noConfirmationRedirect(new Request("http://localhost:3000/api/payments/niubiz/callback?payment_callback=signed-reference"));

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toContain("/consulta/pago/no-confirmado");
    expect(response.headers.get("location")).not.toContain("signed-reference");
  });

  it("renders the generic no-confirmed route when no callback reference exists", () => {
    const response = noConfirmationRedirect(new Request("http://localhost:3000/api/payments/niubiz/callback"));

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toContain("/consulta/pago/no-confirmado");
  });
});
