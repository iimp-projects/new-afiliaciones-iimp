"use client";

import { LockKeyhole } from "lucide-react";
import { useRef, useState } from "react";
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

interface Props { config: NiubizCheckoutConfig | null; disabled?: boolean; onStateChange?: (state: CheckoutState) => void; onRequestSession?: () => Promise<NiubizCheckoutConfig | null>; }

/** Opción 2 de Niubiz: biblioteca global + configure() + open(). */
export function NiubizCheckout({ config, disabled = false, onStateChange, onRequestSession }: Props) {
  const completedResultRef = useRef<unknown>(null);
  const openingRef = useRef(false);
  const [checkoutCompleted, setCheckoutCompleted] = useState(false);

  const openCheckout = async () => {
    if (disabled || openingRef.current) return;
    openingRef.current = true;
    onStateChange?.("PREPARING_CHECKOUT");

    let resolvedConfig = config;
    if (!resolvedConfig && onRequestSession) {
      try {
        resolvedConfig = await onRequestSession();
      } catch {
        resolvedConfig = null;
      }
    }

    if (!resolvedConfig) {
      openingRef.current = false;
      onStateChange?.("CHECKOUT_ERROR");
      return;
    }

    try {
      await loadCheckoutLibrary(resolvedConfig.checkoutUrl);
    } catch {
      openingRef.current = false;
      onStateChange?.("CHECKOUT_ERROR");
      return;
    }

    requestAnimationFrame(() => {
      const checkout = window.VisanetCheckout;
      if (!checkout) {
        openingRef.current = false;
        onStateChange?.("CHECKOUT_ERROR");
        return;
      }

      try {
        completedResultRef.current = null;
        checkout.configure({ sessiontoken: resolvedConfig.sessionToken, channel: "web", merchantid: resolvedConfig.merchantId, purchasenumber: resolvedConfig.purchaseNumber, amount: resolvedConfig.amount, expirationminutes: resolvedConfig.expirationMinutes, timeouturl: resolvedConfig.timeoutUrl, action: resolvedConfig.callbackUrl, merchantname: resolvedConfig.merchantName, ...(resolvedConfig.merchantLogoUrl ? { merchantlogo: resolvedConfig.merchantLogoUrl } : {}), cardholdername: resolvedConfig.cardholderName, cardholderlastname: resolvedConfig.cardholderLastName, cardholderemail: resolvedConfig.cardholderEmail, formbuttoncolor: resolvedConfig.formButtonColor, complete: (params: unknown) => { completedResultRef.current = params; setCheckoutCompleted(true); onStateChange?.("PROCESSING_PAYMENT"); } });
        checkout.open();
        onStateChange?.("CHECKOUT_OPEN");
      } catch {
        openingRef.current = false;
        onStateChange?.("CHECKOUT_ERROR");
      }
    });
  };

  return <div className="space-y-3" data-niubiz-complete={checkoutCompleted ? "true" : "false"}>
    <button type="button" onClick={openCheckout} disabled={disabled} className="h-13 w-full rounded-xl bg-[#C5A059] px-8 py-3 text-sm font-extrabold text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 disabled:hover:brightness-100 sm:w-[320px]">PAGA AQUÍ</button>
    <p className="flex items-center gap-1.5 text-[10px] font-black tracking-wide text-slate-500"><LockKeyhole size={12} />PASARELA DE PAGO SEGURA DE NIUBIZ</p>
  </div>;
}
