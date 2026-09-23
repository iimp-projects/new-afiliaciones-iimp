import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: vi.fn(async () => "https://signed.example/object"),
}));

import { isObjectKeyAllowed, resolveAvatarAccess, S3StorageService } from "./S3StorageService";

const LEGACY_AVATAR = "users/avatars/2f1c9e6a-1b2c-4d5e-8f90-abcdef123456.jpg";
const OTHER_LEGACY_AVATAR = "users/avatars/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee.jpg";

describe("resolveAvatarAccess", () => {
  it("autoriza el prefijo dedicado de avatares actuales", () => {
    const access = resolveAvatarAccess("afiliaciones/perfiles/foto.png");
    expect(access).toEqual({ allowedPrefixes: ["afiliaciones/perfiles"], allowedKeys: [] });
    expect(isObjectKeyAllowed("afiliaciones/perfiles/foto.png", access!.allowedPrefixes, access!.allowedKeys)).toBe(true);
  });

  it("autoriza un avatar legacy únicamente por su clave exacta", () => {
    const access = resolveAvatarAccess(LEGACY_AVATAR);
    expect(access).toEqual({ allowedPrefixes: [], allowedKeys: [LEGACY_AVATAR] });
    expect(isObjectKeyAllowed(LEGACY_AVATAR, access!.allowedPrefixes, access!.allowedKeys)).toBe(true);
    expect(isObjectKeyAllowed(OTHER_LEGACY_AVATAR, access!.allowedPrefixes, access!.allowedKeys)).toBe(false);
  });

  it("rechaza documentos de expediente y claves de otros dominios", () => {
    expect(resolveAvatarAccess("afiliaciones/applications/5/photos/a.jpg")).toBeNull();
    expect(resolveAvatarAccess("afiliaciones/fotos/a.jpg")).toBeNull();
    expect(resolveAvatarAccess("legacy_docs/secret.pdf")).toBeNull();
  });

  it("no autoriza el prefijo global afiliaciones/* ni el prefijo legacy completo", () => {
    expect(resolveAvatarAccess("afiliaciones/cualquier-cosa.jpg")).toBeNull();
    expect(resolveAvatarAccess("users/avatars/not-a-uuid.jpg")).toBeNull();
    expect(resolveAvatarAccess("users/avatars")).toBeNull();
  });
});

describe("S3StorageService.getPresignedAvatarUrl", () => {
  beforeEach(() => {
    process.env.AWS_BUCKET = "test-bucket";
    process.env.AWS_DEFAULT_REGION = "us-east-1";
  });

  it("firma un avatar legítimo del prefijo actual", async () => {
    await expect(new S3StorageService().getPresignedAvatarUrl("afiliaciones/perfiles/foto.png"))
      .resolves.toBe("https://signed.example/object");
  });

  it("firma un avatar legacy por clave exacta", async () => {
    await expect(new S3StorageService().getPresignedAvatarUrl(LEGACY_AVATAR))
      .resolves.toBe("https://signed.example/object");
  });

  it("devuelve null para claves no autorizadas sin lanzar", async () => {
    await expect(new S3StorageService().getPresignedAvatarUrl("afiliaciones/applications/9/photos/a.jpg")).resolves.toBeNull();
    await expect(new S3StorageService().getPresignedAvatarUrl("legacy_docs/a.pdf")).resolves.toBeNull();
    await expect(new S3StorageService().getPresignedAvatarUrl("afiliaciones/perfiles")).resolves.toBeNull();
  });

  it("devuelve null ante traversal o claves inválidas", async () => {
    await expect(new S3StorageService().getPresignedAvatarUrl("afiliaciones/perfiles/../../secret")).resolves.toBeNull();
    await expect(new S3StorageService().getPresignedAvatarUrl("users/avatars/../secret.jpg")).resolves.toBeNull();
    await expect(new S3StorageService().getPresignedAvatarUrl("https://evil.example.com/afiliaciones/perfiles/a.png")).resolves.toBeNull();
  });
});
