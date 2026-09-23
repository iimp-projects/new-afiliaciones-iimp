import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({ findFirst: vi.fn(), findMany: vi.fn(), verify: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { membershipApplication: { findFirst: mocks.findFirst, findMany: mocks.findMany } } }));
vi.mock("@/modules/afiliaciones/postulacion/Services/OtpRecoveryService", () => ({ OtpRecoveryService: class { verifyOtp = mocks.verify; } }));
import { GET } from "@/app/api/consulta/route";
import { POST } from "@/app/api/afiliaciones/postulacion/verify-otp/route";
import { queryAuthorization, QUERY_COOKIE } from "../Services/QueryAuthorizationService";
import { VerificationError } from "@/modules/shared/Models/VerificationError";

beforeEach(() => { vi.clearAllMocks(); vi.stubEnv("AUTH_SECRET", "test-only-query-secret"); });
describe("query HTTP access", () => {
  it("trackingCode and document no longer unlock the query route", async () => {
    const response = await GET(new NextRequest("http://localhost/api/consulta?documentNumber=12345678&code=APP-123"));
    expect(response.status).toBe(401);
    expect(mocks.findFirst).not.toHaveBeenCalled();
  });
  it("the pre-verification challenge cannot be used as an access cookie", async () => {
    const response = await GET(new NextRequest("http://localhost/api/consulta", { headers: { cookie: `${QUERY_COOKIE}=${queryAuthorization.create(7, "QUERY_CHALLENGE")}` } }));
    expect(response.status).toBe(401);
    expect(mocks.findFirst).not.toHaveBeenCalled();
  });
  it("issues the access cookie only after OTP validation and loads only that application", async () => {
    mocks.verify.mockResolvedValue({ applicationId: 7, channel: "EMAIL", destination: "m@example.com" });
    const application = { id: 7, documentType: "DNI", documentNumber: "12345678", affiliateType: "ACTIVE", email: "m@example.com", phone: "999111812", createdAt: new Date(), applicationCode: "EXP-7", trackingCode: "APP-7", status: "PENDING", person: null, approvals: [], validations: [], observations: [], payments: [] };
    mocks.findFirst.mockResolvedValue(application);
    mocks.findMany.mockResolvedValue([application]);
    const verified = await POST(new NextRequest("http://localhost/api/afiliaciones/postulacion/verify-otp", { method: "POST", body: JSON.stringify({ purpose: "APPLICATION_QUERY", context: queryAuthorization.create(7, "QUERY_CHALLENGE"), code: "123456" }) }));
    expect(mocks.verify).toHaveBeenCalledWith(expect.objectContaining({ kind: "application", applicationId: 7 }), "123456", "APPLICATION_QUERY");
    const cookie = verified.cookies.get(QUERY_COOKIE);
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.sameSite).toBe("strict");

    const detail = await GET(new NextRequest("http://localhost/api/consulta?applicationId=7", { headers: { cookie: `${QUERY_COOKIE}=${cookie?.value}` } }));
    const denied = await GET(new NextRequest("http://localhost/api/consulta?applicationId=999", { headers: { cookie: QUERY_COOKIE + "=" + cookie?.value } }));
    expect(denied.status).toBe(401);
    expect(detail.status).toBe(200);
    expect((await detail.json()).id).toBe(7);
    expect(mocks.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 7, deletedAt: null } }));
    expect(detail.headers.get("Cache-Control")).toBe("no-store");
  });
  it.each(["El código ingresado no es correcto.", "El código ha expirado. Solicita uno nuevo."])("does not grant access: %s", async (message) => {
    mocks.verify.mockRejectedValue(new VerificationError(message));
    const response = await POST(new NextRequest("http://localhost/api/afiliaciones/postulacion/verify-otp", { method: "POST", body: JSON.stringify({ purpose: "APPLICATION_QUERY", context: queryAuthorization.create(7, "QUERY_CHALLENGE"), code: "123456" }) }));
    expect(response.status).toBe(400);
    expect(response.cookies.get(QUERY_COOKIE)).toBeUndefined();
    expect((await response.json()).message).toBe(message);
  });
  it("keeps recovery validation from issuing query authorization", async () => {
    mocks.verify.mockResolvedValue({ applicationId: 7, channel: "EMAIL", destination: "m@example.com" });
    const response = await POST(new NextRequest("http://localhost/api/afiliaciones/postulacion/verify-otp", { method: "POST", body: JSON.stringify({ trackingCode: "APP-7", code: "123456" }) }));
    expect(response.status).toBe(200);
    expect(response.cookies.get(QUERY_COOKIE)).toBeUndefined();
  });
});
