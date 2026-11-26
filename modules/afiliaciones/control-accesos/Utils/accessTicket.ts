import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { AccessMovementType } from "@prisma/client";
import type { AccessMovementSourceInput } from "../Models/access";

export type AccessTicketPayload = {
  personId: number;
  siteId: number;
  accessPointId: number;
  movementType: AccessMovementType;
  source: AccessMovementSourceInput;
  operatorId: number;
  cardId: string | null;
  expiresAt: number;
  nonce: string;
};

export type TicketVerification =
  | { ok: true; payload: AccessTicketPayload }
  | { ok: false; reason: "INVALID" | "EXPIRED" };

const DEFAULT_TTL_MS = 5 * 60 * 1000;

function ticketSecret(): string {
  const value = process.env.ACCESS_CONTROL_TICKET_SECRET ?? process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (!value) throw new Error("ACCESS_CONTROL_TICKET_SECRET no está configurado.");
  return value;
}

function sign(body: string): string {
  return createHmac("sha256", ticketSecret()).update(body).digest("base64url");
}

export function issueAccessTicket(
  input: Omit<AccessTicketPayload, "expiresAt" | "nonce">,
  ttlMs = DEFAULT_TTL_MS,
): { ticket: string; expiresAt: string } {
  const payload: AccessTicketPayload = {
    ...input,
    expiresAt: Date.now() + ttlMs,
    nonce: randomBytes(12).toString("base64url"),
  };
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return { ticket: `${body}.${sign(body)}`, expiresAt: new Date(payload.expiresAt).toISOString() };
}

export function verifyAccessTicket(ticket: string): TicketVerification {
  const [body, signature] = ticket.split(".");
  if (!body || !signature) return { ok: false, reason: "INVALID" };

  const expected = Buffer.from(sign(body));
  const received = Buffer.from(signature);
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) {
    return { ok: false, reason: "INVALID" };
  }

  let payload: AccessTicketPayload;
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as AccessTicketPayload;
  } catch {
    return { ok: false, reason: "INVALID" };
  }

  const validShape =
    Number.isInteger(payload.personId) &&
    Number.isInteger(payload.siteId) &&
    Number.isInteger(payload.accessPointId) &&
    Number.isInteger(payload.operatorId) &&
    typeof payload.expiresAt === "number" &&
    (payload.movementType === "ENTRY" || payload.movementType === "EXIT") &&
    typeof payload.nonce === "string";
  if (!validShape) return { ok: false, reason: "INVALID" };
  if (payload.expiresAt < Date.now()) return { ok: false, reason: "EXPIRED" };
  return { ok: true, payload };
}
