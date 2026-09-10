import { describe, expect, it } from "vitest";
import { buildAssociateIntegrationsQuery, canRetry } from "../Views/AssociateIntegrationsView";

describe("AssociateIntegrationsView", () => {
    it("includes selected filters in the list query", () => {
        expect(buildAssociateIntegrationsQuery({ page: 2, pageSize: 20, status: "RETRYABLE", trigger: "ACTIVE_PAYMENT", search: "EXP-10" })).toBe("page=2&pageSize=20&status=RETRYABLE&trigger=ACTIVE_PAYMENT&search=EXP-10");
    });

    it("allows retry only for RETRYABLE", () => {
        expect(canRetry("RETRYABLE")).toBe(true);
        ["PENDING", "PROCESSING", "SYNCED", "FAILED"].forEach((status) => expect(canRetry(status)).toBe(false));
    });
});
