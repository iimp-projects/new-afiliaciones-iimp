export class AssociatesApiError extends Error {
  constructor(
    message: string,
    readonly options: { httpStatus?: number; code?: string; identifier?: string; details?: string[]; retryable: boolean; operation: "LOGIN" | "CREATE_ASSOCIATE"; cause?: unknown },
  ) { super(message, { cause: options.cause }); this.name = "AssociatesApiError"; }
  get httpStatus() { return this.options.httpStatus; }
  get code() { return this.options.code; }
  get identifier() { return this.options.identifier; }
  get details() { return this.options.details; }
  get retryable() { return this.options.retryable; }
  get operation() { return this.options.operation; }
}
