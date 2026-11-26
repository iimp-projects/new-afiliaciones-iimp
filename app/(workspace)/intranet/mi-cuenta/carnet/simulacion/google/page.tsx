import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { getAppBaseUrl } from "@/lib/config/env";
import { getWalletSimulationEnabled } from "@/lib/config/wallet";
import { contextService } from "@/modules/auth/context/service";
import { getCard, resolveCardData } from "@/modules/afiliaciones/carnet/Services/cardData";
import { WalletSimulationView } from "@/modules/afiliaciones/carnet/wallet/Views/WalletSimulationView";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Simulación local · Google Wallet", robots: { index: false, follow: false } };

export default async function GoogleWalletSimulationPage() {
  if (!getWalletSimulationEnabled()) notFound();
  const user = await contextService.requireAffiliate();
  const account = await prisma.user.findUnique({ where: { id: user.id }, select: { personId: true } });
  if (!account?.personId) redirect("/intranet/mi-cuenta/carnet");
  const data = await resolveCardData(account.personId, undefined, { includePhoto: false });
  const card = await getCard(account.personId);
  if (data.notFound || !card.generated || card.status !== "ISSUED" || !data.eligible) {
    redirect("/intranet/mi-cuenta/carnet");
  }
  const baseUrl = getAppBaseUrl(process.env, { allowDevDefault: true });
  const verificationUrl = card.verificationToken ? `${baseUrl}/verificar-carnet/${card.verificationToken}` : null;
  return (
    <WalletSimulationView
      provider="GOOGLE"
      data={data}
      card={{
        generated: card.generated,
        status: card.status,
        verificationToken: card.verificationToken,
        issuedAt: card.issuedAt ? card.issuedAt.toISOString() : null,
        revokedAt: null,
        revokedReason: null,
      }}
      verificationUrl={verificationUrl}
    />
  );
}
