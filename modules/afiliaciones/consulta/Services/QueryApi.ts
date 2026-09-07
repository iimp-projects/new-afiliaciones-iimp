import type { ConsultationQuery } from "../Models/ApplicationStatus";
import type { VerificationChannel } from "@/modules/shared/Models/Verification";
import type { ValidationResponseDTO } from "@/modules/afiliaciones/postulacion/DTOs/validation-response.dto";
import type { AuthorizedApplicationSummary } from "@/modules/afiliaciones/postulacion/Models/ApplicationAction";

export type QueryChallenge = ValidationResponseDTO;
async function request(url: string, body?: unknown) {
  const response = await fetch(url, { method: body ? "POST" : "GET", credentials: "same-origin", cache: "no-store", ...(body ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || data.error || "No se pudo procesar la consulta.");
  return data;
}
export const queryApi = {
  lookup: (query: ConsultationQuery): Promise<QueryChallenge> => request("/api/consulta/verification", query),
  send: (context: string, channel: VerificationChannel) => request("/api/afiliaciones/postulacion/send-otp", { purpose: "APPLICATION_QUERY", context, channel }),
  verify: (context: string, code: string) => request("/api/afiliaciones/postulacion/verify-otp", { purpose: "APPLICATION_QUERY", context, code }),
  applications: (): Promise<AuthorizedApplicationSummary[]> => request("/api/consulta/applications"),
  detail: (applicationId?: number) => request(`/api/consulta${applicationId ? `?applicationId=${applicationId}` : ""}`),
};
