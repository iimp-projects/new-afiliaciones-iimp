import { describe, expect, it } from "vitest";
import { startQuotaSyncSchema } from "../Validators/quotaSync.validator";

describe("startQuotaSyncSchema", () => {
  it("aplica PERSON por defecto y exige asociados", () => {
    expect(startQuotaSyncSchema.safeParse({}).success).toBe(false);
    expect(startQuotaSyncSchema.parse({ personIds: [1, 2] })).toEqual({ scope: "PERSON", personIds: [1, 2] });
  });

  it("acepta BATCH con asociados y rechaza FULL con asociados", () => {
    expect(startQuotaSyncSchema.safeParse({ scope: "BATCH", personIds: [1] }).success).toBe(true);
    expect(startQuotaSyncSchema.safeParse({ scope: "FULL", personIds: [1] }).success).toBe(false);
    expect(startQuotaSyncSchema.parse({ scope: "FULL" })).toEqual({ scope: "FULL" });
  });

  it("limita el lote a 500 asociados", () => {
    expect(startQuotaSyncSchema.safeParse({ scope: "BATCH", personIds: Array.from({ length: 501 }, (_, index) => index + 1) }).success).toBe(false);
  });
});
