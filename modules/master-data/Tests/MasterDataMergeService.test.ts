import { describe, expect, it } from "vitest";
import { validateMergeSelection } from "../Services/MasterDataMergeService";

describe("MasterDataMergeService selection validation", () => {
  it("requires at least two records", () => expect(validateMergeSelection([1], 1)).toContain("2"));
  it("rejects more than twenty records", () => expect(validateMergeSelection(Array.from({ length: 21 }, (_, index) => index + 1), 1)).toContain("20"));
  it("requires the canonical record to be selected", () => expect(validateMergeSelection([1, 2], 3)).toContain("canónico"));
  it("accepts a valid multi-selection", () => expect(validateMergeSelection([1, 2, 3], 2)).toBeNull());
});
