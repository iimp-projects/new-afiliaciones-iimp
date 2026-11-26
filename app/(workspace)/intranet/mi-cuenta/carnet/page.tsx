import { redirect } from "next/navigation";
import { contextService } from "@/modules/auth/context/service";
import { prisma } from "@/lib/prisma";
import { getAppBaseUrl, getCardIssuanceEnabled } from "@/lib/config/env";
import { getWalletFlags, getWalletProviderMode } from "@/lib/config/wallet";
import { getCard, resolveCardData } from "@/modules/afiliaciones/carnet/Services/cardData";
import { CardView } from "@/modules/afiliaciones/carnet/Views/CardView";
import { AssociateProfileService } from "@/modules/afiliaciones/portal/Services/AssociateProfileService";
import { findMissingProfileData, toProfileCompletenessSource } from "@/modules/afiliaciones/portal/Rules/ProfileCompletenessRules";

export const dynamic = "force-dynamic";

export default async function CarnetPage() {
  const user = await contextService.requireAffiliate();
  const profile = await new AssociateProfileService().getForUser(user.id);
  if (!profile || findMissingProfileData(toProfileCompletenessSource(profile)).length > 0) {
    redirect("/intranet/mi-cuenta/perfil?editar=1");
  }
  const account = await prisma.user.findUnique({ where: { id: user.id }, select: { personId: true } });
  const issuanceEnabled = getCardIssuanceEnabled();
  const flags = getWalletFlags();
  const googleMode = getWalletProviderMode("GOOGLE");
  const appleMode = getWalletProviderMode("APPLE");
  const wallet = {
    googleEnabled: flags.googleEnabled || googleMode === "SIMULATION",
    appleEnabled: flags.appleEnabled || appleMode === "SIMULATION",
    googleSimulation: googleMode === "SIMULATION",
    appleSimulation: appleMode === "SIMULATION",
  };
  const verificationBaseUrl = getAppBaseUrl(process.env, { allowDevDefault: true });

  if (!account?.personId) {
    return <CardView data={null} card={null} issuanceEnabled={issuanceEnabled} verificationBaseUrl={verificationBaseUrl} wallet={wallet} />;
  }

  const data = await resolveCardData(account.personId);
  const card = await getCard(account.personId);

  return (
    <CardView
      data={data}
      card={{
        generated: card.generated,
        status: card.status,
        verificationToken: card.verificationToken,
        issuedAt: card.issuedAt ? card.issuedAt.toISOString() : null,
        revokedAt: card.revokedAt ? card.revokedAt.toISOString() : null,
        revokedReason: card.revokedReason,
      }}
      issuanceEnabled={issuanceEnabled}
      verificationBaseUrl={verificationBaseUrl}
      wallet={wallet}
    />
  );
}
