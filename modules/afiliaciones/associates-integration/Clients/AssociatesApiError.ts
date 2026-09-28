export class AssociatesApiError extends Error {
  constructor(
    message: string,
    readonly options: { httpStatus?: number; code?: string; identifier?: string; details?: string[]; retryable: boolean; operation: "LOGIN" | "CREATE_ASSOCIATE" | "GET_ASSOCIATE_STATE"; kind?: AssociatesApiErrorKind; cause?: unknown },
  ) { super(message, { cause: options.cause }); this.name = "AssociatesApiError"; }
  get httpStatus() { return this.options.httpStatus; }
  get code() { return this.options.code; }
  get identifier() { return this.options.identifier; }
  get details() { return this.options.details; }
  get retryable() { return this.options.retryable; }
  get operation() { return this.options.operation; }
  get kind(): AssociatesApiErrorKind { return this.options.kind ?? classifyKind(this.options.httpStatus); }
}

export type AssociatesApiErrorKind = "TIMEOUT" | "TRANSPORT_ERROR" | "HTTP_400" | "HTTP_401" | "HTTP_403" | "HTTP_409" | "HTTP_5XX" | "INVALID_RESPONSE";

function classifyKind(httpStatus?: number): AssociatesApiErrorKind {
  if (httpStatus === 400) return "HTTP_400";
  if (httpStatus === 401) return "HTTP_401";
  if (httpStatus === 403) return "HTTP_403";
  if (httpStatus === 409) return "HTTP_409";
  if (httpStatus !== undefined && httpStatus >= 500) return "HTTP_5XX";
  return "TRANSPORT_ERROR";
}
