export type CategoryLoginPolicy = "READY" | "NO_LOGIN" | "BUSINESS_RULE_REQUIRED";

const CATEGORY_LOGIN_POLICY: Record<string, CategoryLoginPolicy> = {
  A: "READY",
  E: "READY",
  X: "NO_LOGIN",
  R: "NO_LOGIN",
  U: "NO_LOGIN",
  F: "NO_LOGIN",
  V: "BUSINESS_RULE_REQUIRED",
  H: "BUSINESS_RULE_REQUIRED",
  T: "BUSINESS_RULE_REQUIRED",
};

export function classifyCategoryLoginPolicy(code: string): CategoryLoginPolicy {
  return CATEGORY_LOGIN_POLICY[code] ?? "BUSINESS_RULE_REQUIRED";
}

export function isLoginCandidate(code: string): boolean {
  return classifyCategoryLoginPolicy(code) === "READY";
}

export type ProvisioningDecision =
  | "CANDIDATE_ACTIVE"
  | "CANDIDATE_STUDENT"
  | "NO_LOGIN"
  | "BUSINESS_RULE_REQUIRED"
  | "CONFLICT"
  | "MANUAL_REVIEW";

export type ProvisioningInput = {
  linkStatus: "LINKED" | "UNLINKED" | "CONFLICT";
  categoryCode: string;
  hasEmail: boolean;
  categoryMismatch: boolean;
};

export function decideProvisioning(input: ProvisioningInput): ProvisioningDecision {
  if (input.linkStatus === "CONFLICT") return "CONFLICT";
  if (input.categoryMismatch) return "MANUAL_REVIEW";

  const policy = classifyCategoryLoginPolicy(input.categoryCode);
  if (policy === "NO_LOGIN") return "NO_LOGIN";
  if (policy === "BUSINESS_RULE_REQUIRED") return "BUSINESS_RULE_REQUIRED";

  if (input.linkStatus !== "LINKED") return "MANUAL_REVIEW";
  if (!input.hasEmail) return "MANUAL_REVIEW";

  return input.categoryCode === "A" ? "CANDIDATE_ACTIVE" : "CANDIDATE_STUDENT";
}
