"use client";
/* eslint-disable react-hooks/set-state-in-effect -- la preferencia depende de APIs del navegador y se resuelve tras hidratar. */

import { useEffect, useRef, useState } from "react";
import { AlertCircle, BadgeCheck, Crown, Sparkles } from "lucide-react";
import { Spinner } from "@/modules/afiliaciones/carnet/Views/Spinner";

function GoogleLogo({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" className={className}>
      <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303C33.654 32.657 29.223 36 24 36c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z" />
      <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z" />
      <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z" />
      <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571l6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z" />
    </svg>
  );
}

function AppleLogo({ className = "h-7 w-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor" className={className}>
      <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701" />
    </svg>
  );
}

type Busy = "google" | "apple" | null;

interface WalletButtonsProps {
  readonly googleEnabled: boolean;
  readonly appleEnabled: boolean;
  readonly googleSimulation?: boolean;
  readonly appleSimulation?: boolean;
  readonly simulation?: boolean;
}

function preferredProvider(): "google" | "apple" | null {
  if (typeof navigator === "undefined") return null;
  const userAgent = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(userAgent)) return "apple";
  if (/Android/i.test(userAgent)) return "google";
  return null;
}

function triggerBlobDownload(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.rel = "noopener";
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export function WalletButtons({ googleEnabled, appleEnabled, googleSimulation, appleSimulation, simulation = false }: WalletButtonsProps) {
  const googleSim = googleSimulation ?? simulation;
  const appleSim = appleSimulation ?? simulation;
  const [busy, setBusy] = useState<Busy>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [preferred, setPreferred] = useState<"google" | "apple" | null>(null);
  const busyRef = useRef(false);
  useEffect(() => setPreferred(preferredProvider()), []);

  function acquire(provider: "google" | "apple"): boolean {
    if (busyRef.current) return false;
    busyRef.current = true;
    setBusy(provider);
    return true;
  }

  function release(): void {
    busyRef.current = false;
    setBusy(null);
  }

  async function addToGoogle(): Promise<void> {
    if (!acquire("google")) return;
    setMessage(null);
    try {
      const response = await fetch("/api/afiliaciones/carnet/wallet/google", {
        method: "POST",
        signal: AbortSignal.timeout(25_000),
      });
      const body = (await response.json().catch(() => null)) as { success?: boolean; message?: string; data?: { link?: string } } | null;
      if (!response.ok || !body?.success || !body.data?.link) {
        setMessage(body?.message ?? "No pudimos agregar tu carné a Google Wallet. Inténtalo nuevamente.");
        release();
        return;
      }
      window.location.assign(body.data.link);
    } catch (error) {
      const timedOut = error instanceof Error && error.name === "TimeoutError";
      setMessage(timedOut
        ? "La operación tardó demasiado. Revisa tu conexión e inténtalo nuevamente."
        : "No pudimos conectar con Google Wallet. Revisa tu conexión e inténtalo nuevamente.");
      release();
    }
  }

  async function addToApple(): Promise<void> {
    if (!acquire("apple")) return;
    setMessage(null);
    try {
      const response = await fetch("/api/afiliaciones/carnet/wallet/apple", {
        headers: { accept: appleSim ? "application/json" : "application/vnd.apple.pkpass" },
        signal: AbortSignal.timeout(25_000),
      });
      if (appleSim) {
        const body = (await response.json().catch(() => null)) as { success?: boolean; message?: string; data?: { link?: string } } | null;
        if (!response.ok || !body?.success || !body.data?.link) {
          setMessage(body?.message ?? "No pudimos abrir la simulación local de Apple Wallet.");
          release();
          return;
        }
        window.location.assign(body.data.link);
        return;
      }
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { message?: string } | null;
        setMessage(body?.message ?? "No pudimos generar tu pase de Apple Wallet. Inténtalo nuevamente.");
        release();
        return;
      }
      triggerBlobDownload(await response.blob(), "carne-virtual-iimp.pkpass");
      setMessage("Generamos tu pase. Si el archivo no se abrió, ábrelo desde Descargas para agregarlo a Wallet.");
      release();
    } catch (error) {
      const timedOut = error instanceof Error && error.name === "TimeoutError";
      setMessage(timedOut
        ? "La operación tardó demasiado. Revisa tu conexión e inténtalo nuevamente."
        : "No pudimos generar tu pase de Apple Wallet. Revisa tu conexión e inténtalo nuevamente.");
      release();
    }
  }

  const buttons: Array<{ provider: "google" | "apple"; enabled: boolean; label: string; busyLabel: string }> = [
    { provider: "google", enabled: googleEnabled, label: "Agregar a Google Wallet", busyLabel: "Conectando con Google Wallet…" },
    { provider: "apple", enabled: appleEnabled, label: "Agregar a Apple Wallet", busyLabel: appleSim ? "Abriendo simulación…" : "Generando tu pase…" },
  ];
  const ordered = preferred ? [...buttons.filter((button) => button.provider === preferred), ...buttons.filter((button) => button.provider !== preferred)] : buttons;

  return (
    <div className="relative mt-6 overflow-hidden rounded-[22px] border border-[#e7cf9a] bg-[linear-gradient(135deg,#fffdf8_0%,#fff8e8_46%,#f5e8cd_100%)] p-4 shadow-[0_26px_55px_-46px_rgba(138,101,31,0.9)] sm:p-6">
      <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-20 h-48 w-48 rounded-full bg-[radial-gradient(circle,rgba(197,149,62,0.34),transparent_68%)]" />
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#c5953e] to-transparent" />
      <span className="absolute right-4 top-4 hidden items-center gap-1 rounded-full border border-[#e7cf9a] bg-white/75 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.18em] text-[#8a651f] shadow-sm backdrop-blur sm:inline-flex">
        <Sparkles size={10} aria-hidden="true" /> Acceso exclusivo
      </span>

      <div className="relative flex items-start gap-3 sm:pr-24">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[linear-gradient(145deg,#f9e6b0_0%,#d6ab55_46%,#9c7526_100%)] text-[#3a2a0c] shadow-[inset_0_1px_0_rgba(255,255,255,0.75),0_12px_20px_-16px_rgba(138,101,31,0.95)]">
          <Crown size={22} aria-hidden="true" />
        </span>
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold tracking-[-0.01em] text-[#14233D] sm:text-lg">Lleva tu carné siempre contigo</h2>
            <span className="inline-flex items-center gap-1 rounded-full bg-[#14233D] px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.16em] text-[#f3d99b] shadow-sm ring-1 ring-[#c5953e]/60">
              <Sparkles size={10} aria-hidden="true" /> Beneficio exclusivo
            </span>
          </div>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            Agrega tu carné a la billetera de tu celular y ábrelo cuando lo necesites, sin volver a iniciar sesión en el portal.
            Este beneficio está disponible solo para asociados con membresía habilitada y carné virtual vigente.
          </p>
          <p className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-white/75 px-2.5 py-1 text-[10px] font-semibold text-[#8a651f] ring-1 ring-[#e7cf9a]">
            <BadgeCheck size={12} aria-hidden="true" /> Se habilita automáticamente con tu carné vigente
          </p>
        </div>
      </div>

      <div className="relative mt-4 grid gap-3 sm:grid-cols-2">
        {ordered.filter((button) => button.enabled).map((button) => {
          const isApple = button.provider === "apple";
          const isBusy = busy === button.provider;
          return (
            <button
              key={button.provider}
              type="button"
              onClick={() => { if (isApple) void addToApple(); else void addToGoogle(); }}
              disabled={busy !== null}
              aria-busy={isBusy}
              aria-label={isApple ? "Agregar a Apple Wallet" : "Agregar a Google Wallet"}
              className={`relative inline-flex min-h-[52px] items-center justify-center gap-2 overflow-hidden rounded-xl border px-4 text-sm font-semibold shadow-sm transition duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed ${isApple ? "wallet-apple text-white focus-visible:outline-[#7aa2ff]" : "wallet-silver text-[#1f2937] focus-visible:outline-[#94a3b8]"} ${busy !== null && !isBusy ? "opacity-40" : ""}`}
            >
              {isBusy ? (
                <span className="relative z-[1] flex items-center gap-3 px-1">
                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${isApple ? "bg-white/15 text-white" : "bg-white/85 text-[#334155] shadow-sm"}`}>
                    <Spinner className="h-4 w-4" />
                  </span>
                  <span className="flex flex-col items-start text-left leading-tight">
                    <span className={`text-sm font-semibold ${isApple ? "text-white" : "text-[#1f2937]"}`}>{button.busyLabel}</span>
                    <span className={`text-[10px] font-medium uppercase tracking-[0.14em] ${isApple ? "text-white/60" : "text-slate-500"}`}>No cierres esta ventana</span>
                  </span>
                </span>
              ) : isApple ? (
                <span className="relative z-[1] inline-flex items-center justify-center gap-2.5 py-1.5">
                  <AppleLogo className="h-7 w-7 -translate-y-[1px]" />
                  <span className="flex flex-col items-start leading-[1.05]">
                    <span className="text-[9px] font-medium uppercase tracking-[0.22em] text-white/70">Agregar a</span>
                    <span className="text-[15px] font-semibold tracking-[-0.01em] text-white">Apple Wallet</span>
                  </span>
                </span>
              ) : (
                <span className="relative z-[1] inline-flex items-center justify-center gap-2.5 py-1.5">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-[0_1px_3px_rgba(15,23,42,0.16)]">
                    <GoogleLogo className="h-5 w-5" />
                  </span>
                  <span className="flex flex-col items-start leading-[1.05]">
                    <span className="text-[9px] font-medium uppercase tracking-[0.22em] text-slate-500">Agregar a</span>
                    <span className="text-[15px] font-semibold tracking-[-0.01em] text-[#1f2937]">Google Wallet</span>
                  </span>
                </span>
              )}
              {isBusy && (
                <span aria-hidden="true" className={`pointer-events-none absolute inset-x-3 bottom-1 h-0.5 overflow-hidden rounded-full ${isApple ? "bg-white/20" : "bg-slate-300/70"}`}>
                  <span className={`block h-full w-1/2 rounded-full motion-safe:animate-pulse ${isApple ? "bg-white" : "bg-slate-700"}`} />
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div aria-live="polite" aria-atomic="true">
        {busy && (
          <p role="status" className="mt-3 flex items-center gap-2 text-xs font-semibold text-[#8a651f]">
            <Spinner className="h-3.5 w-3.5" />
            {busy === "google"
              ? "Estamos preparando tu enlace de Google Wallet. Esto puede tardar unos segundos."
              : appleSim
                ? "Estamos abriendo la vista previa local de Apple Wallet."
                : "Estamos generando tu pase de Apple Wallet. Esto puede tardar unos segundos."}
          </p>
        )}
      </div>

      {!googleEnabled && !appleEnabled && (
        <p className="mt-3 text-xs leading-5 text-slate-500">Las billeteras digitales aún no están habilitadas para tu carné.</p>
      )}
      <p className="mt-3 text-xs leading-5 text-slate-500">
        La vigencia de tu membresía se confirma siempre al verificar el código QR del carné.
      </p>
      {!googleSim && googleEnabled && (
        <p role="status" className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold leading-5 text-emerald-800">
          Google Wallet · Prueba real: el carné se agrega a tu billetera de Google con datos de prueba del entorno local.
        </p>
      )}
      {googleSim && (
        <p role="status" className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs font-semibold leading-5 text-amber-800">
          Google Wallet · Simulación local: no envía datos a Google ni instala pases reales.
        </p>
      )}
      {appleSim && (
        <p role="status" className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs font-semibold leading-5 text-amber-800">
          Apple Wallet · Simulación local: no envía datos a Apple ni instala pases reales.
        </p>
      )}
      {message && (
        <p role="status" className="mt-3 flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs leading-5 text-slate-600">
          <AlertCircle size={15} className="mt-0.5 shrink-0 text-[#a87924]" aria-hidden="true" />
          {message}
        </p>
      )}
    </div>
  );
}
