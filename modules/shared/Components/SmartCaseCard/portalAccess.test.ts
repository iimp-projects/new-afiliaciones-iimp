import { describe, expect, it } from "vitest";
import { canManagePortalAccess, COMPLETED_APPLICATION_STATUS } from "./types";

describe("portal access card availability", () => {
  it("enables portal access only for the real completed application status", () => {
    expect(canManagePortalAccess(COMPLETED_APPLICATION_STATUS)).toBe(true);
  });

  it.each(["DRAFT", "PENDING", "UNDER_EVALUACION", "OBSERVED", "READY_FOR_PAYMENT", "APPROVED", undefined])(
    "keeps portal access disabled for %s",
    (status) => {
      expect(canManagePortalAccess(status)).toBe(false);
    },
  );
});
