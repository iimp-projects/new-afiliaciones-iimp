"use client";

import { FileText } from "lucide-react";
import { PAYMENT_TERMS_URL } from "../../Constants/paymentTerms";

interface Props {
  termsAccepted: boolean;
  onTermsAcceptedChange: (value: boolean) => void;
  majorityAccepted: boolean;
  onMajorityAcceptedChange: (value: boolean) => void;
  disabled?: boolean;
}

const TERMS_LABEL = "Términos y Condiciones de Afiliación y Pago del IIMP";

export function TermsAndConditionsCard({ termsAccepted, onTermsAcceptedChange, majorityAccepted, onMajorityAcceptedChange, disabled = false }: Props) {
  return (
    <div className="rounded-2xl border border-[#E8D09E] bg-[#FFFCF5] p-5">
      <div className="flex items-center gap-2 font-black text-slate-800">
        <FileText size={17} className="text-[#C5A059]" />
        Términos y condiciones
      </div>
      <p className="mt-3 text-sm font-semibold leading-relaxed text-slate-700">
        Antes de continuar, revisa y acepta los términos y condiciones aplicables a tu afiliación y pago.
      </p>

      {PAYMENT_TERMS_URL ? (
        <a
          href={PAYMENT_TERMS_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-flex items-center gap-1.5 text-xs font-black text-[#9A7739] underline underline-offset-2 hover:text-[#7f561e]"
        >
          Leer Términos y Condiciones
        </a>
      ) : null}

      <label className="mt-4 flex items-start gap-3 border-t border-[#E8D09E]/60 pt-4">
        <input
          type="checkbox"
          disabled={disabled}
          checked={termsAccepted}
          onChange={(event) => onTermsAcceptedChange(event.target.checked)}
          className="mt-0.5 h-5 w-5 accent-[#C5A059] disabled:cursor-not-allowed"
        />
        <span className="text-xs font-bold text-slate-700">
          He leído y acepto los{" "}
          {PAYMENT_TERMS_URL ? (
            <a href={PAYMENT_TERMS_URL} target="_blank" rel="noopener noreferrer" className="text-[#9A7739] underline hover:text-[#7f561e]">
              {TERMS_LABEL}
            </a>
          ) : (
            <strong>{TERMS_LABEL}</strong>
          )}
          .
        </span>
      </label>

      <label className="mt-3 flex items-start gap-3">
        <input
          type="checkbox"
          disabled={disabled}
          checked={majorityAccepted}
          onChange={(event) => onMajorityAcceptedChange(event.target.checked)}
          className="mt-0.5 h-5 w-5 accent-[#C5A059] disabled:cursor-not-allowed"
        />
        <span className="text-xs font-bold text-slate-700">
          Declaro ser mayor de edad y estar facultado/a para realizar este pago.
        </span>
      </label>
    </div>
  );
}
