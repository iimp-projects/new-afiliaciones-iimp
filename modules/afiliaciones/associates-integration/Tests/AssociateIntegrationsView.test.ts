import { describe, expect, it } from "vitest";
import { buildAssociateIntegrationsQuery, canRetry } from "../Views/AssociateIntegrationsView";
import { getSieTransmissionState } from "../Components/AssociateIntegrationDrawer";

describe("AssociateIntegrationsView", () => {
    it("includes selected filters in the list query", () => {
        expect(buildAssociateIntegrationsQuery({ page: 2, pageSize: 20, status: "RETRYABLE", trigger: "ACTIVE_PAYMENT", search: "EXP-10" })).toBe("page=2&pageSize=20&status=RETRYABLE&trigger=ACTIVE_PAYMENT&search=EXP-10");
    });

    it("allows retry only for RETRYABLE", () => {
        expect(canRetry("RETRYABLE")).toBe(true);
        ["PENDING", "PROCESSING", "SYNCED", "FAILED"].forEach((status) => expect(canRetry(status)).toBe(false));
    });

    it("distinguishes pending, local failure, transport failure and successful transport", () => {
        const base = {
            status: "PENDING",
            error: {},
            attemptHistory: [],
        };
        expect(getSieTransmissionState(base as never)).toBe("NOT_ATTEMPTED");
        expect(getSieTransmissionState({ ...base, status: "FAILED", error: { code: "MISSING_ASSOCIATE_ADDRESS" } } as never)).toBe("LOCAL_FAILURE");
        expect(getSieTransmissionState({ ...base, status: "RETRYABLE", attemptHistory: [{ attemptNumber: 1, result: "RETRYABLE" }] } as never)).toBe("TRANSPORT_FAILURE");
        expect(getSieTransmissionState({ ...base, status: "SYNCED", attemptHistory: [{ attemptNumber: 1, result: "SYNCED" }] } as never)).toBe("SYNCED");
    });
});
