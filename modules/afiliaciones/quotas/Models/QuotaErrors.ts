export type QuotaErrorCode =
  | "INVALID_DOCUMENT"
  | "INVALID_CONCEPT"
  | "INVALID_YEAR"
  | "INVALID_QUOTA_NUMBER"
  | "INVALID_AMOUNT"
  | "INVALID_CURRENCY"
  | "INVALID_ACCOUNTING_STATUS"
  | "INVALID_MEMBERSHIP_TYPE"
  | "INVALID_DATE"
  | "AMBIGUOUS_QUOTA_IDENTITY"
  | "PERSON_MISMATCH";

export class QuotaDomainError extends Error {
  constructor(
    readonly code: QuotaErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "QuotaDomainError";
  }
}
