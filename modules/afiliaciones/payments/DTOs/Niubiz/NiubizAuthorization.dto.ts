import type { NiubizDataMap } from "./NiubizSession.dto";

export interface NiubizAuthorizationPayload {
  captureType?: string;
  channel: "web";
  countable?: boolean;
  order: {
    amount: number;
    tokenId: string;
    purchaseNumber: string;
    currency: "PEN";
  };
  dataMap?: NiubizDataMap;
}

export interface NiubizAuthorizationRequest {
  url: string;
  method: "POST";
  headers: {
    "Content-Type": "application/json";
    Authorization: string;
  };
  body: NiubizAuthorizationPayload;
}

export interface NiubizAuthorizationResponse {
  STATUS?: string;
  transactionId?: string;
  errorCode?: string | number;
  errorMessage?: string;
  ACTION_CODE?: string;
  ACTION_DESCRIPTION?: string;
  TRANSACTION_DATE?: string;
  CARD?: string;
  BRAND?: string;
  authorizationCode?: string;
  order?: {
    transactionId?: string;
    transactionDate?: string;
    authorizationCode?: string;
    actionCode?: string;
    traceNumber?: string;
    purchaseNumber?: string;
    amount?: number;
    authorizedAmount?: number;
    currency?: string;
  };
  data?: {
    STATUS?: string;
    ACTION_CODE?: string;
    ACTION_DESCRIPTION?: string;
    TRANSACTION_DATE?: string;
    TRANSACTION_ID?: string;
    CARD?: string;
    BRAND?: string;
    CARD_TYPE?: string;
    TRACE_NUMBER?: string;
  };
  dataMap?: {
    STATUS?: string;
    ACTION_CODE?: string;
    ACTION_DESCRIPTION?: string;
    AUTHORIZATION_CODE?: string;
    TRANSACTION_DATE?: string;
    CARD?: string;
    BRAND?: string;
    CARD_TYPE?: string;
    TRACE_NUMBER?: string;
    TRANSACTION_ID?: string;
  };
  CARD_TYPE?: string;
}
