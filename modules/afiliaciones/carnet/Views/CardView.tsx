"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import { BadgeCheck, Download, ShieldAlert, UserRound } from "lucide-react";

export type CardViewData = {
  firstName: string;
  paternalLastName: string;
  maternalLastName: string | null;
  name: string;
  code: string | null;
  category: string | null;
  photoUrl: string | null;
  source: "NEW" | "MIGRATED" | null;
  eligible: boolean;
  reason: string | null;
  notFound: boolean;
};

export type CardViewState = {
  generated: boolean;
  status: "ISSUED" | "REVOKED" | null;
  verificationToken: string | null;
  revokedAt: string | null;
  revokedReason: string | null;
};

function useQr(url: string | null): string | null {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    QRCode.toDataURL(url, { width: 320, margin: 1, errorCorrectionLevel: "H" })
      .then((value) => {
        if (!cancelled) setDataUrl(value);
      })
      .catch(() => {
        if (!cancelled) setDataUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [url]);
  return dataUrl;
}

export function CardFace({
  data,
  verificationUrl,
}: {
  data: CardViewData;
  verificationUrl: string | null;
}) {
  const qr = useQr(verificationUrl);

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="h-2 w-full bg-[#C5A059]" />
      <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-start">
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
            {data.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={data.photoUrl} alt={`Fotografía de ${data.name}`} className="h-full w-full object-cover" />
            ) : (
              <UserRound size={32} className="text-slate-300" />
            )}
          </div>
          <span className="rounded-full bg-[#F8F1E4] px-3 py-1 text-xs font-bold text-[#936B2E]">
            {data.category ?? "Categoría no disponible"}
          </span>
        </div>

        <div className="min-w-0 flex-1 space-y-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Nombre completo</p>
            <p className="truncate text-base font-black text-slate-800">{data.name || "—"}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Código de asociado</p>
              <p className="text-sm font-bold text-slate-700">{data.code ?? "Pendiente de sincronización SIE"}</p>
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Estado</p>
              <span className="inline-flex items-center gap-1 text-sm font-bold text-emerald-700">
                <BadgeCheck size={15} /> Credencial emitida
              </span>
            </div>
          </div>
          <p className="text-xs text-slate-400">Vigencia institucional no confirmada.</p>
        </div>

        <div className="flex flex-col items-center gap-2 self-center">
          {qr ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qr} alt="Código QR de verificación" className="h-28 w-28 rounded-lg border border-slate-200" />
          ) : (
            <div className="flex h-28 w-28 items-center justify-center rounded-lg border border-dashed border-slate-200 text-slate-300">QR</div>
          )}
          <p className="max-w-[112px] text-center text-[10px] leading-tight text-slate-400">Escanear para verificar</p>
        </div>
      </div>
    </div>
  );
}

export function CardView({ data, card }: { data: CardViewData | null; card: CardViewState | null }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/afiliaciones/carnet/me", { method: "POST" });
      const body = await response.json();
      if (!response.ok || !body.success) {
        setError(body.message || "No fue posible generar el carnet.");
        return;
      }
      router.refresh();
    } catch {
      setError("No fue posible generar el carnet.");
    } finally {
      setLoading(false);
    }
  }, [router]);

  if (!data) {
    return <EmptyNotice title="Mi carnet virtual" description="No se encontró la información de tu cuenta." />;
  }

  if (data.notFound) {
    return <EmptyNotice title="Mi carnet virtual" description="No se encontró una persona vinculada a tu cuenta." />;
  }

  const issued = card?.generated && card.status === "ISSUED";
  const revoked = card?.generated && card.status === "REVOKED";
  const verificationUrl = issued && card.verificationToken
    ? `${window.location.origin}/verificar-carnet/${card.verificationToken}`
    : null;

  return (
    <div className="w-full space-y-5">
      <header>
        <p className="text-sm font-bold text-[#A67C00]">Mi cuenta</p>
        <h1 className="mt-1 text-3xl font-black tracking-tight text-slate-900">Mi carnet virtual</h1>
        <p className="mt-1 text-sm text-slate-500">Credencial institucional del IIMP.</p>
      </header>

      {issued ? (
        <>
          <CardFace data={data} verificationUrl={verificationUrl} />
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- descarga de PDF desde API route */}
          <a
            href="/api/afiliaciones/carnet/me/download"
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#B8892D] px-4 text-sm font-bold text-white shadow-sm transition hover:bg-[#9E7425]"
          >
            <Download size={16} /> Descargar PDF
          </a>
        </>
      ) : revoked ? (
        <section className="flex flex-col items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-6">
          <div className="flex items-center gap-2 text-red-700">
            <ShieldAlert size={18} />
            <h2 className="font-black">Credencial revocada</h2>
          </div>
          <p className="text-sm text-red-700">{card.revokedReason || "Esta credencial fue revocada."}</p>
          <p className="text-xs text-red-400">Contacta al área de Asociados para más información.</p>
        </section>
      ) : data.eligible ? (
        <section className="flex flex-col items-start gap-3 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="space-y-1">
            <h2 className="font-black text-slate-800">{data.name}</h2>
            <p className="text-sm text-slate-500">Código: {data.code ?? "Pendiente de sincronización SIE"}</p>
            <p className="text-sm text-slate-500">Categoría: {data.category ?? "No disponible"}</p>
          </div>
          <button
            type="button"
            onClick={generate}
            disabled={loading}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#B8892D] px-4 text-sm font-bold text-white shadow-sm transition hover:bg-[#9E7425] disabled:opacity-60"
          >
            {loading ? "Generando…" : "Generar mi carnet"}
          </button>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </section>
      ) : (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
          <h2 className="font-black text-amber-900">Carnet no disponible</h2>
          <p className="mt-2 text-sm leading-6 text-amber-800">{data.reason ?? "No se puede generar el carnet en este momento."}</p>
        </section>
      )}
    </div>
  );
}

function EmptyNotice({ title, description }: { title: string; description: string }) {
  return (
    <div className="w-full space-y-5">
      <header>
        <p className="text-sm font-bold text-[#A67C00]">Mi cuenta</p>
        <h1 className="mt-1 text-3xl font-black tracking-tight text-slate-900">{title}</h1>
      </header>
      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-10 text-center">
        <p className="text-sm text-slate-500">{description}</p>
      </div>
    </div>
  );
}
