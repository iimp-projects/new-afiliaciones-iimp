import { describe, expect, it } from "vitest";
import { APPLICATION_KEY_PREFIX, LEGACY_DOCUMENT_KEY_PREFIX, resolveApplicationDocumentScope } from "../Services/ApplicationDocumentAccess";
import { isObjectKeyAllowed } from "@/modules/shared/Services/S3StorageService";

describe("resolveApplicationDocumentScope", () => {
  it("limita a un usuario interno a documentos de expedientes y documentos legacy", () => {
    const scope = resolveApplicationDocumentScope({ isInternal: true, applicantApplicationIds: [] });
    expect(scope?.allowedPrefixes).toEqual(["afiliaciones/applications", "afiliaciones/legacy/documents"]);
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

  it("no expone el prefijo global afiliaciones/*", () => {
    const internal = resolveApplicationDocumentScope({ isInternal: true, applicantApplicationIds: [] })!;
    expect(internal.allowedPrefixes).not.toContain("afiliaciones");
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
    expect(isObjectKeyAllowed("afiliaciones/perfiles/foto.png", internal.allowedPrefixes)).toBe(false);
    expect(isObjectKeyAllowed("users/avatars/legacy.jpg", internal.allowedPrefixes)).toBe(false);
  });
});

describe("legacy document read authorization (R43)", () => {
  const internal = () => resolveApplicationDocumentScope({ isInternal: true, applicantApplicationIds: [] })!;

  it("INTERNAL + legacy = ALLOW", () => {
    const scope = internal();
    expect(isObjectKeyAllowed("afiliaciones/legacy/documents/abc.jpg", scope.allowedPrefixes)).toBe(true);
  });

  it("INTERNAL + applications = ALLOW", () => {
    const scope = internal();
    expect(isObjectKeyAllowed("afiliaciones/applications/5/photos/foto.jpg", scope.allowedPrefixes)).toBe(true);
  });

  it("EXTERNAL + legacy = DENY", () => {
    const scope = resolveApplicationDocumentScope({ isInternal: false, applicantApplicationIds: [5] })!;
    expect(isObjectKeyAllowed("afiliaciones/legacy/documents/abc.jpg", scope.allowedPrefixes)).toBe(false);
  });

  it("ANONYMOUS + legacy = DENY", () => {
    const scope = resolveApplicationDocumentScope({ isInternal: false, applicantApplicationIds: [] });
    expect(scope).toBeNull();
  });

  it("prefijo similar malicioso 'legacy/documents-evil' = DENY", () => {
    const scope = internal();
    expect(isObjectKeyAllowed("afiliaciones/legacy/documents-evil/x.jpg", scope.allowedPrefixes)).toBe(false);
  });

  it("prefijo superior 'legacy' = DENY", () => {
    const scope = internal();
    expect(isObjectKeyAllowed("afiliaciones/legacy/x.jpg", scope.allowedPrefixes)).toBe(false);
  });

  it("path traversal '../' = DENY", () => {
    const scope = internal();
    expect(isObjectKeyAllowed("../afiliaciones/legacy/documents/abc.jpg", scope.allowedPrefixes)).toBe(false);
  });

  it("constantes del mapper de avatar coinciden con el scope interno (R44)", () => {
    const internalScope = resolveApplicationDocumentScope({ isInternal: true, applicantApplicationIds: [] })!;
    const mapperPrefixes = [APPLICATION_KEY_PREFIX, LEGACY_DOCUMENT_KEY_PREFIX];
    expect(internalScope.allowedPrefixes).toEqual(mapperPrefixes);
    expect(isObjectKeyAllowed("afiliaciones/legacy/documents/abc.jpg", mapperPrefixes)).toBe(true);
    expect(isObjectKeyAllowed("afiliaciones/applications/5/photos/x.jpg", mapperPrefixes)).toBe(true);
    expect(isObjectKeyAllowed("afiliaciones/legacy/documents-evil/x.jpg", mapperPrefixes)).toBe(false);
  });
});
