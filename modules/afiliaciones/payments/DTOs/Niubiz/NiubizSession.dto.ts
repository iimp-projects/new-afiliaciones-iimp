export type NiubizDataValue = string | number | boolean;
export type NiubizDataMap = Record<string, NiubizDataValue>;

export interface NiubizSessionPayload {
  amount: number;
  channel: "web";
  antifraud: {
    clientIp?: string;
    merchantDefineData?: NiubizDataMap;
  };
  dataMap?: NiubizDataMap;
}

export interface NiubizSessionRequest {
  url: string;
  method: "POST";
  headers: {
    "Content-Type": "application/json";
    Authorization: string;
  };
  body: NiubizSessionPayload;
}

export interface NiubizSessionResponse {
  sessionKey: string;
}
