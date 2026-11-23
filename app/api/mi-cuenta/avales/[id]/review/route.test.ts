import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  personIdForUser: vi.fn(),
  reviewOwned: vi.fn(),
}));

vi.mock("@/modules/auth/context/service", () => ({
  contextService: { getCurrentUser: mocks.getCurrentUser },
}));
vi.mock("@/modules/afiliaciones/endorsements/Repositories/EndorsementHistoryRepository", () => ({
  EndorsementHistoryRepository: class {
    personIdForUser = mocks.personIdForUser;
  },
}));
vi.mock("@/modules/afiliaciones/postulacion/Services/ReviewEndorsementService", () => {
  class ReviewEndorsementError extends Error {
    code: string;
    constructor(code: string, message: string) {
      super(message);
      this.name = "ReviewEndorsementError";
      this.code = code;
    }
  }
  return {
    ReviewEndorsementError,
    ReviewEndorsementService: class {
      reviewOwned = mocks.reviewOwned;
    },
  };
});

import { POST } from "./route";
import { ReviewEndorsementError } from "@/modules/afiliaciones/postulacion/Services/ReviewEndorsementService";

const affiliate = (overrides: Record<string, unknown> = {}) => ({
  id: 5,
  status: "ACTIVE",
  mustChangePassword: false,
  type: "AFFILIATE",
  role: { slug: "ASOCIADO_ACTIVO" },
  ...overrides,
});

const call = (id: string, action: unknown = "APPROVE") =>
  POST(
    new NextRequest(`http://localhost/api/mi-cuenta/avales/${id}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    }),
    { params: Promise.resolve({ id }) },
  );

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getCurrentUser.mockResolvedValue(affiliate());
  mocks.personIdForUser.mockResolvedValue(42);
  mocks.reviewOwned.mockResolvedValue(undefined);
});

describe("POST /api/mi-cuenta/avales/:id/review", () => {
  it("rejects requests without an active affiliate session", async () => {
    mocks.getCurrentUser.mockResolvedValue(null);

    const response = await call("11");

    expect(response.status).toBe(403);
    expect(mocks.reviewOwned).not.toHaveBeenCalled();
  });

  it("rejects administrative users", async () => {
    mocks.getCurrentUser.mockResolvedValue(affiliate({ type: "INTERNAL", role: { slug: "ADMIN" } }));

    const response = await call("11");

    expect(response.status).toBe(403);
    expect(mocks.reviewOwned).not.toHaveBeenCalled();
  });

  it("rejects an invalid action or identifier", async () => {
    expect((await call("11", "DELETE")).status).toBe(400);
    expect((await call("not-a-number")).status).toBe(400);
    expect(mocks.reviewOwned).not.toHaveBeenCalled();
  });

  it("returns 404 when the account has no linked person", async () => {
    mocks.personIdForUser.mockResolvedValue(null);

    const response = await call("11");

    expect(response.status).toBe(404);
    expect(mocks.reviewOwned).not.toHaveBeenCalled();
  });

  it("reviews the endorsement with the authenticated person's id", async () => {
    const response = await call("11", "APPROVE");

    expect(response.status).toBe(200);
    expect(mocks.reviewOwned).toHaveBeenCalledWith(11, 42, "APPROVE", expect.any(Object));
    await expect(response.json()).resolves.toMatchObject({ success: true });
  });

  it("maps an endorsement that does not belong to the user to 404", async () => {
    mocks.reviewOwned.mockRejectedValue(new ReviewEndorsementError("NOT_FOUND", "No se encontró el registro de aval correspondiente."));

    const response = await call("11");

    expect(response.status).toBe(404);
  });

  it("maps an already processed endorsement to 409", async () => {
    mocks.reviewOwned.mockRejectedValue(new ReviewEndorsementError("ALREADY_PROCESSED", "Ya procesada."));

    const response = await call("11");

    expect(response.status).toBe(409);
  });
});
