import { describe, expect, it } from "vitest";
import { planQuotaUpsert } from "../Services/QuotaUpsertPlanner";
import { QuotaNormalizer } from "../Services/QuotaNormalizer";
import { quotaFixture, quotaPerson } from "./quotaFixtures";

describe("planQuotaUpsert", () => {
  const incoming = new QuotaNormalizer().normalize(quotaFixture(), quotaPerson);

  it("inserta cuando no existe", () => {
    expect(planQuotaUpsert(null, incoming)).toBe("INSERTED");
  });

  it("no modifica cuando la huella financiera es igual", () => {
    expect(planQuotaUpsert({ sourcePayloadHash: incoming.sourcePayloadHash }, incoming)).toBe("UNCHANGED");
  });

  it("actualiza cuando la huella financiera cambia sin crear otra identidad", () => {
    const changed = new QuotaNormalizer().normalize(quotaFixture({ monto: 200 }), quotaPerson);
    expect(changed.sourceKey).toBe(incoming.sourceKey);
    expect(planQuotaUpsert({ sourcePayloadHash: incoming.sourcePayloadHash }, changed)).toBe("UPDATED");
  });
});
