import { PaymentStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { NiubizAuthorizationResultClassifier } from "../Services/Niubiz/NiubizAuthorizationResultClassifier";
import { NIUBIZ_ACTION_CODES, NIUBIZ_APPROVED_ACTION_CODES } from "../Services/Niubiz/NiubizActionCodes";
import { NiubizResponseMapper } from "../Services/Niubiz/NiubizResponseMapper";

const classifier = new NiubizAuthorizationResultClassifier();
const mapper = new NiubizResponseMapper(classifier);

describe("NiubizAuthorizationResultClassifier", () => {
  it("mantiene una autorizaciÃ³n correcta como PAID sin datos de fallo", () => {
    const result = mapper.mapAuthorization({ STATUS: "Authorized", dataMap: { ACTION_CODE: "000" } }, "web", 200);
    expect(result.status).toBe(PaymentStatus.PAID);
    expect(result.failureCode).toBeUndefined();
    expect(result.failureReason).toBeUndefined();
    expect(result.gatewayErrorCode).toBeUndefined();
  });

  it("clasifica el Ãºnico fixture de rechazo documentado como FAILED", () => {
    const result = mapper.mapAuthorization({ dataMap: { ACTION_CODE: "116", ACTION_DESCRIPTION: "Fondos insuficientes" } }, "web", 200);
    expect(result).toMatchObject({
      status: PaymentStatus.FAILED,
      responseCode: "116",
      actionCode: "116",
      failureCode: "116",
      failureReason: "Fondos insuficientes",
      gatewayPayload: { actionDescription: "Fondos insuficientes" },
    });
  });

  it.each([500, 502, 503, 504])("mantiene PENDING una respuesta %i incluso con errorCode", (status) => {
    const result = mapper.mapAuthorization({ dataMap: { ACTION_CODE: "116", ACTION_DESCRIPTION: "Fondos insuficientes" } }, "web", status);
    expect(result.status).toBe(PaymentStatus.PENDING);
    expect(result.failureCode).toBeUndefined();
    expect(result.failureReason).toBeUndefined();
    expect(result.gatewayErrorCode).toBeUndefined();
  });

  it("mantiene PENDING un cÃ³digo no documentado, body vacÃ­o o respuesta ambigua", () => {
    expect(classifier.classify({ ACTION_CODE: "999" }, 200).outcome).toBe("TECHNICAL_UNCERTAIN");
    expect(classifier.classify({}, 200).outcome).toBe("TECHNICAL_UNCERTAIN");
    expect(mapper.mapAuthorization({ ACTION_CODE: "999" }, undefined, 400).status).toBe(PaymentStatus.PENDING);
  });

  it("contiene todos los cÃ³digos oficiales proporcionados y conserva el tipo temporal documentado", () => {
    expect(Object.keys(NIUBIZ_ACTION_CODES)).toHaveLength(77);
    expect(NIUBIZ_ACTION_CODES["116"]).toMatchObject({ rejectionType: "TEMPORARY", origin: "ISSUER" });
    expect(NIUBIZ_ACTION_CODES["118"]).toMatchObject({ rejectionType: "PERMANENT" });
    expect(NIUBIZ_ACTION_CODES["912"]).toMatchObject({ rejectionType: "TEMPORARY" });
    expect(NIUBIZ_ACTION_CODES["208"]?.userMessage).toContain("perdida");
  });
  it.each(Object.keys(NIUBIZ_ACTION_CODES).filter((code) => !NIUBIZ_APPROVED_ACTION_CODES.has(code)))("clasifica ACTION_CODE oficial %s como rechazo confirmado", (actionCode) => {
    const result = mapper.mapAuthorization({ dataMap: { ACTION_CODE: actionCode } }, "web", 200);
    expect(result).toMatchObject({ status: PaymentStatus.FAILED, actionCode, failureCode: actionCode });
  });

  it("mantiene PENDING ante STATUS y ACTION_CODE contradictorios", () => {
    const result = mapper.mapAuthorization({ STATUS: "Authorized", dataMap: { ACTION_CODE: "116" } }, "web", 200);
    expect(result.status).toBe(PaymentStatus.PENDING);
  });

  it.each(["116", "101", "118", "208"])("clasifica HTTP 400 con ACTION_CODE oficial %s como FAILED", (actionCode) => {
    const result = mapper.mapAuthorization({ data: { ACTION_CODE: actionCode } }, "web", 400);
    expect(result).toMatchObject({ status: PaymentStatus.FAILED, actionCode, failureCode: actionCode });
  });
});
