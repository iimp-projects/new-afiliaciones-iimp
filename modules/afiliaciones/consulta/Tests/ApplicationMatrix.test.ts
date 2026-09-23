import { beforeEach, describe, expect, it, vi } from "vitest";
import { applicationStates, resolveApplicationAction, canSubmitApplication, blocksNewApplication } from "../../postulacion/Models/ApplicationAction";
import { MembershipType } from "../../postulacion/Types/MembershipType";

const db = vi.hoisted(() => ({
  membershipApplication: { findFirst: vi.fn(), findUnique: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn() },
  membershipObservation: { findMany: vi.fn() }, person: { findUnique: vi.fn() }, user: { findFirst: vi.fn() }, $queryRaw: vi.fn(), $executeRaw: vi.fn(), $transaction: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({ prisma: db }));
vi.mock("../../postulacion/Services/NotifySponsorsService", () => ({ NotifySponsorsService: class { execute = vi.fn(); } }));
vi.mock("../../postulacion/Services/NotifyApplicantService", () => ({ NotifyApplicantService: class { execute = vi.fn(); } }));
vi.mock("../../postulacion/Services/DeclarationPdfService", () => ({ DeclarationPdfService: class { generate = vi.fn().mockResolvedValue(new Uint8Array()); } }));
import { ApplicationAccessService } from "../../postulacion/Services/ApplicationAccessService";
import { ApplicationLookupService } from "../../postulacion/Services/ApplicationLookupService";
import { ApplicationRepository } from "../../postulacion/Repositories/ApplicationRepository";
import { GetApplicationByTrackingService } from "../../postulacion/Services/GetApplicationByTrackingService";
import { UpdateDraftService } from "../../postulacion/Services/UpdateDraftService";
import { SubmitApplicationService } from "../../postulacion/Services/SubmitApplicationService";
import { StartApplicationService } from "../../postulacion/Services/StartApplicationService";
import { queryAuthorization } from "../Services/QueryAuthorizationService";

const app = (status = "DRAFT", id = 7) => ({ id, status, documentType: "DNI", documentNumber: "12345678", affiliateType: "ACTIVE", email: "maria@example.com", phone: "999111812", trackingCode: `private-${id}`, createdAt: new Date(), draftData: { personalInformation: { documentType: "DNI", documentNumber: "12345678", firstName: "Maria" } } });
const token = () => queryAuthorization.createAccess([7], 7);
beforeEach(() => {
  vi.resetAllMocks(); vi.stubEnv("AUTH_SECRET", "matrix-tests-only-secret");
  db.$transaction.mockImplementation(async action => action(db));
  db.membershipApplication.findFirst.mockResolvedValue(app());
  db.membershipApplication.findUnique.mockResolvedValue(app());
  db.membershipApplication.findMany.mockResolvedValue([]);
  db.person.findUnique.mockResolvedValue(null);
  db.user.findFirst.mockResolvedValue(null);
  db.membershipApplication.create.mockImplementation(async ({ data }) => ({ ...app(), ...data, id: 9 }));
});

describe("one matrix for both entry points", () => {
  const expected = ["DRAFT_RECOVERY", "VIEW_STATUS", "VIEW_STATUS", "REVIEW_OBSERVATIONS", "VIEW_STATUS", "CONTINUE_PAYMENT", "COMPLETED", "VIEW_REJECTION"];
  it.each(applicationStates)("resolves %s in both contexts", status => {
    for (const context of ["POSTULACION", "CONSULTA"] as const) {
      expect(resolveApplicationAction(status, context).action).toBe(expected[applicationStates.indexOf(status)]);
      expect(canSubmitApplication(status)).toBe(status === "DRAFT");
      expect(blocksNewApplication(status)).toBe(status !== "REJECTED");
    }
  });
  it("allows a new application only when absent or eligible after rejection", () => {
    for (const context of ["POSTULACION", "CONSULTA"] as const) {
      expect(resolveApplicationAction(null, context).action).toBe("START_NEW_APPLICATION");
      expect(resolveApplicationAction("REJECTED", context, true).action).toBe("START_NEW_APPLICATION");
      expect(resolveApplicationAction("REJECTED", context, false).action).toBe("VIEW_REJECTION");
      expect(resolveApplicationAction("UNRECOGNIZED", context, true).action).toBe("UNKNOWN");
    }
  });
});

describe("private lookup and verified authorization", () => {
  it("returns only opaque challenges and masked contacts, searches all live records and affiliate type", async () => {
    db.membershipApplication.findMany.mockResolvedValue([app("PENDING"), { ...app("REJECTED", 8), email: "other@example.com" }]);
    const result = await new ApplicationLookupService().lookup({ documentType: "DNI", documentNumber: "12345678", affiliateType: "ACTIVE" });
    expect(result.options).toHaveLength(2);
    expect(db.membershipApplication.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { documentType: "DNI", documentNumber: "12345678", affiliateType: "ACTIVE", deletedAt: null } }));
    expect(db.membershipApplication.findMany.mock.calls[0][0]).not.toHaveProperty("take");
    const body = JSON.stringify(result);
    for (const secret of ["maria@example.com", "999111812", "Maria", "private-7", "PENDING", "REJECTED", "documentNumber"]) expect(body).not.toContain(secret);
    expect(queryAuthorization.allowedIds(result.context)).toEqual([]);
  });
  it("authorizes only siblings sharing the actual verified destination", async () => {
    db.membershipApplication.findMany.mockResolvedValue([app(), app("PENDING", 8), { ...app("PENDING", 9), email: "different@example.com" }]);
    const access = await new ApplicationAccessService().grantVerified(7, { channel: "EMAIL", destination: "maria@example.com" });
    expect(queryAuthorization.allowedIds(access)).toEqual([7, 8]);
    expect(() => new ApplicationAccessService().require(9, access)).toThrow("Verifica tu identidad");
  });
  it("does not infer authorization from a contact changed after OTP delivery", async () => {
    db.membershipApplication.findMany.mockResolvedValue([{ ...app(), email: "changed@example.com" }]);
    await expect(new ApplicationAccessService().grantVerified(7, { channel: "EMAIL", destination: "maria@example.com" })).rejects.toMatchObject({ code: "VERIFICATION_REQUIRED" });
  });
  it.each([false, true])("rejects new-application CTA when an affiliate already exists: %s", async affiliate => {
    db.membershipApplication.findMany.mockResolvedValue([app("REJECTED")]);
    db.person.findUnique.mockResolvedValue(affiliate ? { user: { type: "AFFILIATE" } } : null);
    const [result] = await new ApplicationAccessService().list(token());
    expect(result.canStartNew).toBe(!affiliate); expect(result.recoveryUrl).toBeNull();
  });
  it("keeps all authorized requests selectable and blocks rejected recreation when another is active", async () => {
    db.membershipApplication.findMany.mockResolvedValue([app("REJECTED"), app("DRAFT", 8)]);
    const result = await new ApplicationAccessService().list(queryAuthorization.createAccess([7, 8], 7));
    expect(result.map(item => item.id)).toEqual([8, 7]);
    expect(result[0].recoveryUrl).toContain("/postulacion/asociado?trackingCode=");
    expect(result[1].canStartNew).toBe(false);
  });
});

describe("server-side draft, correction and submit boundaries", () => {
  const repository = () => ({ findByTrackingCode: vi.fn().mockResolvedValue(app()), updateDraft: vi.fn().mockResolvedValue(app()), submitApplication: vi.fn().mockResolvedValue(app("PENDING")) });
  it("trackingCode alone or another application's cookie cannot read, save or submit", async () => {
    for (const access of [undefined, queryAuthorization.createAccess([99], 99)]) {
      const repo = repository();
      await expect(new GetApplicationByTrackingService(repo as never).execute("private-7", access)).rejects.toMatchObject({ code: "VERIFICATION_REQUIRED" });
      await expect(new UpdateDraftService(repo as never).execute("private-7", { currentStep: 1, draftData: { membershipType: MembershipType.ACTIVE } }, access)).rejects.toMatchObject({ code: "VERIFICATION_REQUIRED" });
      await expect(new SubmitApplicationService(repo as never, {} as never).execute("private-7", access)).rejects.toMatchObject({ code: "VERIFICATION_REQUIRED" });
      expect(repo.updateDraft).not.toHaveBeenCalled(); expect(repo.submitApplication).not.toHaveBeenCalled();
    }
  });
  it("recovers and updates an authorized draft", async () => {
    const repo = repository();
    expect((await new GetApplicationByTrackingService(repo as never).execute("private-7", token())).status).toBe("DRAFT");
    await new UpdateDraftService(repo as never).execute("private-7", { currentStep: 1, draftData: { membershipType: MembershipType.ACTIVE } }, token());
    expect(repo.updateDraft).toHaveBeenCalledOnce();
  });
  it("submits an authorized draft using the existing validator and notification flow", async () => {
    const repo = repository();
    const validator = { validate: vi.fn().mockReturnValue({ valid: true, errors: [] }) };
    const result = await new SubmitApplicationService(repo as never, validator as never).execute("private-7", token());
    expect(result.status).toBe("PENDING");
    expect(validator.validate).toHaveBeenCalledOnce(); expect(repo.submitApplication).toHaveBeenCalledOnce();
  });
  it("rejects an update if submission happened between service validation and persistence", async () => {
    db.membershipApplication.findUnique.mockResolvedValue(app("PENDING"));
    await expect(new ApplicationRepository().updateDraft("private-7", { currentStep: 1, draftData: { membershipType: MembershipType.ACTIVE } }, "DRAFT")).rejects.toMatchObject({ code: "APPLICATION_NOT_EDITABLE" });
    expect(db.membershipApplication.update).not.toHaveBeenCalled();
    expect(db.$queryRaw).toHaveBeenCalled();
  });
  it.each(applicationStates.filter(status => status !== "DRAFT"))("never recovers or submits %s as a draft", async status => {
    const repo = repository(); repo.findByTrackingCode.mockResolvedValue(app(status));
    await expect(new GetApplicationByTrackingService(repo as never).execute("private-7", token())).rejects.toMatchObject({ code: "APPLICATION_NOT_EDITABLE" });
    await expect(new SubmitApplicationService(repo as never, {} as never).execute("private-7", token())).rejects.toMatchObject({ code: "ALREADY_SUBMITTED" });
    if (status !== "OBSERVED") await expect(new UpdateDraftService(repo as never).execute("private-7", { currentStep: 1, draftData: { membershipType: MembershipType.ACTIVE } }, token())).rejects.toMatchObject({ code: "APPLICATION_NOT_EDITABLE" });
    expect(repo.submitApplication).not.toHaveBeenCalled(); expect(repo.updateDraft).not.toHaveBeenCalled();
    db.membershipApplication.findUnique.mockResolvedValue(app(status));
    await expect(new ApplicationRepository().submitApplication("private-7")).rejects.toMatchObject({ code: "ALREADY_SUBMITTED" });
    expect(db.$queryRaw).toHaveBeenCalled();
  });
  it("observed requests reject changes outside the specified field paths", async () => {
    const repo = repository(); repo.findByTrackingCode.mockResolvedValue(app("OBSERVED"));
    db.membershipObservation.findMany.mockResolvedValue([{ fieldPaths: ["personalInformation.address"] }]);
    await expect(new UpdateDraftService(repo as never).execute("private-7", { currentStep: 1, draftData: { personalInformation: { ...app().draftData.personalInformation, firstName: "Changed" } } } as never, token())).rejects.toThrow("Solo puede modificar");
    expect(repo.updateDraft).not.toHaveBeenCalled();
  });
});

describe("new applications and duplicate protection", () => {
  const input = { documentType: "DNI", documentNumber: "12345678", affiliateType: "ACTIVE", email: "maria@example.com", phone: "999111812" };
  it.each(applicationStates.filter(status => status !== "REJECTED"))("blocks creation over %s inside the transaction", async status => {
    db.membershipApplication.findMany.mockResolvedValue([app(status)]);
    await expect(new StartApplicationService(new ApplicationRepository()).execute(input, token())).rejects.toMatchObject({ code: "APPLICATION_EXISTS" });
    expect(db.$executeRaw).toHaveBeenCalled(); expect(db.membershipApplication.create).not.toHaveBeenCalled();
  });
  it("creates a fresh draft when no request exists", async () => {
    const result = await new StartApplicationService(new ApplicationRepository()).execute(input);
    expect(result.status).toBe("DRAFT"); expect(result.id).toBe(9);
    expect(db.membershipApplication.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ affiliateType: "ACTIVE", deletedAt: null }) }));
  });
  it("requires OTP to start again after rejection, creates a different row and preserves history", async () => {
    db.membershipApplication.findMany.mockResolvedValue([app("REJECTED")]);
    const service = new StartApplicationService(new ApplicationRepository());
    await expect(service.execute(input)).rejects.toMatchObject({ code: "VERIFICATION_REQUIRED" });
    const result = await service.execute(input, token());
    expect(result.id).toBe(9); expect(result.status).toBe("DRAFT");
    expect(db.membershipApplication.update).not.toHaveBeenCalled();
  });
});
