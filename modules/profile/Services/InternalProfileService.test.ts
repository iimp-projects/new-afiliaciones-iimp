import { describe, expect, it, vi } from "vitest";
import { InternalProfileService } from "./InternalProfileService";

const record = {
  user: {
    id: 41,
    email: "interno@example.test",
    image: "afiliaciones/perfiles/original.png",
    status: "ACTIVE",
    role: { name: "Atención asociado", slug: "ATENCION_ASOCIADO" },
    person: {
      firstName: "Persona", paternalLastName: "Demo", maternalLastName: null,
      documentType: "DNI", documentNumber: "99999999",
      contacts: [{ id: 11, phoneType: "MOBILE", phoneNumber: "+51 999 111 222", email: "interno@example.test", isPrimary: true }],
    },
  },
};

function setup() {
  const repository = { findByUserId: vi.fn().mockResolvedValue(record), updateOwnProfile: vi.fn().mockResolvedValue(undefined) };
  const storage = { getPresignedAvatarUrl: vi.fn().mockResolvedValue("https://signed.example/avatar"), uploadPrivateFile: vi.fn().mockResolvedValue("afiliaciones/perfiles/new-avatar.png") };
  return { repository, storage, service: new InternalProfileService(repository as never, storage as never) };
}

describe("InternalProfileService", () => {
  it("obtiene únicamente el perfil del usuario interno solicitado", async () => {
    const { service, repository } = setup();
    const profile = await service.getForCurrentUser(41);
    expect(repository.findByUserId).toHaveBeenCalledWith(41);
    expect(profile.contact.email).toBe("interno@example.test");
    expect(profile.account.roleSlug).toBe("ATENCION_ASOCIADO");
  });

  it("actualiza el teléfono del propio usuario sin enviar identidad administrativa", async () => {
    const { service, repository } = setup();
    await service.updateForCurrentUser(41, { phone: "+51 987 654 321" });
    expect(repository.updateOwnProfile).toHaveBeenCalledWith(41, "+51 987 654 321", undefined);
  });

  it("devuelve la URL presignada solo al consultar y nunca como valor persistido", async () => {
    const { service, storage } = setup();
    const profile = await service.getForCurrentUser(41);
    expect(storage.getPresignedAvatarUrl).toHaveBeenCalledWith("afiliaciones/perfiles/original.png");
    expect(profile.personal.avatarUrl).toBe("https://signed.example/avatar");
  });

  it("acepta un avatar PNG válido y persiste únicamente una key estable", async () => {
    const { service, repository, storage } = setup();
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const avatar = { size: png.length, type: "image/png", name: "avatar.png", arrayBuffer: async () => png.buffer.slice(png.byteOffset, png.byteOffset + png.byteLength) } as unknown as File;
    await service.updateForCurrentUser(41, { phone: "+51 987 654 321" }, avatar);
    expect(storage.uploadPrivateFile).toHaveBeenCalledWith(expect.any(Buffer), "avatar.png", "image/png", "afiliaciones/perfiles");
    expect(repository.updateOwnProfile).toHaveBeenCalledWith(41, "+51 987 654 321", "afiliaciones/perfiles/new-avatar.png");
    expect(repository.updateOwnProfile.mock.calls[0][2]).not.toContain("https://");
  });

  it("rechaza archivos que no coinciden con los magic bytes declarados", async () => {
    const { service, storage } = setup();
    const avatar = { size: 4, type: "image/png", name: "malicioso.png", arrayBuffer: async () => new Uint8Array([1, 2, 3, 4]).buffer } as unknown as File;
    await expect(service.updateForCurrentUser(41, { phone: "+51 987 654 321" }, avatar)).rejects.toThrow("no corresponde");
    expect(storage.uploadPrivateFile).not.toHaveBeenCalled();
  });
});
