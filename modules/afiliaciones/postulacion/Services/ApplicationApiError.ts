export class ApplicationApiError extends Error {
  constructor(message: string, public readonly code: string, public readonly status: number, public readonly errors?: unknown) { super(message); }
  get functional() { return ["APPLICATION_NOT_EDITABLE", "ALREADY_SUBMITTED", "APPLICATION_EXISTS", "VERIFICATION_REQUIRED", "CORRECTION_INCOMPLETE"].includes(this.code); }
}
