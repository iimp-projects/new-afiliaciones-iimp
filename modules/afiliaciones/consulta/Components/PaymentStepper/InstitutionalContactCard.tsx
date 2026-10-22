"use client";

import { Mail, MapPin, Phone } from "lucide-react";

const EMAIL = "liset.otoya@iimp.org.pe";
const PHONE = "+51 982 097 019";
const PHONE_TEL = "+51982097019";
const ADDRESS = "Los Canarios 155, Lima 15021, Perú";

export function InstitutionalContactCard() {
  return (
    <div className="rounded-2xl border border-[#E8D09E] bg-[#FFFCF5] p-5">
      <p className="mb-1 text-xs font-black uppercase tracking-wide text-[#9A7739]">
        ¿Necesitas ayuda con tu afiliación?
      </p>
      <p className="mb-4 text-sm font-semibold text-slate-700">
        Comunícate con el área de Asociados del IIMP.
      </p>
      <ul className="space-y-3 text-sm text-[#7f561e]">
        <li className="flex items-start gap-3">
          <Mail size={16} className="mt-0.5 shrink-0 text-[#C5A059]" />
          <a href={`mailto:${EMAIL}`} className="font-semibold hover:underline">
            {EMAIL}
          </a>
        </li>
        <li className="flex items-start gap-3">
          <Phone size={16} className="mt-0.5 shrink-0 text-[#C5A059]" />
          <a href={`tel:${PHONE_TEL}`} className="font-semibold hover:underline">
            {PHONE}
          </a>
        </li>
        <li className="flex items-start gap-3">
          <MapPin size={16} className="mt-0.5 shrink-0 text-[#C5A059]" />
          <span className="font-semibold">{ADDRESS}</span>
        </li>
      </ul>
    </div>
  );
}
