import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdministrativeUser: vi.fn(), getForCurrentUser: vi.fn(), updateForCurrentUser: vi.fn(),
}));

vi.mock("@/modules/auth/context/service", () => ({ contextService: { requireAdministrativeUser: mocks.requireAdministrativeUser } }));
vi.mock("@/modules/profile/Services/InternalProfileService", () => ({
  InternalProfileService: class {
    getForCurrentUser = mocks.getForCurrentUser;
    updateForCurrentUser = mocks.updateForCurrentUser;
  },
}));

import { GET, PATCH } from "./route";

describe("/api/mi-perfil", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdministrativeUser.mockResolvedValue({ id: 41 });
    mocks.getForCurrentUser.mockResolvedValue({ contact: { email: "interno@example.test", phone: "999111222" } });
    mocks.updateForCurrentUser.mockResolvedValue({ contact: { email: "interno@example.test", phone: "999222333" } });
  });

  it("permite al usuario interno autenticado obtener solo su propio perfil", async () => {
    const response = await GET();
    expect(response.status).toBe(200);
    expect(mocks.getForCurrentUser).toHaveBeenCalledWith(41);
  });

  it("rechaza una sesión no autenticada", async () => {
    mocks.requireAdministrativeUser.mockRejectedValue(new Error("unauthorized"));
    expect((await GET()).status).toBe(403);
    expect(mocks.getForCurrentUser).not.toHaveBeenCalled();
  });

  it("rechaza un asociado cuando requireAdministrativeUser lo bloquea", async () => {
    mocks.requireAdministrativeUser.mockRejectedValue(new Error("affiliate redirected"));
    expect((await GET()).status).toBe(403);
  });

  it("actualiza el teléfono usando exclusivamente el id de sesión", async () => {
    const form = new FormData(); form.set("phone", "+51 999 222 333");
    await PATCH(new Request("http://test/api/mi-perfil", { method: "PATCH", body: form }));
    expect(mocks.updateForCurrentUser).toHaveBeenCalledWith(41, { phone: "+51 999 222 333" }, null);
  });

  it.each(["roleId", "status", "email", "userId", "personId"])("rechaza el payload administrativo %s", async (field) => {
    const form = new FormData(); form.set("phone", "+51 999 222 333"); form.set(field, "otro-usuario");
    const response = await PATCH(new Request("http://test/api/mi-perfil", { method: "PATCH", body: form }));
    expect(response.status).toBe(400);
    expect(mocks.updateForCurrentUser).not.toHaveBeenCalled();
  });
});
