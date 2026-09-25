"use client";

import Link from "next/link";
import { FormEvent, useState, type ReactNode } from "react";
import { AlertCircle, ArrowLeft, BellRing, CheckCircle2, Circle, Eye, EyeOff, Gift, KeyRound, LoaderCircle, Lock, Mail, Send, ShieldCheck } from "lucide-react";

export function ActivationView({ token, email }: { token: string | null; email: string | null }) {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [activated, setActivated] = useState(false);
  const [resendEmail, setResendEmail] = useState("");
  const [resendMessage, setResendMessage] = useState<string | null>(null);
  const [resending, setResending] = useState(false);
  const requirements = [
    { label: "Mínimo 8 caracteres", met: password.length >= 8 },
    { label: "Una letra mayúscula", met: /[A-Z]/.test(password) },
    { label: "Un número", met: /[0-9]/.test(password) },
  ];
  const confirmationStarted = confirmation.length > 0;
  const passwordsMatch = password.length > 0 && password === confirmation;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || submitting) return;
    if (password !== confirmation) return setMessage("Las contraseñas no coinciden.");
    setSubmitting(true);
    setMessage(null);
    const response = await fetch("/api/auth/account-activation", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, password, confirmPassword: confirmation }) });
    const body = await response.json().catch(() => ({}));
    setSubmitting(false);
    if (!response.ok) return setMessage(body.message ?? "No se pudo activar la cuenta. Inténtalo nuevamente.");
    setActivated(true);
  }

  async function resend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (resending) return;
    setResending(true);
    setResendMessage(null);
    await fetch("/api/auth/account-activation/resend", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: resendEmail }) });
    setResending(false);
    setResendMessage("Si existe una cuenta pendiente asociada a este correo, enviaremos un nuevo enlace de activación.");
  }

  return (
    <main className="min-h-dvh w-full bg-surface font-sans antialiased lg:grid lg:grid-cols-2">
      <InstitutionalPanel />
      <MobileGoldenHeader />
      <section className="flex min-h-dvh items-center justify-center bg-surface-container-lowest px-6 py-8 sm:px-10 lg:px-16">
        <div className="w-full max-w-[580px]">
          {activated ? <SuccessState /> : token ? <ActivationForm {...{ email: email ?? "", password, confirmation, showPassword, showConfirmation, requirements, passwordsMatch, confirmationStarted, message, submitting, setPassword, setConfirmation, setShowPassword, setShowConfirmation, submit }} /> : <InvalidLinkState {...{ resendEmail, resendMessage, resending, setResendEmail, resend }} />}
        </div>
      </section>
    </main>
  );
}

function MobileGoldenHeader() {
  return (
    <header className="relative overflow-hidden bg-primary px-6 pb-9 pt-7 text-white lg:hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-[#2a1700]/55 via-transparent to-[#4a2d00]/75" />
      <div className="absolute inset-0 bg-cover bg-center opacity-20 mix-blend-overlay" style={{ backgroundImage: "url('/images/minero.jpg')" }} />
      <div className="relative z-10 mx-auto flex w-full max-w-[580px] flex-col">
        <img className="h-10 w-auto object-contain brightness-0 invert" src="/images/logo-iimp.png" alt="Instituto de Ingenieros de Minas del Perú" />
        <p className="mt-4 text-[11px] font-bold uppercase tracking-[0.14em] text-[#e8c98a]">Portal de Asociados IIMP</p>
        <h1 className="mt-2 text-2xl font-extrabold leading-tight tracking-tight">Tu cuenta está <span className="text-[#e8c98a]">casi lista.</span></h1>
        <p className="mt-2 text-sm leading-6 text-white/80">Crea una contraseña segura para acceder a los beneficios y servicios del Portal de Asociados IIMP.</p>
      </div>
    </header>
  );
}

function InstitutionalPanel() {
  return (
    <section className="relative hidden min-h-dvh overflow-hidden lg:flex lg:flex-col lg:items-center lg:justify-center">
      <div className="absolute inset-0 bg-primary" />
      <div className="absolute inset-0 bg-gradient-to-br from-[#2a1700]/55 via-transparent to-[#4a2d00]/75" />
      <div className="absolute inset-0 bg-cover bg-center opacity-20 mix-blend-overlay" style={{ backgroundImage: "url('/images/minero.jpg')" }} />
      <div className="absolute -right-24 -top-24 h-80 w-80 rounded-full bg-[#c39254]/15 blur-3xl" />
      <div className="absolute -bottom-28 -left-28 h-80 w-80 rounded-full bg-white/5 blur-3xl" />

      <div className="relative z-10 w-full max-w-xl px-12 text-white 2xl:px-16">
        <img className="mb-10 h-12 w-auto object-contain brightness-0 invert drop-shadow-md" src="/images/logo-iimp.png" alt="Instituto de Ingenieros de Minas del Perú" />

        <span className="inline-flex items-center gap-2 rounded-md border border-white/20 bg-white/10 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.14em]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#c39254]" />
          Portal de Asociados IIMP
        </span>

        <h1 className="mt-6 max-w-md text-[44px] font-extrabold leading-[1.08] tracking-tight 2xl:text-[52px]">
          Tu cuenta está<br />
          <span className="text-[#e8c98a]">casi lista.</span>
        </h1>

        <p className="mt-5 max-w-[440px] text-base leading-7 text-white/80">
          Crea una contraseña segura para acceder a los beneficios y servicios del Portal de Asociados IIMP.
        </p>

        <ul className="mt-10 space-y-5">
          <Benefit icon={<Gift className="h-5 w-5" aria-hidden="true" />} title="Accede a tus beneficios" description="Gestiona tu información, trámites y servicios." />
          <Benefit icon={<BellRing className="h-5 w-5" aria-hidden="true" />} title="Mantente informado" description="Novedades, eventos y comunicaciones del IIMP." />
          <Benefit icon={<ShieldCheck className="h-5 w-5" aria-hidden="true" />} title="Seguro y confiable" description="Tus datos protegidos con los más altos estándares." />
        </ul>
      </div>
    </section>
  );
}

function Benefit({ icon, title, description }: { icon: ReactNode; title: string; description: string }) {
  return (
    <li className="flex items-start gap-4">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/20 bg-white/10 text-[#e8c98a]">
        {icon}
      </span>
      <div>
        <p className="text-sm font-semibold text-white">{title}</p>
        <p className="mt-0.5 text-xs leading-5 text-white/70">{description}</p>
      </div>
    </li>
  );
}

type ActivationFormProps = { email: string; password: string; confirmation: string; showPassword: boolean; showConfirmation: boolean; requirements: Array<{ label: string; met: boolean }>; passwordsMatch: boolean; confirmationStarted: boolean; message: string | null; submitting: boolean; setPassword: (value: string) => void; setConfirmation: (value: string) => void; setShowPassword: (value: (current: boolean) => boolean) => void; setShowConfirmation: (value: (current: boolean) => boolean) => void; submit: (event: FormEvent<HTMLFormElement>) => void };

function ActivationForm(props: ActivationFormProps) {
  const feedbackId = "activation-confirmation-feedback";
  return (
    <>
      <Header eyebrow="Portal de Asociados IIMP" title="Activa tu cuenta" description="Crea una contraseña segura para comenzar a utilizar el Portal de Asociados IIMP." />
      <form className="mt-7 space-y-4" onSubmit={props.submit}>
        <div className="rounded-lg border border-outline-variant/80 bg-surface-container-low px-4 py-3" aria-label="Correo asociado a la cuenta">
          <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.12em] text-secondary"><Mail className="h-4 w-4 text-primary" aria-hidden="true" />Correo asociado</p>
          <p className="mt-1 break-all pl-6 text-sm font-semibold text-on-surface">{props.email}</p>
        </div>
        <PasswordField id="activation-password" label="Nueva contraseña" value={props.password} visible={props.showPassword} disabled={props.submitting} onChange={props.setPassword} onToggle={() => props.setShowPassword((value) => !value)} />
        <ul className="flex flex-wrap gap-x-4 gap-y-1.5 px-1 text-xs text-secondary" aria-label="Requisitos de contraseña">
          {props.requirements.map((requirement) => <li className="flex items-center gap-1.5" key={requirement.label}>{requirement.met ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-700" aria-hidden="true" /> : <Circle className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />}<span className={requirement.met ? "text-emerald-800" : undefined}>{requirement.label}</span></li>)}
        </ul>
        <PasswordField id="activation-confirmation" label="Confirmar contraseña" value={props.confirmation} visible={props.showConfirmation} disabled={props.submitting} invalid={props.confirmationStarted && !props.passwordsMatch} describedBy={feedbackId} onChange={props.setConfirmation} onToggle={() => props.setShowConfirmation((value) => !value)} />
        <div className="min-h-5" id={feedbackId} aria-live="polite">{props.confirmationStarted && <p className={`flex items-center gap-1.5 text-xs ${props.passwordsMatch ? "text-emerald-800" : "text-red-700"}`}><CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />{props.passwordsMatch ? "Las contraseñas coinciden" : "Las contraseñas no coinciden"}</p>}</div>
        {props.message && <Alert message={props.message} />}
        <button className="flex h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold tracking-wide text-on-primary transition hover:brightness-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70" type="submit" disabled={props.submitting}>{props.submitting ? <><LoaderCircle className="h-4 w-4 animate-spin" />Activando cuenta...</> : <><CheckCircle2 className="h-4 w-4" />Activar mi cuenta</>}</button>
      </form>
      <Link className="mt-5 inline-flex items-center gap-1.5 text-sm font-bold text-primary transition hover:text-primary/80" href="/login"><ArrowLeft className="h-4 w-4" aria-hidden="true" />Volver al inicio</Link>
    </>
  );
}

function PasswordField({ id, label, value, visible, disabled, invalid = false, describedBy, onChange, onToggle }: { id: string; label: string; value: string; visible: boolean; disabled: boolean; invalid?: boolean; describedBy?: string; onChange: (value: string) => void; onToggle: () => void }) {
  return <div><label className="mb-2 block text-sm font-bold text-on-surface-variant" htmlFor={id}>{label}</label><div className="group relative"><Lock className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-secondary transition-colors group-focus-within:text-primary" aria-hidden="true" /><input className="h-[52px] w-full rounded-xl border border-outline-variant bg-surface pl-11 pr-12 text-sm font-medium text-on-surface outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-70" id={id} type={visible ? "text" : "password"} autoComplete="new-password" value={value} onChange={(event) => onChange(event.target.value)} minLength={8} required disabled={disabled} aria-invalid={invalid} aria-describedby={describedBy} /><button className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-3 text-secondary transition hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50" type="button" aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"} aria-pressed={visible} onClick={onToggle} disabled={disabled}>{visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></div></div>;
}

function SuccessState() { return <div className="text-center"><div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100"><CheckCircle2 className="h-9 w-9 text-emerald-700" /></div><h1 className="mt-6 text-3xl font-extrabold tracking-tight text-on-surface">¡Tu cuenta está lista!</h1><p className="mt-3 text-sm leading-6 text-secondary">Tu contraseña fue creada correctamente. Ya puedes ingresar al Portal de Asociados IIMP.</p><Link className="mt-7 flex h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-on-primary transition hover:brightness-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2" href="/login"><KeyRound className="h-4 w-4" />Ir a iniciar sesión</Link></div>; }

function InvalidLinkState(props: { resendEmail: string; resendMessage: string | null; resending: boolean; setResendEmail: (value: string) => void; resend: (event: FormEvent<HTMLFormElement>) => void }) { return <><Header eyebrow="Portal de Asociados IIMP" title="El enlace ya no está disponible" description="Este enlace de activación venció o ya fue utilizado." /><div className="mt-7 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900"><AlertCircle className="mb-2 h-5 w-5" />Solicita un nuevo enlace con el correo asociado a tu cuenta.</div><form className="mt-5 space-y-4" onSubmit={props.resend}><label className="block text-sm font-bold text-on-surface-variant" htmlFor="resend-email">Correo asociado<input className="mt-2 h-[52px] w-full rounded-xl border border-outline-variant bg-surface px-4 text-sm font-medium text-on-surface outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20" id="resend-email" type="email" autoComplete="email" value={props.resendEmail} onChange={(event) => props.setResendEmail(event.target.value)} required disabled={props.resending} /></label>{props.resendMessage && <p aria-live="polite" className="text-sm leading-6 text-emerald-800">{props.resendMessage}</p>}<button className="flex h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-on-primary transition hover:brightness-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:opacity-70" type="submit" disabled={props.resending}>{props.resending ? <><LoaderCircle className="h-4 w-4 animate-spin" />Solicitando...</> : <><Send className="h-4 w-4" />Solicitar un nuevo enlace</>}</button></form><Link className="mt-6 inline-block text-sm font-bold text-primary transition hover:text-primary/80" href="/login">Volver al inicio de sesión</Link></>; }

function Header({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) { return <div><img className="mb-7 hidden h-11 w-auto object-contain lg:block" src="/images/logo-iimp.png" alt="Instituto de Ingenieros de Minas del Perú" /><p className="hidden text-[11px] font-bold uppercase tracking-[0.14em] text-primary lg:block">{eyebrow}</p><h1 className="mt-2 text-[30px] font-extrabold leading-tight tracking-tight text-on-surface sm:text-[34px]">{title}</h1><p className="mt-2 max-w-lg text-sm leading-6 text-secondary">{description}</p></div>; }
function Alert({ message }: { message: string }) { return <p aria-live="polite" className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm leading-5 text-red-700"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{message}</p>; }
