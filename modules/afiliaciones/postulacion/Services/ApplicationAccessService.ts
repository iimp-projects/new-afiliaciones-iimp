import { ApplicationLookupRepository } from "../Repositories/ApplicationLookupRepository";
import { queryAuthorization } from "@/modules/afiliaciones/consulta/Services/QueryAuthorizationService";
import { ApplicationFlowError } from "./Exceptions/ApplicationFlowError";
import { applicationStates, blocksNewApplication, currentApplicationStates, type AuthorizedApplicationSummary } from "../Models/ApplicationAction";
import type { VerificationChannel } from "@/modules/shared/Models/Verification";

export class ApplicationAccessService {
  private readonly repository = new ApplicationLookupRepository();
  require(applicationId: number, token?: string) {
    if (!queryAuthorization.allowedIds(token).includes(applicationId)) throw new ApplicationFlowError("VERIFICATION_REQUIRED", "Verifica tu identidad para acceder a esta solicitud.", 401);
  }
  async grantVerified(applicationId: number, proof: { channel: VerificationChannel; destination: string }) {
    const app = await this.repository.findById(applicationId);
    if (!app) throw new ApplicationFlowError("VERIFICATION_REQUIRED", "La solicitud no está disponible.", 401);
    const candidates = await this.repository.find(app.documentType, app.documentNumber);
    // Only the destination actually verified in VerificationCode authorizes siblings.
    const normalize = (value: string) => proof.channel === "EMAIL" ? value.trim().toLowerCase() : value.trim();
    const ids = candidates.filter(candidate => normalize(proof.channel === "EMAIL" ? candidate.email : candidate.phone) === normalize(proof.destination)).map(candidate => candidate.id);
    if (!ids.includes(applicationId)) throw new ApplicationFlowError("VERIFICATION_REQUIRED", "El contacto registrado cambió. Verifica tu identidad nuevamente.", 401);
    return queryAuthorization.createAccess(ids, applicationId);
  }
  async list(token?: string): Promise<AuthorizedApplicationSummary[]> {
    const ids = queryAuthorization.allowedIds(token);
    if (!ids.length) throw new ApplicationFlowError("VERIFICATION_REQUIRED", "Verifica tu identidad para consultar tus solicitudes.", 401);
    const apps = await this.repository.findByIds(ids);
    const result = await Promise.all(apps.map(async app => {
      const related = await this.repository.find(app.documentType, app.documentNumber, app.affiliateType);
      if (!applicationStates.some(status => status === app.status)) console.error("[ApplicationAccess] Unknown application state", { id: app.id, status: app.status });
      const canStartNew = app.status === "REJECTED" && !related.some(other => blocksNewApplication(other.status)) && !await this.repository.isAffiliate(app.documentType, app.documentNumber);
      return { id: app.id, affiliateType: app.affiliateType, status: app.status, createdAt: app.createdAt.toISOString(), canStartNew, recoveryUrl: app.status === "DRAFT" ? `/postulacion/${app.affiliateType === "STUDENT" ? "estudiante" : "asociado"}?trackingCode=${encodeURIComponent(app.trackingCode)}` : null };
    }));
    // Active requests first; all authorized records remain selectable.
    return result.sort((a, b) => Number(currentApplicationStates.some(status => status === b.status)) - Number(currentApplicationStates.some(status => status === a.status)));
  }
}
