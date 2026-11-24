import Link from "next/link";
import { ArrowLeft, FlaskConical, ShieldCheck } from "lucide-react";
import { CardFace, type CardViewData, type CardViewState } from "@/modules/afiliaciones/carnet/Views/CardView";

export function WalletSimulationView({
  provider,
  data,
  card,
  verificationUrl,
}: {
  provider: "GOOGLE" | "APPLE";
  data: CardViewData;
  card: CardViewState;
  verificationUrl: string | null;
}) {
  const label = provider === "GOOGLE" ? "Google Wallet" : "Apple Wallet";
  return (
    <div className="mx-auto w-full max-w-3xl space-y-5 pb-8">
      <div className="rounded-[20px] border border-amber-200 bg-amber-50 p-4 sm:p-5" role="status">
        <div className="flex items-start gap-3">
          <FlaskConical size={22} className="mt-0.5 shrink-0 text-amber-700" aria-hidden="true" />
          <div>
            <p className="text-sm font-bold text-amber-900">Simulación local · {label}</p>
            <p className="mt-1 text-xs leading-5 text-amber-800">
              Esta vista previa es exclusivamente local. No es {label}, no envía datos a Google ni Apple y no instala un pase real.
            </p>
          </div>
        </div>
      </div>

      <header className="rounded-[22px] border border-slate-200 bg-white px-5 py-5 shadow-sm">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#a87924]">Vista previa de billetera</p>
        <h1 className="mt-1 text-xl font-semibold text-[#14233D] sm:text-2xl">Carné virtual IIMP</h1>
        <p className="mt-1 text-sm text-slate-500">Así se vería tu credencial dentro de {label} en este entorno local.</p>
      </header>

      <CardFace data={data} verificationUrl={verificationUrl} issuedAt={card.issuedAt} mode="issued" />

      <section className="rounded-[20px] border border-slate-200 bg-white p-5">
        <div className="flex items-center gap-2 text-sm font-semibold text-[#14233D]">
          <ShieldCheck size={18} className="text-emerald-600" aria-hidden="true" />
          Datos de la simulación
        </div>
        <dl className="mt-3 grid gap-3 text-xs sm:grid-cols-2">
          <div><dt className="font-semibold text-slate-400">Proveedor simulado</dt><dd className="mt-0.5 text-slate-700">{label} (local)</dd></div>
          <div><dt className="font-semibold text-slate-400">Estado</dt><dd className="mt-0.5 text-slate-700">Vista previa, no instalado</dd></div>
          <div><dt className="font-semibold text-slate-400">Asociado</dt><dd className="mt-0.5 text-slate-700">{data.name || "—"}</dd></div>
          <div><dt className="font-semibold text-slate-400">Código</dt><dd className="mt-0.5 text-slate-700">{data.code ?? "—"}</dd></div>
          <div className="sm:col-span-2"><dt className="font-semibold text-slate-400">Verificación</dt><dd className="mt-0.5 break-all text-slate-700">{verificationUrl ?? "QR aún no disponible"}</dd></div>
        </dl>
      </section>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Link href="/intranet/mi-cuenta/carnet" className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-[#a87924] px-5 text-sm font-semibold text-white hover:bg-[#8f661d]">
          <ArrowLeft size={18} aria-hidden="true" /> Volver a mi carné
        </Link>
        <Link href="/intranet/mi-cuenta/carnet/simulacion/apple" className="inline-flex min-h-12 flex-1 items-center justify-center rounded-xl border border-slate-200 bg-white px-5 text-sm font-semibold text-[#14233D] hover:bg-slate-50">
          Ver simulación Apple Wallet
        </Link>
        <Link href="/intranet/mi-cuenta/carnet/simulacion/google" className="inline-flex min-h-12 flex-1 items-center justify-center rounded-xl border border-slate-200 bg-white px-5 text-sm font-semibold text-[#14233D] hover:bg-slate-50">
          Ver simulación Google Wallet
        </Link>
      </div>
    </div>
  );
}
