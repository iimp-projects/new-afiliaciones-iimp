export interface NiubizSecurityRequest {
  url: string;
  method: "GET";
  headers: {
    Authorization: string;
  };
}
