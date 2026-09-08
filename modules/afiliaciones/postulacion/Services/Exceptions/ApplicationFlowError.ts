export class ApplicationFlowError extends Error {
  constructor(public readonly code: "APPLICATION_NOT_EDITABLE" | "ALREADY_SUBMITTED" | "APPLICATION_EXISTS" | "VERIFICATION_REQUIRED" | "INVALID_INPUT" | "CORRECTION_INCOMPLETE", message: string, public readonly httpStatus = 409) { super(message); }
}
