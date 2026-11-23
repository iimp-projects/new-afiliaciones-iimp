"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AlertCircle, X } from "lucide-react";

interface MissingField {
  field: string;
  label: string;
  section: "identity" | "contact" | "address";
}

export function ProfileCompletenessGuard() {
  const [missing, setMissing] = useState<MissingField[]>([]);
  const [dismissed, setDismissed] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    void fetch("/api/mi-cuenta/perfil/completitud", { cache: "no-store" })
      .then((response) => response.json())
      .then((body) => {
        if (body.success && body.data) setMissing(body.data.complete ? [] : body.data.missing);
      })
      .catch(() => undefined);
  }, [pathname]);

  if (missing.length === 0 || dismissed) return null;

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="profile-completeness-title" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="w-full max-w-lg rounded-2xl border border-[#E8D09E] bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-2 font-black text-slate-800">
            <AlertCircle className="text-[#b48a37]" size={22} />
            <h2 id="profile-completeness-title">Completa tus datos</h2>
          </div>
          <button type="button" onClick={() => setDismissed(true)} aria-label="Cerrar aviso" className="rounded-full p-1.5 text-slate-500 transition hover:bg-slate-100">
            <X size={18} />
          </button>
        </div>
        <p className="mt-3 text-sm leading-6 text-slate-600">Necesitamos estos datos para completar tu proceso y habilitar pagos, carnet y trámites:</p>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm font-semibold text-slate-700">
          {missing.map((item) => <li key={item.field}>{item.label}</li>)}
        </ul>
        <p className="mt-3 text-xs font-semibold text-amber-700">Puedes seguir consultando tu perfil, pero las acciones que requieren estos datos quedarán bloqueadas hasta completarlos.</p>
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button type="button" onClick={() => setDismissed(true)} className="rounded-xl px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100">Más tarde</button>
          <Link href="/intranet/mi-cuenta/perfil?editar=1" onClick={() => setDismissed(true)} className="rounded-xl bg-[#172a45] px-4 py-2 text-sm font-bold text-white hover:bg-[#0f1e33]">Completar ahora</Link>
        </div>
      </div>
    </div>
  );
}
