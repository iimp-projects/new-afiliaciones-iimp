import { isValidEmail } from "./Import/EmailProcessing";
import { AssociateRecipientRepository } from "../Repositories/AssociateRecipientRepository";
import type {
  AssociateRecipientCandidate,
  AssociateRecipientMetadata,
  AssociateRecipientSelection,
  AssociateSourceFilter,
} from "../Models/AssociateRecipient";

const BATCH_SIZE = 500;

export class AssociateRecipientSourceService {
  constructor(private readonly repository = new AssociateRecipientRepository()) {}

  /**
   * Vista previa para la UI: primera página de elegibles + resumen de excluidos.
   * No materializa destinatarios.
   */
  async preview(filter: AssociateSourceFilter): Promise<AssociateRecipientSelection> {
    const [eligible, excluded] = await Promise.all([
      this.repository.listEligible(filter, 0, 50),
      this.repository.listExcluded(),
    ]);
    const valid = eligible.filter((item) => isValidEmail(item.correoAcceso));
    return {
      filter,
      eligible: valid,
      excluded: excluded.items,
      totalEligible: valid.length,
      totalExcluded: excluded.total,
    };
  }

  /**
   * Recolecta todos los asociados elegibles del filtro en lotes (consulta
   * paginada), deduplicados por cuenta (userId) y validando el correo de acceso.
   * Devuelve los snapshots listos para materializar en destinatarios de campaña.
   */
  async collectEligible(filter: AssociateSourceFilter): Promise<AssociateRecipientMetadata[]> {
    const total = await this.repository.countEligible(filter);
    const result: AssociateRecipientMetadata[] = [];
    const seen = new Set<number>();

    for (let skip = 0; skip < total; skip += BATCH_SIZE) {
      const page = await this.repository.listEligible(filter, skip, BATCH_SIZE);
      for (const candidate of page) {
        if (seen.has(candidate.userId)) continue;
        seen.add(candidate.userId);
        if (!isValidEmail(candidate.correoAcceso)) continue;
        result.push(this.toMetadata(candidate));
      }
    }

    return result;
  }

  private toMetadata(candidate: AssociateRecipientCandidate): AssociateRecipientMetadata {
    return {
      source: "associates",
      userId: candidate.userId,
      personId: candidate.personId,
      nombreCompleto: candidate.nombreCompleto,
      correoAcceso: candidate.correoAcceso,
      tipoAsociado: candidate.tipoAsociado,
      accountStatus: candidate.accountStatus,
      documentNumber: candidate.documentNumber,
    };
  }
}
