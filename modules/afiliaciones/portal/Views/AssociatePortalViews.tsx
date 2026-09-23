import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  CalendarClock,
  CheckCircle2,
  CreditCard,
  FileText,
  Gift,
  IdCard,
  LifeBuoy,
  ShieldCheck,
  UserRound,
  WalletCards,
} from "lucide-react";

import type { CurrentUserDTO } from "@/modules/auth/context/types";

const unavailable = "No disponible";

const fullName = (user: CurrentUserDTO) =>
  [
    user.person.firstName,
    user.person.paternalLastName,
    user.person.maternalLastName,
  ]
    .filter(Boolean)
    .join(" ");

const membershipType = (user: CurrentUserDTO) => {
  if (user.role.slug === "ASOCIADO_ESTUDIANTE") {
    return "Asociado estudiante";
  }

  if (user.role.slug === "ASOCIADO_ACTIVO") {
    return "Asociado activo";
  }

  return unavailable;
};

const initials = (user: CurrentUserDTO) => {
  const names = [
    user.person.firstName,
    user.person.paternalLastName,
  ].filter(Boolean);

  if (!names.length) return "IIMP";

  return names
    .map((item) => item?.charAt(0).toUpperCase())
    .join("")
    .slice(0, 2);
};

/* =========================================================
   SHARED
========================================================= */

function Surface({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={[
        "rounded-2xl border border-slate-200/80 bg-white shadow-sm",
        className,
      ].join(" ")}
    >
      {children}
    </section>
  );
}

function SectionTitle({
  icon: Icon,
  title,
  description,
}: {
  icon?: React.ElementType;
  title: string;
  description?: string;
}) {
  return (
    <div>
      <div className="flex items-center gap-2">
        {Icon && <Icon size={18} className="text-[#B8892D]" />}
        <h2 className="text-base font-black text-slate-900">{title}</h2>
      </div>

      {description && (
        <p className="mt-1 text-sm text-slate-500">{description}</p>
      )}
    </div>
  );
}

function Info({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  const isUnavailable = !value || value === unavailable;

  return (
    <div>
      <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">
        {label}
      </p>

      <p
        className={[
          "mt-1 text-sm font-semibold",
          isUnavailable ? "text-slate-400" : "text-slate-800",
        ].join(" ")}
      >
        {value || unavailable}
      </p>
    </div>
  );
}

function StatusPill({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
      <CheckCircle2 size={13} />
      {children}
    </span>
  );
}

/* =========================================================
   HOME
========================================================= */

export function AssociateHomeView({
  user,
}: {
  user: CurrentUserDTO;
}) {
  const name = fullName(user);
  const firstName = user.person.firstName || name || "Asociado";

  return (
    <div className="w-full space-y-5">
      {/* HERO / BIENVENIDA */}
      <Surface className="overflow-hidden">
        <div className="relative">
          <div className="absolute inset-y-0 right-0 hidden w-[58%] bg-gradient-to-l from-[#F4E7CC] via-[#FBF7EF]/70 to-transparent lg:block" />

          <div className="relative z-10 flex flex-col gap-6 px-6 py-7 lg:flex-row lg:items-center lg:justify-between lg:px-8">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-[#18385D] text-xl font-black text-white shadow-sm">
                {initials(user)}
              </div>

              <div>
                <p className="text-sm font-bold text-[#A67C00]">
                  Bienvenido a tu espacio IIMP
                </p>

                <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">
                  Hola, {firstName}
                </h1>

                <p className="mt-1 text-sm text-slate-500">
                  Gestiona tu membresía, beneficios y servicios desde un solo lugar.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <StatusPill>Membresía activa</StatusPill>

              <Link
                href="/intranet/mi-cuenta/perfil"
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#B8892D] px-4 text-sm font-bold text-white shadow-sm transition hover:bg-[#9E7425]"
              >
                <UserRound size={16} />
                Ver mi perfil
              </Link>
            </div>
          </div>
        </div>
      </Surface>

      {/* RESUMEN */}
      <Surface className="p-6">
        <SectionTitle
          icon={ShieldCheck}
          title="Resumen de mi membresía"
          description="Información principal asociada a tu cuenta institucional."
        />

        <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MembershipMetric
            icon={BadgeCheck}
            label="Estado"
            value="Activo"
            helper="Membresía vigente"
          />

          <MembershipMetric
            icon={UserRound}
            label="Tipo de asociado"
            value={membershipType(user)}
            helper="Categoría actual"
          />

          <MembershipMetric
            icon={IdCard}
            label="Código de asociado"
            value={unavailable}
            helper="Código institucional"
          />

          <MembershipMetric
            icon={CalendarClock}
            label="Miembro desde"
            value={unavailable}
            helper="Fecha de incorporación"
          />
        </div>
      </Surface>

      {/* ACCESOS PRINCIPALES */}
      <div>
        <div className="mb-3 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-lg font-black text-slate-900">
              Mi cuenta
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Accede rápidamente a tus principales servicios como asociado.
            </p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <PortalAction
            href="/intranet/mi-cuenta/membresia"
            icon={BadgeCheck}
            title="Mi membresía"
            description="Consulta tu estado y datos de afiliación."
          />

          <PortalAction
            href="/intranet/mi-cuenta/pagos"
            icon={WalletCards}
            title="Pagos"
            description="Revisa pagos y comprobantes disponibles."
          />

          <PortalAction
            href="/intranet/mi-cuenta/beneficios"
            icon={Gift}
            title="Beneficios"
            description="Conoce los beneficios disponibles para ti."
          />

          <PortalAction
            href="/intranet/mi-cuenta/eventos"
            icon={CalendarClock}
            title="Eventos"
            description="Consulta actividades y eventos del IIMP."
          />
        </div>
      </div>

      {/* SEGUNDA FILA */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Surface className="p-5 lg:col-span-2">
          <SectionTitle
            icon={Gift}
            title="Beneficios destacados"
            description="Los beneficios disponibles para tu membresía aparecerán aquí."
          />

          <EmptyMini
            title="Próximamente"
            description="Estamos preparando la información de beneficios asociados a tu membresía."
          />
        </Surface>

        <Surface className="p-5">
          <SectionTitle
            icon={CalendarClock}
            title="Próxima renovación"
          />

          <div className="mt-5">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Fecha
            </p>

            <p className="mt-1 text-base font-bold text-slate-400">
              {unavailable}
            </p>

            <div className="my-4 h-px bg-slate-100" />

            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Importe
            </p>

            <p className="mt-1 text-base font-bold text-slate-400">
              {unavailable}
            </p>

            <Link
              href="/intranet/mi-cuenta/membresia"
              className="mt-5 inline-flex items-center gap-1.5 text-sm font-bold text-[#A67C00] hover:underline"
            >
              Ver mi membresía
              <ArrowRight size={14} />
            </Link>
          </div>
        </Surface>
      </div>

      {/* SOPORTE */}
      <Surface className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#F8F1E4] text-[#A67C00]">
            <LifeBuoy size={19} />
          </div>

          <div>
            <h3 className="font-black text-slate-900">
              ¿Necesitas ayuda?
            </h3>

            <p className="mt-1 text-sm text-slate-500">
              Comunícate con el área de Asociados para resolver cualquier consulta.
            </p>
          </div>
        </div>

        <Link
          href="/intranet/mi-cuenta/soporte"
          className="inline-flex items-center gap-2 text-sm font-bold text-[#A67C00]"
        >
          Ir a soporte
          <ArrowRight size={15} />
        </Link>
      </Surface>
    </div>
  );
}

function MembershipMetric({
  icon: Icon,
  label,
  value,
  helper,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  helper: string;
}) {
  const unavailableValue = value === unavailable;

  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4">
      <div className="mb-4 flex h-9 w-9 items-center justify-center rounded-xl bg-[#F6EEDC] text-[#A67C00]">
        <Icon size={18} />
      </div>

      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
        {label}
      </p>

      <p
        className={[
          "mt-1 truncate text-base font-black",
          unavailableValue ? "text-slate-400" : "text-slate-900",
        ].join(" ")}
      >
        {value}
      </p>

      <p className="mt-1 text-xs text-slate-400">{helper}</p>
    </div>
  );
}

function PortalAction({
  href,
  icon: Icon,
  title,
  description,
}: {
  href: string;
  icon: React.ElementType;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-[#D9BF89] hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#F8F1E4] text-[#A67C00] transition group-hover:bg-[#B8892D] group-hover:text-white">
          <Icon size={19} />
        </div>

        <ArrowRight
          size={17}
          className="text-slate-300 transition group-hover:translate-x-1 group-hover:text-[#A67C00]"
        />
      </div>

      <h3 className="mt-5 font-black text-slate-900">
        {title}
      </h3>

      <p className="mt-1.5 text-sm leading-5 text-slate-500">
        {description}
      </p>
    </Link>
  );
}

function EmptyMini({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="mt-5 rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-5 py-6 text-center">
      <p className="text-sm font-bold text-slate-700">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
        {description}
      </p>
    </div>
  );
}

/* =========================================================
   PROFILE
========================================================= */

export function ProfileView({
  user,
}: {
  user: CurrentUserDTO;
}) {
  return (
    <Base
      title="Mi perfil"
      description="Consulta la información registrada en tu cuenta."
      icon={UserRound}
    >
      <div className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
        <Info label="Nombres" value={fullName(user)} />
        <Info
          label="Documento"
          value={user.person.documentNumber || unavailable}
        />
        <Info
          label="Correo principal"
          value={user.email || unavailable}
        />
        <Info label="Teléfono" value={unavailable} />
        <Info label="Dirección" value={unavailable} />
        <Info label="Formación" value={unavailable} />
        <Info label="Empresa / cargo" value={unavailable} />
      </div>
    </Base>
  );
}

/* =========================================================
   MEMBERSHIP
========================================================= */

export function MembershipView({
  user,
}: {
  user: CurrentUserDTO;
}) {
  return (
    <Base
      title="Mi membresía"
      description="Estado y datos disponibles de tu membresía IIMP."
      icon={BadgeCheck}
    >
      <div className="grid gap-x-8 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
        <Info label="Tipo" value={membershipType(user)} />
        <Info label="Código" value={unavailable} />
        <Info label="Estado" value="Activo" />
        <Info label="Fecha de ingreso" value={unavailable} />
        <Info label="Vigencia" value={unavailable} />
        <Info label="Próxima renovación" value={unavailable} />
      </div>
    </Base>
  );
}

/* =========================================================
   PLACEHOLDERS
========================================================= */

export function PlaceholderView({
  title,
  description,
  icon,
}: {
  title: string;
  description: string;
  icon:
    | "payments"
    | "benefits"
    | "events"
    | "documents"
    | "support";
}) {
  const Icon =
    icon === "payments"
      ? CreditCard
      : icon === "benefits"
        ? Gift
        : icon === "events"
          ? CalendarClock
          : icon === "documents"
            ? FileText
            : LifeBuoy;

  return (
    <Base
      title={title}
      description={description}
      icon={Icon}
    >
      <div className="flex min-h-56 flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-5 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#F8F1E4] text-[#A67C00]">
          <Icon size={23} />
        </div>

        <p className="mt-4 text-sm font-bold text-slate-700">
          No hay información disponible.
        </p>

        {icon === "support" ? (
          <p className="mt-2 max-w-md text-sm leading-5 text-slate-500">
            Contacta al área de Asociados mediante los canales institucionales.
          </p>
        ) : (
          <p className="mt-2 text-sm text-slate-500">
            La información de esta sección aparecerá aquí cuando esté disponible.
          </p>
        )}
      </div>
    </Base>
  );
}

/* =========================================================
   BASE
========================================================= */

function Base({
  title,
  description,
  icon: Icon,
  children,
}: {
  title: string;
  description: string;
  icon?: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <div className="w-full space-y-5">
      <header>
        <p className="text-sm font-bold text-[#A67C00]">
          Mi cuenta
        </p>

        <h1 className="mt-1 text-3xl font-black tracking-tight text-slate-900">
          {title}
        </h1>

        <p className="mt-1 text-sm text-slate-500">
          {description}
        </p>
      </header>

      <Surface className="p-6">
        <div className="mb-5 border-b border-slate-100 pb-4">
          <SectionTitle
            icon={Icon}
            title={title}
          />
        </div>

        {children}
      </Surface>
    </div>
  );
}