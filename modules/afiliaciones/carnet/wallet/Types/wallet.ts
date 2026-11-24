export type WalletProvider = "GOOGLE" | "APPLE";

export type WalletSyncStatus = "PENDING" | "SYNCED" | "FAILED" | "REVOKED";

export type WalletErrorCode =
  | "NOT_AUTHENTICATED"
  | "FORBIDDEN"
  | "INVALID_REQUEST"
  | "CARD_NOT_ISSUED"
  | "CARD_REVOKED"
  | "NOT_ELIGIBLE"
  | "PROVIDER_DISABLED"
  | "PROVIDER_NOT_CONFIGURED"
  | "PROVIDER_ERROR"
  | "NOT_FOUND"
  | "RATE_LIMITED"
  | "ORIGIN_REJECTED";

const STATUS_BY_CODE: Record<WalletErrorCode, number> = {
  NOT_AUTHENTICATED: 401,
  FORBIDDEN: 403,
  INVALID_REQUEST: 400,
  CARD_NOT_ISSUED: 409,
  CARD_REVOKED: 409,
  NOT_ELIGIBLE: 422,
  PROVIDER_DISABLED: 503,
  PROVIDER_NOT_CONFIGURED: 503,
  PROVIDER_ERROR: 502,
  NOT_FOUND: 404,
  RATE_LIMITED: 429,
  ORIGIN_REJECTED: 403,
};

export class WalletError extends Error {
  readonly code: WalletErrorCode;
  readonly status: number;
  readonly userMessage: string;

  constructor(code: WalletErrorCode, userMessage: string, options: { cause?: unknown } = {}) {
    super(userMessage, options);
    this.name = "WalletError";
    this.code = code;
    this.status = STATUS_BY_CODE[code];
    this.userMessage = userMessage;
  }
}

export interface WalletCardSnapshot {
  readonly personId: number;
  readonly cardId: string;
  readonly fullName: string;
  readonly associateCode: string;
  readonly membershipType: string;
  readonly membershipStatus: string;
  readonly issuedAt: string;
  readonly verificationUrl: string;
  readonly revoked: boolean;
}

export interface WalletJobSummary {
  readonly operation: "SYNC" | "REVOKE";
  readonly status: "PENDING" | "PROCESSING" | "COMPLETED" | "RETRY" | "FAILED" | "SUPERSEDED";
  readonly attemptCount: number;
  readonly maxAttempts: number;
  readonly nextAttemptAt: string | null;
  readonly lastErrorCode: string | null;
}

export interface WalletPassSummary {
  readonly provider: WalletProvider;
  readonly syncStatus: WalletSyncStatus;
  readonly lastSyncedAt: string | null;
  readonly lastErrorCode: string | null;
  readonly revokedAt: string | null;
  readonly deviceCount: number;
  readonly job: WalletJobSummary | null;
}

export interface WalletStatusDto {
  readonly enabled: { readonly google: boolean; readonly apple: boolean };
  readonly configured: { readonly google: boolean; readonly apple: boolean };
  readonly simulation: boolean;
  readonly card: { readonly generated: boolean; readonly status: "ISSUED" | "REVOKED" | null; readonly eligible: boolean };
  readonly passes: readonly WalletPassSummary[];
}

export interface WalletSimulationLinkDto {
  readonly link: string;
  readonly externalPassId: string;
  readonly provider: WalletProvider;
}

export interface GoogleWalletLinkDto {
  readonly link: string;
  readonly created: boolean;
  readonly objectId: string;
  readonly status: "LINK_READY";
}

export interface ApplePassResult {
  readonly buffer: Buffer;
  readonly fileName: string;
  readonly serialNumber: string;
}
