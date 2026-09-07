"use client";

import { LockKeyhole } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { NiubizCheckoutConfig } from "../DTOs/Niubiz/NiubizCheckout.dto";

type CheckoutState = "IDLE" | "PREPARING_CHECKOUT" | "CHECKOUT_OPEN" | "PROCESSING_PAYMENT" | "CHECKOUT_ERROR";
type VisanetCheckoutApi = { configure: (configuration: Record<string, unknown>) => void; open: () => void; };
declare global { interface Window { VisanetCheckout?: VisanetCheckoutApi; } }

const checkoutScriptPromises = new Map<string, Promise<void>>();
function loadCheckoutLibrary(checkoutUrl: string): Promise<void> {
  if (window.VisanetCheckout) return Promise.resolve();
  const existing = checkoutScriptPromises.get(checkoutUrl);
  if (existing) return existing;
  const promise = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = checkoutUrl;
    script.async = true;
    script.dataset.niubizCheckoutLibrary = "true";
    script.onload = () => window.VisanetCheckout ? resolve() : reject(new Error("Niubiz checkout.js no expuso VisanetCheckout."));
    script.onerror = () => reject(new Error("Niubiz checkout.js failed"));
    document.head.appendChild(script);
  });
  checkoutScriptPromises.set(checkoutUrl, promise);
  promise.catch(() => checkoutScriptPromises.delete(checkoutUrl));
  return promise;
}

interface Props { config: NiubizCheckoutConfig; disabled?: boolean; onStateChange?: (state: CheckoutState) => void; }

/** Opción 2 de Niubiz: biblioteca global + configure() + open(). */
export function NiubizCheckout({ config, disabled = false, onStateChange }: Props) {
  const completedResultRef = useRef<unknown>(null);
  const openingRef = useRef(false);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [checkoutCompleted, setCheckoutCompleted] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    onStateChange?.("PREPARING_CHECKOUT");
    void loadCheckoutLibrary(config.checkoutUrl).then(() => {
      if (!active) return;
      setStatus("ready");
      onStateChange?.("IDLE");
      console.info("Niubiz checkout.js loaded");
    }).catch(() => {
      if (!active) return;
      setStatus("error");
      setError("No pudimos abrir la pasarela. Intenta nuevamente en unos segundos.");
      onStateChange?.("CHECKOUT_ERROR");
      console.error("Niubiz checkout.js failed");
    });
    return () => { active = false; };
  }, [config.checkoutUrl, loadAttempt, onStateChange]);

  const openCheckout = () => {
    if (disabled || status !== "ready" || openingRef.current) return;
    openingRef.current = true;
    onStateChange?.("PREPARING_CHECKOUT");

    // Cede un frame al navegador para que el overlay se pinte antes de llamar al SDK externo.
    requestAnimationFrame(() => {
      const checkout = window.VisanetCheckout;
      if (!checkout) {
        openingRef.current = false;
        setStatus("error");
        setError("No pudimos abrir la pasarela. Intenta nuevamente en unos segundos.");
        onStateChange?.("CHECKOUT_ERROR");
        return;
      }

      try {
        completedResultRef.current = null;
        checkout.configure({ sessiontoken: config.sessionToken, channel: "web", merchantid: config.merchantId, purchasenumber: config.purchaseNumber, amount: config.amount, expirationminutes: config.expirationMinutes, timeouturl: config.timeoutUrl, action: config.callbackUrl, merchantname: config.merchantName, ...(config.merchantLogoUrl ? { merchantlogo: config.merchantLogoUrl } : {}), cardholdername: config.cardholderName, cardholderlastname: config.cardholderLastName, cardholderemail: config.cardholderEmail, formbuttoncolor: config.formButtonColor, complete: (params: unknown) => { completedResultRef.current = params; setCheckoutCompleted(true); onStateChange?.("PROCESSING_PAYMENT"); } });
        checkout.open();
        onStateChange?.("CHECKOUT_OPEN");
      } catch {
        openingRef.current = false;
        setStatus("error");
        setError("No pudimos abrir la pasarela. Intenta nuevamente en unos segundos.");
        onStateChange?.("CHECKOUT_ERROR");
      }
    });
  };

  return <div className="space-y-3 rounded-2xl border border-[#E8D09E] bg-white p-5" data-niubiz-complete={checkoutCompleted ? "true" : "false"}>
    {status === "loading" && <p className="text-sm font-bold text-slate-700">Preparando formulario seguro de pago...</p>}
    {status === "ready" && <p className="text-sm font-bold text-slate-800">Complete el pago en el formulario seguro de Niubiz.</p>}
    {status !== "error" && <><button type="button" onClick={openCheckout} disabled={disabled || status !== "ready"} className="h-13 w-full rounded-xl bg-[#C5A059] px-8 py-3 text-sm font-extrabold text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 disabled:hover:brightness-100 sm:w-[320px]">PAGA AQUÍ</button><p className="flex items-center gap-1.5 text-[10px] font-black tracking-wide text-slate-500"><LockKeyhole size={12} />PASARELA DE PAGO SEGURA DE NIUBIZ</p></>}
    {status === "error" && <><p className="text-sm font-bold text-red-700">{error}</p><button type="button" onClick={() => { setError(null); setStatus("loading"); setLoadAttempt((attempt) => attempt + 1); }} className="rounded-xl border border-[#C5A059] px-4 py-2 text-sm font-bold text-[#9A7739]">Reintentar</button></>}
  </div>;
}
