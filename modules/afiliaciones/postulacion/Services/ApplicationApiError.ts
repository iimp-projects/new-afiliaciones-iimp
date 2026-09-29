export class ApplicationApiError extends Error {
  constructor(message: string, public readonly code: string, public readonly status: number, public readonly errors?: unknown, public readonly retryAfterSeconds?: number) { super(message); }
  get functional() { return ["APPLICATION_NOT_EDITABLE", "ALREADY_SUBMITTED", "APPLICATION_EXISTS", "VERIFICATION_REQUIRED", "CORRECTION_INCOMPLETE", "APPLICATION_ACCESS_EXPIRED"].includes(this.code); }
}
