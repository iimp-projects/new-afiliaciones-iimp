import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { verificationTokenRateLimiter } from "@/modules/auth/rate-limit/VerificationTokenRateLimiter";
import { resolveCardData } from "@/modules/afiliaciones/carnet/Services/cardData";
import { BadgeCheck, ShieldX } from "lucide-react";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Verificar carnet | IIMP",
  robots: { index: false, follow: false },
};

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{16,64}$/;

function publicName(firstName: string, paternalLastName: string): string {
  const initial = paternalLastName?.charAt(0)?.toUpperCase();
  const base = firstName?.trim() || "Asociado";
  return initial ? `${base} ${initial}.` : base;
}

export default async function VerifyCardPage({ params }: { params: Promise<{ token: string }> }) {
  const token = (await params).token;
  if (!TOKEN_PATTERN.test(token)) notFound();

  const ip =
    (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ||
    (await headers()).get("x-real-ip") ||
    "unknown";
  const allowed = await verificationTokenRateLimiter.consume("verify-carnet", ip, 30, 15);
  if (!allowed) notFound();

  const card = await prisma.associateCard.findUnique({ where: { verificationToken: token } });
  if (!card) notFound();

  const revoked = card.status === "REVOKED";

  if (revoked) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
        <section className="w-full max-w-md rounded-2xl border border-red-200 bg-white p-8 text-center shadow-sm">
          <ShieldX size={40} className="mx-auto text-red-500" />
          <h1 className="mt-4 text-xl font-black text-slate-900">Credencial revocada</h1>
          <p className="mt-2 text-sm text-slate-500">Esta credencial ya no es válida.</p>
        </section>
      </main>
    );
  }

  const data = await resolveCardData(card.personId);

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50">
          <BadgeCheck size={28} className="text-emerald-600" />
        </div>
        <h1 className="mt-4 text-xl font-black text-slate-900">Credencial auténtica</h1>
        <p className="mt-1 text-sm text-slate-500">{publicName(data.firstName, data.paternalLastName)}</p>
        <p className="mt-1 text-sm font-semibold text-slate-700">{data.category ?? "Asociado IIMP"}</p>
        <div className="mt-6 rounded-xl border border-slate-100 bg-slate-50 p-4 text-xs leading-5 text-slate-500">
          Credencial auténtica. Vigencia institucional no confirmada.
        </div>
      </section>
    </main>
  );
}
