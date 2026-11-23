import { redirect } from "next/navigation";
import { contextService } from "@/modules/auth/context/service";
import { prisma } from "@/lib/prisma";
import { getCardIssuanceEnabled } from "@/lib/config/env";
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

  if (!account?.personId) {
    return <CardView data={null} card={null} issuanceEnabled={issuanceEnabled} />;
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
        revokedAt: card.revokedAt ? card.revokedAt.toISOString() : null,
        revokedReason: card.revokedReason,
      }}
      issuanceEnabled={issuanceEnabled}
    />
  );
}
