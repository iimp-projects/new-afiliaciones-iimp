"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Building2, Eye, Loader2, Mail, Megaphone, Save } from "lucide-react";
import { createCampaignAction, updateCampaignAction } from "../Actions/campaign.actions";
import { CampaignPreviewModal } from "./CampaignPreviewModal";
import type { SmtpAccountOption } from "../Config/smtpAccounts";
import type { CampaignDetail } from "../Models/Campaign";
import type { EmailSmtpAccount } from "@prisma/client";

const EMPTY = {
  name: "",
  subject: "",
  senderName: "",
  replyTo: "",
  htmlContent: "",
  textContent: "",
};

const ACCOUNT_ICON: Record<EmailSmtpAccount, typeof Mail> = {
  DEFAULT: Building2,
  PROV: Megaphone,
};

export function CampaignForm({
  campaignId,
  initial,
  smtpAccountOptions,
}: {
  campaignId?: number;
  initial?: CampaignDetail;
  smtpAccountOptions: SmtpAccountOption[];
}) {
  const router = useRouter();
  const [form, setForm] = useState({
    name: initial?.name ?? EMPTY.name,
    subject: initial?.subject ?? EMPTY.subject,
    senderName: initial?.senderName ?? EMPTY.senderName,
    replyTo: initial?.replyTo ?? EMPTY.replyTo,
    htmlContent: initial?.htmlContent ?? EMPTY.htmlContent,
    textContent: initial?.textContent ?? EMPTY.textContent,
  });
  const [smtpAccount, setSmtpAccount] = useState<EmailSmtpAccount>(initial?.smtpAccount ?? "PROV");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  const selectedOption = smtpAccountOptions.find((option) => option.value === smtpAccount) ?? null;

  const set = (key: keyof typeof EMPTY) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((prev) => ({ ...prev, [key]: event.target.value }));

  const submit = async () => {
    setSaving(true);
    setError(null);
    const payload = {
      name: form.name,
      subject: form.subject,
      senderName: form.senderName || null,
      senderEmail: selectedOption?.email ?? null,
      replyTo: form.replyTo || null,
      smtpAccount,
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
        <label className="block sm:col-span-2">
          <span className="text-xs font-bold uppercase text-slate-500">Reply-To</span>
          <input value={form.replyTo} onChange={set("replyTo")} className={field} placeholder="asociados@iimp.org.pe" />
        </label>
      </div>

      <section className="rounded-2xl border border-slate-200 p-4">
        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Cuenta de envío</p>
        <p className="mt-1 text-[11px] text-slate-400">Selecciona la cuenta SMTP que enviará esta campaña. La dirección del remitente es fija y proviene de la configuración autorizada.</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {smtpAccountOptions.map((option) => {
            const Icon = ACCOUNT_ICON[option.value];
            const selected = smtpAccount === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => setSmtpAccount(option.value)}
                className={`flex items-start gap-3 rounded-2xl border p-4 text-left transition-colors ${selected ? "border-[#C5A059] bg-[#fdfaf5] ring-1 ring-[#C5A059]" : "border-slate-200 hover:border-slate-300"}`}
              >
                <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${selected ? "bg-[#C5A059] text-white" : "bg-slate-100 text-slate-500"}`}>
                  <Icon size={18} />
                </span>
                <span className="min-w-0">
                  <span className="flex items-center gap-2 text-sm font-bold text-slate-800">{option.label}</span>
                  <span className="mt-0.5 block truncate text-xs font-semibold text-slate-500">{option.email ?? "No configurada"}</span>
                  <span className="mt-1 block text-[11px] leading-4 text-slate-400">{option.description}</span>
                  <span className="mt-1 block text-[11px] font-semibold text-slate-500">Límite por campaña: {option.maxRecipients.toLocaleString("es-PE")} destinatarios</span>
                  {option.dailyCampaignLimit != null && (
                    <span className="block text-[11px] font-semibold text-slate-500">Cuota diaria para campañas: {option.dailyCampaignLimit.toLocaleString("es-PE")}</span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
        {selectedOption?.sharesTransactionalCapacity && (
          <p className="mt-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-semibold text-amber-800">
            <AlertTriangle size={15} className="mt-0.5 shrink-0" />
            Esta cuenta comparte capacidad con las notificaciones transaccionales (recuperación de contraseña, activación, avales y pagos). Úsala solo para audiencias reducidas.
          </p>
        )}
        <p className="mt-3 text-xs font-semibold text-slate-500">
          Remitente efectivo: <span className="font-bold text-slate-700">{selectedOption?.email ?? "No configurada"}</span>
        </p>
      </section>

      <label className="block">
        <span className="text-xs font-bold uppercase text-slate-500">Contenido HTML</span>
        <p className="mb-1 text-[11px] text-slate-400">Puede usar variables: {"{{nombre}}"} {"{{empresa}}"} {"{{cargo}}"} {"{{email}}"}</p>
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
            senderEmail: selectedOption?.email ?? null,
            replyTo: form.replyTo || null,
          }}
          campaignId={null}
          status={null}
          previewRecipients={[]}
          fromEmail={selectedOption?.email ?? null}
          demo={true}
          onClose={() => setPreviewOpen(false)}
        />
      )}
    </div>
  );
}
