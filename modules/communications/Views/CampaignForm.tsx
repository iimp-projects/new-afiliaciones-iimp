"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, Loader2, Mail, Save } from "lucide-react";
import { createCampaignAction, loadInstitutionalTemplateAction, updateCampaignAction } from "../Actions/campaign.actions";
import { CampaignPreviewModal } from "./CampaignPreviewModal";
import { SMTP_ACCOUNT_LABEL, type CampaignDetail } from "../Models/Campaign";
import type { SmtpAccount, SmtpAccountOption } from "@/lib/config/env";

const EMPTY = {
  name: "",
  subject: "",
  senderName: "",
  replyTo: "",
  htmlContent: "",
  textContent: "",
};

export function CampaignForm({ campaignId, initial, availableAccounts }: { campaignId?: number; initial?: CampaignDetail; availableAccounts: SmtpAccountOption[] }) {
  const router = useRouter();
  const [form, setForm] = useState({
    name: initial?.name ?? EMPTY.name,
    subject: initial?.subject ?? EMPTY.subject,
    senderName: initial?.senderName ?? EMPTY.senderName,
    replyTo: initial?.replyTo ?? EMPTY.replyTo,
    htmlContent: initial?.htmlContent ?? EMPTY.htmlContent,
    textContent: initial?.textContent ?? EMPTY.textContent,
    smtpAccount: (initial?.smtpAccount ?? "DEFAULT") as SmtpAccount,
  });
  const [saving, setSaving] = useState(false);
  const [loadingTemplate, setLoadingTemplate] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  const loadTemplate = async () => {
    setLoadingTemplate(true);
    setError(null);
    const response = await loadInstitutionalTemplateAction();
    setLoadingTemplate(false);
    if (!response.success) {
      setError(response.message);
      return;
    }
    setForm((prev) => ({
      ...prev,
      name: prev.name || response.name,
      subject: prev.subject || response.subject,
      htmlContent: response.htmlContent,
      textContent: response.textContent,
    }));
  };

  const set = (key: keyof typeof EMPTY) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((prev) => ({ ...prev, [key]: event.target.value }));

  const submit = async () => {
    setSaving(true);
    setError(null);
    const payload = {
      name: form.name,
      subject: form.subject,
      senderName: form.senderName || null,
      replyTo: form.replyTo || null,
      htmlContent: form.htmlContent,
      textContent: form.textContent || null,
      smtpAccount: form.smtpAccount,
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
        <label className="block sm:col-span-2">
          <span className="text-xs font-bold uppercase text-slate-500">Nombre del remitente</span>
          <input value={form.senderName} onChange={set("senderName")} className={field} placeholder="Instituto de Ingenieros de Minas del Perú" />
        </label>
      </div>

      <div>
        <span className="text-xs font-bold uppercase text-slate-500">Cuenta de envío *</span>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          {availableAccounts.map((option) => {
            const selected = form.smtpAccount === option.account;
            return (
              <label key={option.account} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors ${selected ? "border-[#C5A059] bg-[#fdfaf5]" : "border-slate-200 hover:bg-slate-50"}`}>
                <input type="radio" name="smtpAccount" value={option.account} checked={selected} onChange={() => setForm((prev) => ({ ...prev, smtpAccount: option.account }))} className="mt-0.5 h-4 w-4 shrink-0 accent-[#C5A059]" />
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-800">{SMTP_ACCOUNT_LABEL[option.account]}</p>
                  <p className="truncate text-xs font-semibold text-slate-500">{option.from}</p>
                </div>
              </label>
            );
          })}
        </div>
        {availableAccounts.length === 0 && <p className="mt-2 text-xs font-semibold text-amber-700">No hay cuentas SMTP configuradas.</p>}
      </div>

      <label className="block">
        <span className="text-xs font-bold uppercase text-slate-500">Reply-To</span>
        <input value={form.replyTo} onChange={set("replyTo")} className={field} placeholder="asociados@iimp.org.pe" />
      </label>

      <label className="block">
        <span className="text-xs font-bold uppercase text-slate-500">Contenido HTML</span>
        <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
          <p className="text-[11px] text-slate-400">Puede usar variables: {"{{nombre}}"} {"{{empresa}}"} {"{{cargo}}"} {"{{email}}"} {"{{nombre_completo}}"} {"{{correo_acceso}}"} {"{{tipo_asociado}}"} {"{{enlace_acceso}}"} {"{{enlace_activacion}}"}</p>
          <button
            onClick={() => void loadTemplate()}
            disabled={loadingTemplate}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#C5A059] px-3 py-1.5 text-[11px] font-black text-[#7f561e] disabled:opacity-50"
          >
            {loadingTemplate ? <Loader2 size={13} className="animate-spin" /> : <Mail size={13} />} Cargar plantilla institucional
          </button>
        </div>
        <textarea value={form.htmlContent} onChange={set("htmlContent")} rows={12} className={`${field} font-mono text-xs`} />
      </label>

      <div>
        <button
          onClick={() => setPreviewOpen(true)}
          disabled={!form.htmlContent.trim()}
          title={!form.htmlContent.trim() ? "Agrega contenido HTML para generar la vista previa." : undefined}
          className="inline-flex items-center gap-2 rounded-xl border border-[#C5A059] px-5 py-2.5 text-sm font-black text-[#7f561e] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Eye size={16} /> Previsualizar correo
        </button>
      </div>

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

      {previewOpen && (
        <CampaignPreviewModal
          data={{
            subject: form.subject,
            htmlContent: form.htmlContent,
            textContent: form.textContent || null,
            senderName: form.senderName || null,
            senderEmail: null,
            replyTo: form.replyTo || null,
            smtpAccount: form.smtpAccount,
          }}
          campaignId={null}
          status={null}
          previewRecipients={[]}
          fromEmail={availableAccounts.find((a) => a.account === form.smtpAccount)?.from ?? null}
          demo={true}
          onClose={() => setPreviewOpen(false)}
        />
      )}
    </div>
  );
}
