import { describe, expect, it } from "vitest";
import { isAvatarUploadFolder, resolveApplicationFolderKind } from "../Services/UploadDestinationResolver";

describe("resolveApplicationFolderKind", () => {
  it.each([
    ["afiliaciones/fotos", "photos"],
    ["afiliaciones/documentos", "identity-documents"],
    ["afiliaciones/estudiantes", "education-documents"],
    ["afiliaciones/declaraciones", "declarations"],
    ["afiliaciones/observaciones", "observations"],
  ])("traduce %s a %s", (folder, kind) => {
    expect(resolveApplicationFolderKind(folder)).toBe(kind);
  });

  it("acepta la carpeta de subsanaciones por tracking code", () => {
    expect(resolveApplicationFolderKind("afiliaciones/APP-1234/subsanaciones")).toBe("observations");
    expect(resolveApplicationFolderKind("afiliaciones/abc_123.xyz/subsanaciones")).toBe("observations");
  });

  it("rechaza carpetas arbitrarias o manipuladas", () => {
    expect(resolveApplicationFolderKind("afiliaciones/temporal")).toBeNull();
    expect(resolveApplicationFolderKind("afiliaciones/../../etc")).toBeNull();
    expect(resolveApplicationFolderKind("afiliaciones/../subsanaciones")).toBeNull();
    expect(resolveApplicationFolderKind("afiliaciones//subsanaciones")).toBeNull();
    expect(resolveApplicationFolderKind("users/avatars")).toBeNull();
    expect(resolveApplicationFolderKind(undefined)).toBeNull();
    expect(resolveApplicationFolderKind(123)).toBeNull();
  });
});

describe("isAvatarUploadFolder", () => {
  it("solo acepta la carpeta explícita de avatares", () => {
    expect(isAvatarUploadFolder("users/avatars")).toBe(true);
    expect(isAvatarUploadFolder("users/avatars/../../x")).toBe(false);
    expect(isAvatarUploadFolder("users")).toBe(false);
    expect(isAvatarUploadFolder(undefined)).toBe(false);
  });
});
