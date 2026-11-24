import { getAppBaseUrl } from "@/lib/config/env";
import { getCardRecord, resolveCardData, type CardData, type CardRecord } from "@/modules/afiliaciones/carnet/Services/cardData";
import { WalletError, type WalletCardSnapshot } from "../Types/wallet";
import { cardVerificationUrl } from "./walletIdentity";

export interface WalletCardState {
  readonly card: CardRecord;
  readonly data: CardData & { eligible: boolean; reason: string | null; pendingQuotaCount?: number };
  readonly eligible: boolean;
  readonly snapshot: WalletCardSnapshot;
}

/**
 * Reutiliza las reglas institucionales existentes (elegibilidad, emisión y
 * revocación). No crea ni regenera carnés: solo proyecta el estado actual.
 */
export async function loadWalletCard(
  personId: number,
  options: { allowRevoked?: boolean; allowIneligible?: boolean } = {},
): Promise<WalletCardState> {
  const card = await getCardRecord(personId);
  if (!card) {
    throw new WalletError("CARD_NOT_ISSUED", "Aún no tienes un carné virtual emitido.");
  }
  const revoked = card.status === "REVOKED";
  if (revoked && !options.allowRevoked) {
    throw new WalletError("CARD_REVOKED", "Tu carné virtual fue revocado. Comunícate con el área de Asociados.");
  }

  const data = await resolveCardData(personId, undefined, { includePhoto: false });
  if (data.notFound) throw new WalletError("NOT_FOUND", "No encontramos tu información de asociado.");
  if (!data.eligible && !options.allowIneligible) {
    throw new WalletError("NOT_ELIGIBLE", data.reason ?? "Tu membresía no está habilitada para usar el carné virtual.");
  }

  const appBaseUrl = getAppBaseUrl(process.env, { allowDevDefault: true });
  const associateCode = data.code ?? `A-${personId}`;
  const snapshot: WalletCardSnapshot = {
    personId,
    cardId: card.id,
    fullName: data.name || "Asociado IIMP",
    associateCode,
    membershipType: data.category ?? "Asociado IIMP",
    membershipStatus: revoked ? "Revocado" : data.eligible ? "Vigente" : "Restringida",
    issuedAt: new Intl.DateTimeFormat("es-PE", { day: "2-digit", month: "2-digit", year: "numeric" }).format(card.issuedAt),
    verificationUrl: cardVerificationUrl(appBaseUrl, card.verificationToken),
    revoked,
  };

  return { card, data, eligible: data.eligible, snapshot };
}
