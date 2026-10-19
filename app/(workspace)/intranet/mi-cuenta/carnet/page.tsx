import { contextService } from "@/modules/auth/context/service";
import { prisma } from "@/lib/prisma";
import { getCardIssuanceEnabled } from "@/lib/config/env";
import { getCard, resolveCardData } from "@/modules/afiliaciones/carnet/Services/cardData";
import { CardView } from "@/modules/afiliaciones/carnet/Views/CardView";

export const dynamic = "force-dynamic";

export default async function CarnetPage() {
  const user = await contextService.requireAffiliate();
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
