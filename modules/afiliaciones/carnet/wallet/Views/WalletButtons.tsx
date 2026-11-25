"use client";
/* eslint-disable react-hooks/set-state-in-effect -- la preferencia depende de APIs del navegador y se resuelve tras hidratar. */

import { useEffect, useState } from "react";
import { AlertCircle, Smartphone, Wallet } from "lucide-react";

type Busy = "google" | "apple" | null;

interface WalletButtonsProps {
  readonly googleEnabled: boolean;
  readonly appleEnabled: boolean;
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

export function WalletButtons({ googleEnabled, appleEnabled, simulation = false }: WalletButtonsProps) {
  const [busy, setBusy] = useState<Busy>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [preferred, setPreferred] = useState<"google" | "apple" | null>(null);
  useEffect(() => setPreferred(preferredProvider()), []);

  async function addToGoogle(): Promise<void> {
    if (busy) return;
    setBusy("google");
    setMessage(null);
    try {
      const response = await fetch("/api/afiliaciones/carnet/wallet/google", { method: "POST" });
      const body = (await response.json().catch(() => null)) as { success?: boolean; message?: string; data?: { link?: string } } | null;
      if (!response.ok || !body?.success || !body.data?.link) {
        setMessage(body?.message ?? "No pudimos agregar tu carné a Google Wallet. Inténtalo nuevamente.");
        return;
      }
      window.location.assign(body.data.link);
      setMessage("Abrimos Google Wallet para que confirmes la incorporación del carné.");
    } catch {
      setMessage("No pudimos conectar con Google Wallet. Revisa tu conexión e inténtalo nuevamente.");
    } finally {
      setBusy(null);
    }
  }

  async function addToApple(): Promise<void> {
    if (busy) return;
    setBusy("apple");
    setMessage(null);
    try {
      const response = await fetch("/api/afiliaciones/carnet/wallet/apple", {
        headers: { accept: simulation ? "application/json" : "application/vnd.apple.pkpass" },
      });
      if (simulation) {
        const body = (await response.json().catch(() => null)) as { success?: boolean; message?: string; data?: { link?: string } } | null;
        if (!response.ok || !body?.success || !body.data?.link) {
          setMessage(body?.message ?? "No pudimos abrir la simulación local de Apple Wallet.");
          return;
        }
        window.location.assign(body.data.link);
        return;
      }
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { message?: string } | null;
        setMessage(body?.message ?? "No pudimos generar tu pase de Apple Wallet. Inténtalo nuevamente.");
        return;
      }
      triggerBlobDownload(await response.blob(), "carne-virtual-iimp.pkpass");
      setMessage("Generamos tu pase. Si el archivo no se abrió, ábrelo desde Descargas para agregarlo a Wallet.");
    } catch {
      setMessage("No pudimos generar tu pase de Apple Wallet. Revisa tu conexión e inténtalo nuevamente.");
    } finally {
      setBusy(null);
    }
  }

  const buttons: Array<{ provider: "google" | "apple"; enabled: boolean; render: () => void; label: string; busyLabel: string }> = [
    { provider: "google", enabled: googleEnabled, render: () => void addToGoogle(), label: "Agregar a Google Wallet", busyLabel: "Preparando pase…" },
    { provider: "apple", enabled: appleEnabled, render: () => void addToApple(), label: "Agregar a Apple Wallet", busyLabel: "Generando pase…" },
  ];
  const ordered = preferred ? [...buttons.filter((button) => button.provider === preferred), ...buttons.filter((button) => button.provider !== preferred)] : buttons;

  return (
    <div className="mt-6 border-t border-slate-100 pt-5">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#f8f1e3] text-[#a87924]">
          <Wallet size={20} aria-hidden="true" />
        </span>
        <div>
          <h2 className="text-base font-semibold text-[#14233D] sm:text-lg">Lleva tu carné siempre contigo</h2>
          <p className="mt-1 text-sm leading-6 text-slate-500">
            Agrega tu carné a la billetera de tu celular y ábrelo cuando lo necesites, sin volver a iniciar sesión en el portal.
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {ordered.filter((button) => button.enabled).map((button) => (
          <button
            key={button.provider}
            type="button"
            onClick={button.render}
            disabled={busy !== null}
            aria-busy={busy === button.provider}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-[#14233D] shadow-sm transition hover:border-[#c5953e] hover:bg-[#fffdf8] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#a87924] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {button.provider === "google" ? (
              <img
                src="/wallet/badges/google/add-to-google-wallet-es.svg"
                alt="Agregar a Google Wallet"
                className="h-[52px] w-auto"
              />
            ) : (
              <>
                <Smartphone size={18} aria-hidden="true" />
                {busy === button.provider ? button.busyLabel : button.label}
              </>
            )}
            {button.provider === "google" && busy === button.provider && <span className="sr-only">{button.busyLabel}</span>}
          </button>
        ))}
      </div>

      {!googleEnabled && !appleEnabled && (
        <p className="mt-3 text-xs leading-5 text-slate-500">Las billeteras digitales aún no están habilitadas para tu carné.</p>
      )}
      <p className="mt-3 text-xs leading-5 text-slate-500">
        La vigencia de tu membresía se confirma siempre al verificar el código QR del carné.
      </p>
      {simulation && (
        <p role="status" className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs font-semibold leading-5 text-amber-800">
          Simulación local: esta vista previa no es Google Wallet ni Apple Wallet, no envía datos a los proveedores y no instala pases reales.
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
