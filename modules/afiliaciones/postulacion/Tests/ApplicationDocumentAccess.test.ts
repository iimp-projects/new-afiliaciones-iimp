import { describe, expect, it } from "vitest";
import { resolveApplicationDocumentScope } from "../Services/ApplicationDocumentAccess";
import { isObjectKeyAllowed } from "@/modules/shared/Services/S3StorageService";

describe("resolveApplicationDocumentScope", () => {
  it("limita a un usuario interno a documentos de expedientes", () => {
    const scope = resolveApplicationDocumentScope({ isInternal: true, applicantApplicationIds: [] });
    expect(scope?.allowedPrefixes).toEqual(["afiliaciones/applications"]);
  });

  it("limita a un postulante a sus propias solicitudes", () => {
    const scope = resolveApplicationDocumentScope({ isInternal: false, applicantApplicationIds: [5, 9] });
    expect(scope?.allowedPrefixes).toEqual([
      "afiliaciones/applications/5",
      "afiliaciones/applications/9",
    ]);
  });

  it("no otorga alcance a un afiliado externo sin solicitudes autorizadas", () => {
    expect(resolveApplicationDocumentScope({ isInternal: false, applicantApplicationIds: [] })).toBeNull();
  });

  it("ignora identificadores de solicitud inválidos", () => {
    expect(resolveApplicationDocumentScope({ isInternal: false, applicantApplicationIds: [0, -1, 1.5, Number.NaN] })).toBeNull();
  });
});

describe("application document authorization boundary", () => {
  it("permite un documento del expediente autorizado", () => {
    const scope = resolveApplicationDocumentScope({ isInternal: false, applicantApplicationIds: [5] })!;
    expect(isObjectKeyAllowed("afiliaciones/applications/5/photos/foto.jpg", scope.allowedPrefixes)).toBe(true);
  });

  it("rechaza un documento de otro expediente", () => {
    const scope = resolveApplicationDocumentScope({ isInternal: false, applicantApplicationIds: [5] })!;
    expect(isObjectKeyAllowed("afiliaciones/applications/9/photos/foto.jpg", scope.allowedPrefixes)).toBe(false);
  });

  it("no mezcla el dominio de avatares con el de expedientes", () => {
    const internal = resolveApplicationDocumentScope({ isInternal: true, applicantApplicationIds: [] })!;
    expect(internal.allowedPrefixes).toEqual(["afiliaciones/applications"]);
    expect(isObjectKeyAllowed("afiliaciones/perfiles/foto.png", internal.allowedPrefixes)).toBe(false);
    expect(isObjectKeyAllowed("users/avatars/legacy.jpg", internal.allowedPrefixes)).toBe(false);
  });

  it("no expone el prefijo global afiliaciones/*", () => {
    const internal = resolveApplicationDocumentScope({ isInternal: true, applicantApplicationIds: [] })!;
    expect(internal.allowedPrefixes).not.toContain("afiliaciones");
  });
});
