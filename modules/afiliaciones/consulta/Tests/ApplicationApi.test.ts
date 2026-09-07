import { afterEach, describe, expect, it, vi } from "vitest";
import { ApplicationApi } from "../../postulacion/Services/ApplicationApi";
import { MembershipType } from "../../postulacion/Types/MembershipType";
afterEach(() => vi.unstubAllGlobals());
describe("ApplicationApi semantic error normalization", () => {
  it.each([{ error: "Solicitud enviada" }, { message: "Solicitud enviada" }])("accepts the real backend shape %j", async body => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 409, json: async () => ({ ...body, code: "APPLICATION_NOT_EDITABLE" }) }));
    await expect(new ApplicationApi().updateDraft("identified-only", { currentStep: 1, draftData: { membershipType: MembershipType.ACTIVE } })).rejects.toMatchObject({ message: "Solicitud enviada", code: "APPLICATION_NOT_EDITABLE", functional: true, status: 409 });
  });
  it("preserves field validation and distinguishes technical errors", async () => {
    const fetch = vi.fn().mockResolvedValueOnce({ ok: false, status: 422, json: async () => ({ errors: [{field: "email", message: "Revisa el correo"}] }) }).mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) });
    vi.stubGlobal("fetch", fetch);
    await expect(new ApplicationApi().submit("identified-only")).rejects.toMatchObject({ code: "VALIDATION_ERROR", functional: false, errors: [{field: "email", message: "Revisa el correo"}] });
    await expect(new ApplicationApi().submit("identified-only")).rejects.toMatchObject({ code: "INTERNAL_ERROR", functional: false });
  });
});
