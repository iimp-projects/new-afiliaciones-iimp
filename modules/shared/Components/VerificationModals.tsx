"use client";

import { useEffect, useState, type ReactNode } from "react";
import { GlobalModalRoot } from "./GlobalModalRoot";
import { Clock, Mail, Smartphone, ShieldAlert } from "lucide-react";
import { ProcessLoadingOverlay } from "./ProcessLoadingOverlay";
import { OTP_COOLDOWN_SECONDS, type DestinationChannel, type VerificationChannel } from "../Models/Verification";

function WhatsAppIcon({ size = 28 }: { size?: number }) {
  return <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.452-.885-.77-1.482-1.72-1.655-2.018-.173-.298-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51h-.57c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" /></svg>;
}

const labels = { WHATSAPP: "WhatsApp", EMAIL: "Correo electrónico", SMS: "SMS" };
const button = "w-full h-12 rounded-xl font-bold text-sm disabled:opacity-50 transition-colors";

// Extracted from PersonalDataStep: shared channel and code dialogs.
function VerificationDialog({ title, children }: { title: string; children: ReactNode }) {
  return <GlobalModalRoot title={title}>
    <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">{children}</div>
  </GlobalModalRoot>;
}

export function VerificationChannelModal({ channels, channel, onChannel, onSend, onClose, loading, error, title = "Verifica tu identidad", description = "Por seguridad, enviaremos un código de verificación a uno de tus medios registrados." }: {
  channels: DestinationChannel[]; channel: VerificationChannel; onChannel: (channel: VerificationChannel) => void;
  onSend: () => void; onClose: () => void; loading: boolean; error?: string; title?: string; description?: string;
}) {
  return <VerificationDialog title={title}>
    <div className="w-16 h-16 bg-[#C5A059]/10 rounded-full flex items-center justify-center mb-6 mx-auto"><Clock className="w-8 h-8 text-[#C5A059]" /></div>
    <h3 className="text-xl font-bold text-center text-[#2F3136] mb-3">{title}</h3>
    <p className="text-sm text-gray-500 text-center mb-6 leading-relaxed">{description}</p>
    <p className="text-sm text-center mb-3">¿Dónde deseas recibir tu código de verificación?</p>
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
      {channels.map((option) => {
        const Icon = option.channel === "EMAIL" ? Mail : option.channel === "SMS" ? Smartphone : WhatsAppIcon;
        return <button key={option.channel} type="button" disabled={loading} aria-pressed={channel === option.channel} onClick={() => onChannel(option.channel)} className={`flex flex-col items-center justify-center gap-2 p-3 rounded-xl border-2 cursor-pointer transition-all ${channel === option.channel ? option.channel === "WHATSAPP" ? "border-[#25D366] bg-[#25D366]/5 text-[#1da851] shadow-sm" : "border-[#C5A059] bg-[#C5A059]/5 text-[#a3722a] shadow-sm" : "border-slate-200 bg-white text-slate-600"}`}>
          <Icon size={28} /><span className="text-[13px] font-bold">{labels[option.channel]}</span><span className="text-xs break-all">{option.destination}</span>
        </button>;
      })}
    </div>
    {!channels.length && <p role="status" className="text-sm text-center mb-4">No hay medios de contacto registrados. Contacta al IIMP para actualizar tus datos.</p>}
    {error && <p role="alert" className="text-xs text-red-500 text-center mb-4 font-bold">{error}</p>}
    <div className="flex flex-col gap-3">
      <button type="button" onClick={onSend} disabled={loading || !channels.some((option) => option.channel === channel)} className={`${button} bg-[#2F3136] text-white hover:bg-black`}>Enviar código por {labels[channel]}</button>
      <button type="button" onClick={onClose} disabled={loading} className={`${button} bg-white border border-gray-200 text-gray-600`}>Cancelar</button>
    </div>
    <ProcessLoadingOverlay open={loading} title="Enviando código..." description="Estamos enviando el código al medio seleccionado." />
  </VerificationDialog>;
}

export function OtpVerificationModal({ code, onCode, onVerify, onResend, onChangeChannel, onClose, loading, error, destination, sentAt, loadingTitle = "Validando código..." }: {
  code: string; onCode: (code: string) => void; onVerify: () => void; onResend: () => void;
  onChangeChannel: () => void; onClose: () => void; loading: boolean; error?: string; destination: string; sentAt: number; loadingTitle?: string;
}) {
  const [remaining, setRemaining] = useState(OTP_COOLDOWN_SECONDS);
  useEffect(() => {
    const tick = () => setRemaining(Math.max(0, Math.ceil((sentAt + OTP_COOLDOWN_SECONDS * 1000 - Date.now()) / 1000)));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [sentAt]);
  return <VerificationDialog title="Verificación de Seguridad">
    <div className="w-16 h-16 bg-[#2F3136]/5 rounded-full flex items-center justify-center mb-6 mx-auto"><ShieldAlert className="w-8 h-8 text-[#2F3136]" /></div>
    <h3 className="text-xl font-bold text-center text-[#2F3136] mb-2">Verificación de Seguridad</h3>
    <p className="text-sm text-gray-500 text-center mb-6">Ingresa el código de 6 dígitos enviado a {destination}.</p>
    {error && <p role="alert" className="text-xs text-red-500 text-center mb-4 font-bold">{error}</p>}
    <input aria-label="Código de verificación" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} disabled={loading} onChange={(event) => onCode(event.target.value.replace(/\D/g, ""))} className="w-full h-14 bg-gray-50 border border-gray-200 rounded-xl text-center text-2xl tracking-[0.5em] font-bold text-[#C5A059] focus:outline-none focus:border-[#C5A059] focus:ring-2 focus:ring-[#C5A059]/20 mb-6" placeholder="------" />
    <div className="flex flex-col gap-3">
      <button type="button" onClick={onVerify} disabled={loading || code.length !== 6} className={`${button} bg-[#C5A059] text-white hover:bg-[#b58f48]`}>Validar Código</button>
      <button type="button" onClick={onResend} disabled={loading || remaining > 0} className={`${button} text-gray-600`}>{remaining > 0 ? `Reenviar en ${remaining}s` : "Reenviar código"}</button>
      <button type="button" onClick={onChangeChannel} disabled={loading || remaining > 0} className={`${button} text-gray-600`}>Cambiar canal</button>
      <button type="button" onClick={onClose} disabled={loading} className={`${button} bg-white text-gray-500`}>Cancelar</button>
    </div>
    <ProcessLoadingOverlay open={loading} title={loadingTitle} description="Estamos procesando tu solicitud de forma segura." />
  </VerificationDialog>;
}
