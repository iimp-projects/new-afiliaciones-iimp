import { beforeAll, describe, expect, it } from "vitest";
import { issueAccessTicket, verifyAccessTicket } from "../Utils/accessTicket";

beforeAll(() => {
  process.env.AUTH_SECRET = "test-access-control-secret";
});

const payload = {
  personId: 10,
  siteId: 1,
  accessPointId: 2,
  movementType: "ENTRY" as const,
  source: "QR_USB" as const,
  operatorId: 99,
  cardId: "card-1",
};

describe("access ticket", () => {
  it("firma y verifica un ticket válido", () => {
    const { ticket, expiresAt } = issueAccessTicket(payload);
    const verification = verifyAccessTicket(ticket);
    expect(verification.ok).toBe(true);
    if (verification.ok) {
      expect(verification.payload.personId).toBe(10);
      expect(verification.payload.operatorId).toBe(99);
      expect(verification.payload.expiresAt).toBe(Date.parse(expiresAt));
    }
  });

  it("rechaza un ticket manipulado", () => {
    const { ticket } = issueAccessTicket(payload);
    const [body] = ticket.split(".");
    const forgedPayload = Buffer.from(JSON.stringify({ ...payload, personId: 999 }), "utf8").toString("base64url");
    expect(verifyAccessTicket(`${forgedPayload}.${ticket.split(".")[1]}`)).toEqual({ ok: false, reason: "INVALID" });
    expect(verifyAccessTicket(`${body}.firma-invalida`)).toEqual({ ok: false, reason: "INVALID" });
  });

  it("rechaza un ticket expirado", () => {
    const { ticket } = issueAccessTicket(payload, -1_000);
    expect(verifyAccessTicket(ticket)).toEqual({ ok: false, reason: "EXPIRED" });
  });
});
