"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save } from "lucide-react";
import { createCampaignAction, updateCampaignAction } from "../Actions/campaign.actions";
import type { CampaignDetail } from "../Models/Campaign";

const EMPTY = {
  name: "",
  subject: "",
  senderName: "",
  senderEmail: "",
  replyTo: "",
  htmlContent: "",
  textContent: "",
};

export function CampaignForm({ campaignId, initial }: { campaignId?: number; initial?: CampaignDetail }) {
  const router = useRouter();
  const [form, setForm] = useState({
    name: initial?.name ?? EMPTY.name,
    subject: initial?.subject ?? EMPTY.subject,
    senderName: initial?.senderName ?? EMPTY.senderName,
    senderEmail: initial?.senderEmail ?? EMPTY.senderEmail,
    replyTo: initial?.replyTo ?? EMPTY.replyTo,
    htmlContent: initial?.htmlContent ?? EMPTY.htmlContent,
    textContent: initial?.textContent ?? EMPTY.textContent,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (key: keyof typeof EMPTY) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((prev) => ({ ...prev, [key]: event.target.value }));

  const submit = async () => {
    setSaving(true);
    setError(null);
    const payload = {
      name: form.name,
      subject: form.subject,
      senderName: form.senderName || null,
      senderEmail: form.senderEmail || null,
      replyTo: form.replyTo || null,
      htmlContent: form.htmlContent,
      textContent: form.textContent || null,
    };
    if (campaignId) {
      const response = await updateCampaignAction(campaignId, payload);
      if (!response.success) setError(response.message);
      else router.refresh();
    } else {
      const response = await createCampaignAction(payload);
      if (!response.success) setError(response.message);
      else router.push(`/intranet/correos-masivos/campanas/${response.id}`);
    }
    setSaving(false);
  };

  const field = "w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-[#C5A059]";

  return (
    <div className="mx-auto max-w-3xl space-y-5 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
      {error && <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</div>}

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs font-bold uppercase text-slate-500">Nombre de campaña *</span>
          <input value={form.name} onChange={set("name")} className={field} placeholder="Encuesta Sostenibilidad 2026" />
        </label>
        <label className="block">
          <span className="text-xs font-bold uppercase text-slate-500">Asunto *</span>
          <input value={form.subject} onChange={set("subject")} className={field} placeholder="Asunto del correo" />
        </label>
        <label className="block">
          <span className="text-xs font-bold uppercase text-slate-500">Nombre del remitente</span>
          <input value={form.senderName} onChange={set("senderName")} className={field} placeholder="Instituto de Ingenieros de Minas del Perú" />
        </label>
        <label className="block">
          <span className="text-xs font-bold uppercase text-slate-500">Correo remitente</span>
          <input value={form.senderEmail} onChange={set("senderEmail")} className={field} placeholder="no-reply@iimp.org.pe" />
        </label>
        <label className="block sm:col-span-2">
          <span className="text-xs font-bold uppercase text-slate-500">Reply-To</span>
          <input value={form.replyTo} onChange={set("replyTo")} className={field} placeholder="asociados@iimp.org.pe" />
        </label>
      </div>

      <label className="block">
        <span className="text-xs font-bold uppercase text-slate-500">Contenido HTML</span>
        <p className="mb-1 text-[11px] text-slate-400">Puede usar variables: {"{{nombre}}"} {"{{empresa}}"} {"{{cargo}}"} {"{{email}}"}</p>
        <textarea value={form.htmlContent} onChange={set("htmlContent")} rows={12} className={`${field} font-mono text-xs`} />
      </label>

      <label className="block">
        <span className="text-xs font-bold uppercase text-slate-500">Contenido texto</span>
        <textarea value={form.textContent} onChange={set("textContent")} rows={6} className={`${field} font-mono text-xs`} />
      </label>

      <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
        <button onClick={() => router.push(campaignId ? `/intranet/correos-masivos/campanas/${campaignId}` : "/intranet/correos-masivos")} className="rounded-xl px-5 py-2.5 text-sm font-bold text-slate-600">
          Cancelar
        </button>
        <button onClick={() => void submit()} disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-[#C5A059] px-6 py-2.5 text-sm font-black text-white shadow-md disabled:opacity-50">
          {saving && <Loader2 size={16} className="animate-spin" />}
          <Save size={16} /> Guardar campaña
        </button>
      </div>
    </div>
  );
}
