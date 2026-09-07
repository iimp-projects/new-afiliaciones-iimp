"use client";

import { Save, X } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import type { SystemSettingValueViewModel, SystemSettingViewModel } from "../Models/SystemSettingsViewModel";

export interface PaymentSettingEditorState {
  setting: SystemSettingViewModel;
  value?: SystemSettingValueViewModel;
  initialValue?: string;
}

interface PaymentSettingEditorProps {
  editor: PaymentSettingEditorState;
  onClose: () => void;
  onSave: (setting: SystemSettingViewModel, value: SystemSettingValueViewModel | undefined, payload: { value: string; startsAt: string; endsAt: string | null; isActive: boolean }) => Promise<void>;
}

const inputClass = "mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-[#C5A059] focus:ring-4 focus:ring-[#C5A059]/10";

const COPY: Record<string, { title: string; valueLabel: string; description?: string }> = {
  PAYMENT_REGISTRATION_PRICE: { title: "Cambiar precio de inscripción", valueLabel: "Nuevo precio", description: "Este importe se aplicará únicamente a nuevos pagos." },
  PAYMENT_MONTHLY_FEE: { title: "Cambiar cuota mensual", valueLabel: "Nuevo importe", description: "Esta configuración queda preparada para una futura integración de cobro." },
  PAYMENTS_ENABLED: { title: "Actualizar disponibilidad de pagos", valueLabel: "Estado", description: "Cuando los pagos estén desactivados, ningún postulante podrá iniciar un nuevo pago." },
  PAYMENT_START_AT: { title: "Definir inicio del periodo", valueLabel: "Fecha y hora de inicio" },
  PAYMENT_END_AT: { title: "Definir cierre del periodo", valueLabel: "Fecha y hora de cierre" },
  CARD_ENABLED: { title: "Actualizar pagos con tarjeta", valueLabel: "Estado" },
  NIUBIZ_MERCHANT_NAME: { title: "Cambiar nombre mostrado", valueLabel: "Nombre mostrado" },
  NIUBIZ_CHECKOUT_LOGO_URL: { title: "Cambiar logo del pago", valueLabel: "URL pública del logo", description: "En producción la imagen debe ser pública y accesible mediante HTTPS." },
  NIUBIZ_FORM_BUTTON_COLOR: { title: "Cambiar color principal", valueLabel: "Color principal" },
  NIUBIZ_SESSION_EXPIRATION_MINUTES: { title: "Cambiar tiempo para completar el pago", valueLabel: "Tiempo disponible" },
  PAYMENT_CONFIRMATION_EMAIL_ENABLED: { title: "Actualizar confirmación por correo", valueLabel: "Estado" },
  PAYMENT_CONFIRMATION_EMAIL_SUBJECT: { title: "Cambiar mensaje de confirmación", valueLabel: "Asunto del correo" },
};

function localDateTime(value: string | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 16);
}

export function PaymentSettingEditor({ editor, onClose, onSave }: PaymentSettingEditorProps) {
  const { setting, value } = editor;
  const copy = COPY[setting.key] ?? { title: "Actualizar configuración", valueLabel: "Valor" };
  const defaultValue = useMemo(() => {
    const baseValue = value?.value ?? setting.currentValue ?? editor.initialValue ?? (setting.dataType === "BOOLEAN" ? "false" : "");
    return setting.dataType === "DATETIME" ? localDateTime(baseValue) : baseValue;
  }, [editor.initialValue, setting.currentValue, setting.dataType, value?.value]);
  const [rawValue, setRawValue] = useState(defaultValue);
  const [scheduleMode, setScheduleMode] = useState(value?.startsAt && new Date(value.startsAt) > new Date() ? "scheduled" : "now");
  const [startsAt, setStartsAt] = useState(localDateTime(value?.startsAt) || localDateTime(new Date().toISOString()));
  const [endsAt] = useState(localDateTime(value?.endsAt));
  const [active, setActive] = useState(value?.isActive ?? true);
  const [saving, setSaving] = useState(false);
  const isBoolean = setting.dataType === "BOOLEAN";
  const isDateValue = setting.dataType === "DATETIME";
  const isMoney = setting.dataType === "MONEY";
  const isColor = setting.key === "NIUBIZ_FORM_BUTTON_COLOR";

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    try {
      const effectiveStart = scheduleMode === "now" ? new Date().toISOString() : new Date(startsAt).toISOString();
      const effectiveValue = isDateValue ? new Date(rawValue).toISOString() : rawValue;
      await onSave(setting, value, { value: effectiveValue, startsAt: effectiveStart, endsAt: endsAt ? new Date(endsAt).toISOString() : null, isActive: active });
    } finally {
      setSaving(false);
    }
  };

  return <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="payment-setting-editor-title">
    <form onSubmit={submit} className="max-h-[92vh] w-full max-w-xl overflow-auto rounded-3xl bg-white shadow-2xl">
      <div className="flex items-start justify-between border-b border-slate-100 p-6">
        <div><h2 id="payment-setting-editor-title" className="text-xl font-black tracking-tight text-slate-800">{copy.title}</h2>{copy.description && <p className="mt-1.5 text-sm leading-6 text-slate-500">{copy.description}</p>}</div>
        <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700" aria-label="Cerrar"><X size={20}/></button>
      </div>
      <div className="space-y-5 p-6">
        {isBoolean ? <fieldset><legend className="text-sm font-bold text-slate-700">{copy.valueLabel}</legend><div className="mt-2 grid grid-cols-2 gap-3"><label className={`cursor-pointer rounded-2xl border p-4 ${rawValue === "true" ? "border-emerald-400 bg-emerald-50" : "border-slate-200"}`}><input className="sr-only" type="radio" value="true" checked={rawValue === "true"} onChange={(event) => setRawValue(event.target.value)}/><span className="block text-sm font-black text-slate-800">Activado</span><span className="mt-1 block text-xs text-slate-500">Permitido</span></label><label className={`cursor-pointer rounded-2xl border p-4 ${rawValue === "false" ? "border-slate-400 bg-slate-50" : "border-slate-200"}`}><input className="sr-only" type="radio" value="false" checked={rawValue === "false"} onChange={(event) => setRawValue(event.target.value)}/><span className="block text-sm font-black text-slate-800">Desactivado</span><span className="mt-1 block text-xs text-slate-500">No disponible</span></label></div></fieldset> : <label className="block text-sm font-bold text-slate-700">{copy.valueLabel}{isMoney && <span className="ml-1 font-medium text-slate-400">(S/)</span>}{isColor ? <div className="mt-2 flex items-center gap-3"><input aria-label="Selector de color" type="color" value={rawValue || "#C5A059"} onChange={(event) => setRawValue(event.target.value.toUpperCase())} className="h-11 w-14 cursor-pointer rounded-lg border border-slate-200 bg-white p-1"/><input required value={rawValue} onChange={(event) => setRawValue(event.target.value.toUpperCase())} className={inputClass} placeholder="#C5A059"/></div> : setting.key === "NIUBIZ_SESSION_EXPIRATION_MINUTES" ? <select value={rawValue} onChange={(event) => setRawValue(event.target.value)} className={inputClass}><option value="5">5 minutos</option><option value="10">10 minutos</option><option value="15">15 minutos</option></select> : <input required value={rawValue} onChange={(event) => setRawValue(event.target.value)} type={isDateValue ? "datetime-local" : isMoney || setting.dataType === "INTEGER" ? "number" : setting.dataType === "URL" ? "url" : "text"} step={isMoney ? "0.01" : undefined} min={isMoney ? "0" : undefined} className={inputClass} placeholder={isMoney ? "0.00" : undefined}/>}</label>}
        {setting.dataType !== "DATETIME" && <fieldset><legend className="text-sm font-bold text-slate-700">Aplicar cambio</legend><div className="mt-2 flex flex-wrap gap-3"><label className={`cursor-pointer rounded-xl border px-4 py-3 text-sm font-bold ${scheduleMode === "now" ? "border-[#C5A059] bg-[#FFF8E8] text-[#8F682D]" : "border-slate-200 text-slate-600"}`}><input className="sr-only" type="radio" checked={scheduleMode === "now"} onChange={() => setScheduleMode("now")}/>Ahora</label><label className={`cursor-pointer rounded-xl border px-4 py-3 text-sm font-bold ${scheduleMode === "scheduled" ? "border-[#C5A059] bg-[#FFF8E8] text-[#8F682D]" : "border-slate-200 text-slate-600"}`}><input className="sr-only" type="radio" checked={scheduleMode === "scheduled"} onChange={() => setScheduleMode("scheduled")}/>Programar para otra fecha</label></div>{scheduleMode === "scheduled" && <label className="mt-3 block text-sm font-bold text-slate-700">Fecha y hora<input required type="datetime-local" value={startsAt} min={localDateTime(new Date().toISOString())} onChange={(event) => setStartsAt(event.target.value)} className={inputClass}/></label>}</fieldset>}
        {setting.dataType === "DATETIME" && <p className="rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-500">La fecha indicada controla el periodo disponible. El cierre no incluye el instante exacto configurado.</p>}
        {value && <label className="flex items-center gap-2 text-sm font-semibold text-slate-600"><input type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)}/> Mantener este valor activo</label>}
      </div>
      <div className="flex justify-end gap-3 border-t border-slate-100 bg-slate-50 p-5"><button type="button" onClick={onClose} disabled={saving} className="rounded-xl px-4 py-2.5 text-sm font-bold text-slate-600">Cancelar</button><button disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-[#C5A059] px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-[#A67C3B] disabled:opacity-60"><Save size={16}/>{saving ? "Guardando..." : "Guardar cambio"}</button></div>
    </form>
  </div>;
}
