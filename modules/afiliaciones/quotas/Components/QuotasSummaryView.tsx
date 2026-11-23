"use client";

import { useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, ChevronRight, CircleCheck, Clock, FileQuestion, Info, RefreshCcw, Users } from "lucide-react";
import { Bar, BarChart, CartesianGrid, LabelList, Legend, Line, LineChart, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Skeleton } from "@/modules/shared/Components/Skeleton";
import type { QuotaDashboardSummary } from "../Models/QuotaAdmin";
import { formatMoney, formatNumber, parseAmount } from "./quotaUi";
import styles from "./quotasDashboard.module.css";

const CURRENT_YEAR = new Date().getFullYear();

type Props = {
  summary: QuotaDashboardSummary | null;
  isLoading: boolean;
  error: string;
  onRetry: () => void;
  onOpenHistory: () => void;
  onOpenIncidences: () => void;
};

function MetricCard({ label, value, hint, icon: Icon, tone = "gold", delay, onClick }: { label: string; value: number; hint: string; icon: typeof Users; tone?: "gold" | "neutral" | "warning"; delay: string; onClick?: () => void }) {
  const iconClass = tone === "warning" ? "bg-amber-50 text-amber-700" : tone === "neutral" ? "bg-slate-100 text-slate-600" : "bg-[#fdfaf5] text-[#a3722a]";
  const content = <div className="flex w-full items-start justify-between gap-3">
    <div>
      <p className="flex items-center gap-1 text-[14px] font-semibold leading-5 text-[#504539]">{label}{onClick && <ChevronRight size={13} className="text-[#A3722A]" />}</p>
      <p className={`${styles.valueMotion} mt-2 text-[30px] font-bold leading-none tracking-tight text-[#1a1c1c] tabular-nums`}>{formatNumber(value)}</p>
    </div>
    <span className={`${styles.iconMotion} flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${iconClass}`}><Icon size={19} strokeWidth={2.2} /></span>
  </div>;
  return onClick
    ? <button type="button" onClick={onClick} title={hint} aria-label={`${label}: ${formatNumber(value)}. ${hint}`} className={`${styles.rise} ${styles.cardMotion} ${delay} flex min-h-[104px] items-center rounded-xl border border-[#E4E2E0] bg-white p-5 text-left`}>{content}</button>
    : <article title={hint} aria-label={`${label}: ${formatNumber(value)}. ${hint}`} className={`${styles.rise} ${styles.cardMotion} ${delay} flex min-h-[104px] items-center rounded-xl border border-[#E4E2E0] bg-white p-5`}>{content}</article>;
}

function CurrencySelector({ value, onChange }: { value: "S/" | "US$"; onChange: (currency: "S/" | "US$") => void }) {
  return <div role="group" aria-label="Moneda del resumen financiero" className="inline-flex rounded-lg border border-[#E4E2E0] bg-[#F9F9F9] p-1">
    {(["S/", "US$"] as const).map((currency) => {
      const active = value === currency;
      return <button key={currency} type="button" aria-pressed={active} onClick={() => onChange(currency)} className={`${styles.segmented} h-8 rounded-md px-3 text-[12px] font-semibold ${active ? "bg-[#7F561E] text-white shadow-sm" : "text-[#5F5E5D] hover:bg-white hover:text-[#7F561E]"}`}>{currency === "S/" ? "S/ Soles" : "US$ Dólares"}</button>;
    })}
  </div>;
}

function AnnualTooltip({ active, payload, label, currency }: { active?: boolean; payload?: Array<{ name?: string; value?: number; color?: string }>; label?: string | number; currency: string }) {
  if (!active || !payload?.length) return null;
  return <div className="rounded-xl border border-[#D4C4B5] bg-white px-3.5 py-3 shadow-lg">
    <p className="text-[12px] font-semibold text-[#504539]">Año {label}</p>
    <div className="mt-2 space-y-1.5">{payload.map((item) => <div key={item.name} className="flex items-center justify-between gap-5 text-[12px]"><span className="flex items-center gap-1.5 text-slate-600"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />{item.name}</span><span className="font-semibold tabular-nums text-slate-800">{formatMoney(String(item.value ?? 0), currency)}</span></div>)}</div>
  </div>;
}

export function QuotasSummaryView({ summary, isLoading, error, onRetry, onOpenHistory, onOpenIncidences }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currency = searchParams.get("currency") === "US$" ? "US$" : "S/";

  const setCurrency = (next: "S/" | "US$") => {
    const params = new URLSearchParams(searchParams.toString());
    if (next === "S/") params.delete("currency"); else params.set("currency", next);
    router.replace(`${pathname}${params.toString() ? `?${params.toString()}` : ""}`);
  };

  const cuota = summary?.cuota;
  const facturado = cuota?.facturadoByCurrency.find((row) => row.currency === currency);
  const pendiente = cuota?.pendienteByCurrency.find((row) => row.currency === currency);
  const registros = (facturado?.count ?? 0) + (pendiente?.count ?? 0);
  const totalAmount = parseAmount(facturado?.amount) + parseAmount(pendiente?.amount);
  const facturadoPercent = totalAmount > 0 ? (parseAmount(facturado?.amount) / totalAmount) * 100 : 0;
  const noDisponible = summary ? summary.universe.noInfo + summary.universe.notFound + summary.universe.failed : 0;

  const yearData = useMemo(() => {
    if (!summary) return [];
    const map = new Map<number, { year: number; facturado: number; pendiente: number }>();
    for (const row of summary.byYear) {
      if (row.concept !== "CUOTA" || row.currency !== currency) continue;
      const current = map.get(row.year) ?? { year: row.year, facturado: 0, pendiente: 0 };
      if (row.accountingStatus === "FACTURADO") current.facturado += parseAmount(row.amount);
      else current.pendiente += parseAmount(row.amount);
      map.set(row.year, current);
    }
    return [...map.values()].sort((a, b) => a.year - b.year);
  }, [summary, currency]);

  const firstYear = yearData[0]?.year ?? CURRENT_YEAR;
  const lastYear = yearData.at(-1)?.year ?? CURRENT_YEAR;
  const currentYearInRange = firstYear <= CURRENT_YEAR && lastYear >= CURRENT_YEAR;

  const categoryData = useMemo(() => {
    if (!summary) return [];
    const total = summary.byCategory.reduce((sum, row) => sum + row.associates, 0);
    return [...summary.byCategory]
      .sort((a, b) => b.associates - a.associates)
      .map((row) => ({ ...row, percent: total > 0 ? (row.associates / total) * 100 : 0, percentLabel: total > 0 ? `${formatNumber(row.associates)} · ${((row.associates / total) * 100).toFixed(1)}%` : formatNumber(row.associates) }));
  }, [summary]);

  const dataEmpty = !isLoading && !error && !summary;

  if (isLoading) return <div className="space-y-5">
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-[112px]" />)}</div>
    <Skeleton className="h-[230px]" />
    <div className="grid gap-5 lg:grid-cols-[3fr_2fr]"><Skeleton className="h-[340px]" /><Skeleton className="h-[340px]" /></div>
    <Skeleton className="h-[52px]" />
  </div>;

  if (error) return <section className="flex min-h-64 flex-col items-center justify-center gap-3 rounded-xl border border-[#E4E2E0] bg-white p-8 text-center shadow-sm"><AlertCircle size={32} className="text-rose-500" /><h2 className="text-lg font-semibold text-[#1a1c1c]">No pudimos cargar el resumen</h2><p className="max-w-md text-sm text-[#5F5E5D]">{error}</p><button type="button" onClick={onRetry} className="inline-flex items-center gap-2 rounded-lg border border-[#D4C4B5] bg-white px-4 py-2 text-sm font-semibold text-[#7F561E] hover:bg-[#fdfaf5]"><RefreshCcw size={15} /> Reintentar</button></section>;

  if (dataEmpty) return <section className="flex min-h-64 flex-col items-center justify-center gap-3 rounded-xl border border-[#E4E2E0] bg-white p-8 text-center shadow-sm"><FileQuestion size={30} className="text-[#A3722A]" /><h2 className="text-lg font-semibold text-[#1a1c1c]">Sin información para mostrar</h2><p className="max-w-md text-sm text-[#5F5E5D]">La última sincronización no devolvió datos para el resumen financiero.</p></section>;

  if (!summary) return null;

  return <div className="space-y-5">
    <section aria-label="Indicadores principales" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <MetricCard label="Consultados" value={summary.universe.total} hint="Universo de asociados incluido en la última sincronización FULL." icon={Users} delay={styles.delay1} />
      <MetricCard label="Con información financiera" value={summary.universe.withFinancialInfo} hint="Asociados con al menos una cuota de membresía registrada." icon={CircleCheck} delay={styles.delay2} />
      <MetricCard label="Con cuotas pendientes" value={summary.universe.withPending} hint="Asociados con al menos una cuota pendiente reportada. No se denomina morosos ni deuda exigible." icon={Clock} tone="warning" delay={styles.delay3} />
      <MetricCard label="Información no disponible" value={noDisponible} hint={`${formatNumber(summary.universe.notFound)} no encontrados · ${formatNumber(summary.universe.noInfo)} sin información · ${formatNumber(summary.universe.failed)} incidencias`} icon={FileQuestion} tone="neutral" delay={styles.delay4} onClick={onOpenIncidences} />
    </section>

    <section className={`${styles.rise} ${styles.delay2} rounded-xl border border-[#E4E2E0] bg-white p-6`}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div><h2 className="text-[19px] font-semibold tracking-tight text-[#1a1c1c]">Resumen financiero de cuotas</h2><p className="mt-1 text-[13px] font-medium text-[#5F5E5D]">Importes y cantidad de cuotas de membresía por estado contable.</p></div>
        <CurrencySelector value={currency} onChange={setCurrency} />
      </div>
      <div className="mt-5 grid grid-cols-1 divide-y divide-[#E4E2E0] rounded-lg border border-[#E4E2E0] sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        <div className="px-5 py-4">
          <p className="text-[13px] font-semibold text-[#504539]">Facturado</p>
          <p className="mt-2 text-[26px] font-bold leading-none tracking-tight text-[#1a1c1c] tabular-nums">{formatMoney(facturado?.amount ?? "0.00", currency)}</p>
          <p className="mt-2 text-[12px] font-medium text-slate-500">{formatNumber(facturado?.count ?? 0)} cuotas</p>
        </div>
        <div className="px-5 py-4">
          <p className="text-[13px] font-semibold text-[#504539]">Pendiente</p>
          <p className="mt-2 text-[26px] font-bold leading-none tracking-tight text-[#1a1c1c] tabular-nums">{formatMoney(pendiente?.amount ?? "0.00", currency)}</p>
          <p className="mt-2 text-[12px] font-medium text-slate-500">{formatNumber(pendiente?.count ?? 0)} cuotas</p>
        </div>
        <div className="px-5 py-4">
          <p className="text-[13px] font-semibold text-[#504539]">Registros</p>
          <p className="mt-2 text-[26px] font-bold leading-none tracking-tight text-[#1a1c1c] tabular-nums">{formatNumber(registros)}</p>
          <p className="mt-2 text-[12px] font-medium text-slate-500">cuotas de membresía</p>
        </div>
      </div>
      {totalAmount > 0 ? <div className="mt-5">
        <div className="flex items-center justify-between gap-3"><p className="text-[12px] font-medium text-[#5F5E5D]">Proporción de importes facturados y pendientes</p><p className="text-[12px] font-semibold tabular-nums text-[#7F561E]">{facturadoPercent.toFixed(1)}% facturado</p></div>
        <div className="mt-2 flex h-[9px] w-full overflow-hidden rounded-full bg-[#F1F0EE]" role="img" aria-label={`Proporción financiera: ${facturadoPercent.toFixed(1)}% facturado y ${(100 - facturadoPercent).toFixed(1)}% pendiente`}>
          <span className={`${styles.barFill} ${styles.shimmer} block bg-[#7F561E]`} style={{ width: `${facturadoPercent}%` }} />
          <span className={`${styles.barFill} block bg-[#D4C4B5]`} style={{ width: `${100 - facturadoPercent}%` }} />
        </div>
        <p className="mt-2 text-[11px] font-medium text-slate-500">La proporción no representa recaudación. Facturado no equivale a pagado y pendiente no equivale a deuda exigible.</p>
      </div> : <p className="mt-5 rounded-lg border border-[#E4E2E0] bg-[#F9F9F9] px-4 py-3 text-[12px] font-medium text-[#5F5E5D]">No hay importes para calcular la proporción en {currency === "S/" ? "soles" : "dólares"}.</p>}
    </section>

    <section className="grid gap-5 lg:grid-cols-[3fr_2fr]">
      <div className={`${styles.rise} ${styles.delay3} rounded-xl border border-[#E4E2E0] bg-white p-5`}>
        <div><h2 className="text-[18px] font-semibold tracking-tight text-[#1a1c1c]">Evolución anual de cuotas</h2><p className="mt-1 text-[12px] font-medium text-[#5F5E5D]">Importe por año según estado contable · {currency === "S/" ? "Soles" : "Dólares"}.</p></div>
        {yearData.length ? <div className="mt-4 h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={yearData} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E4E2E0" />
              <XAxis dataKey="year" axisLine={{ stroke: "#D4C4B5" }} tickLine={false} tick={{ fontSize: 12, fill: "#504539" }} interval={Math.max(0, Math.floor(yearData.length / 8))} dy={6} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "#504539" }} width={62} tickFormatter={(value) => new Intl.NumberFormat("es-PE", { notation: "compact" }).format(Number(value))} />
              <Tooltip content={<AnnualTooltip currency={currency} />} cursor={{ stroke: "#D4C4B5", strokeDasharray: "4 4" }} />
              <Legend verticalAlign="top" align="right" iconType="plainline" wrapperStyle={{ fontSize: 12, color: "#504539", paddingBottom: 8 }} />
              {lastYear > CURRENT_YEAR && <ReferenceArea x1={CURRENT_YEAR + 1} x2={lastYear} fill="#F9F9F9" fillOpacity={0.65} />}
              {currentYearInRange && <ReferenceLine x={CURRENT_YEAR} stroke="#A3722A" strokeDasharray="4 4" label={{ value: "Actual", position: "insideTopRight", fill: "#A3722A", fontSize: 11 }} />}
              <Line type="monotone" dataKey="facturado" name="Facturado" stroke="#7F561E" strokeWidth={2} dot={false} activeDot={{ r: 4 }} isAnimationActive animationDuration={850} animationBegin={100} animationEasing="ease-out" />
              <Line type="monotone" dataKey="pendiente" name="Pendiente" stroke="#C39254" strokeWidth={2} dot={false} activeDot={{ r: 4 }} isAnimationActive animationDuration={850} animationBegin={260} animationEasing="ease-out" />
            </LineChart>
          </ResponsiveContainer>
        </div> : <div className="flex h-[280px] items-center justify-center text-sm font-medium text-[#5F5E5D]">Sin información anual para la moneda seleccionada.</div>}
        <p className="mt-2 text-[11px] font-medium text-slate-500">{lastYear > CURRENT_YEAR ? `Los años posteriores a ${CURRENT_YEAR} son períodos futuros; no se consideran vencidos.` : `El histórico disponible para esta moneda termina en ${lastYear}.`}</p>
      </div>

      <div className={`${styles.rise} ${styles.delay4} rounded-xl border border-[#E4E2E0] bg-white p-5`}>
        <div><h2 className="text-[18px] font-semibold tracking-tight text-[#1a1c1c]">Distribución por categoría</h2><p className="mt-1 text-[12px] font-medium text-[#5F5E5D]">Asociados con información financiera por categoría institucional.</p></div>
        {categoryData.length ? <div className="mt-4 h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={categoryData} layout="vertical" margin={{ top: 4, right: 30, left: 0, bottom: 4 }}>
              <CartesianGrid horizontal={false} stroke="#E4E2E0" />
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="categoryName" width={120} axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "#504539" }} />
              <Tooltip formatter={(value) => [`${formatNumber(Number(value))} asociados`, "Cantidad"]} contentStyle={{ borderRadius: 10, borderColor: "#D4C4B5", fontSize: 12 }} cursor={{ fill: "#F9F9F9" }} />
              <Bar dataKey="associates" name="Asociados" fill="#7F561E" radius={[0, 6, 6, 0]} barSize={14} background={{ fill: "#F1F0EE", radius: 6 }} isAnimationActive animationDuration={800} animationBegin={150} animationEasing="ease-out">
                <LabelList dataKey="percentLabel" position="right" fill="#504539" fontSize={11} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div> : <div className="flex h-[280px] items-center justify-center text-sm font-medium text-[#5F5E5D]">Sin categorías con información financiera.</div>}
        <p className="mt-2 text-[11px] font-medium text-slate-500">La distribución representa asociados y no cambia con la moneda seleccionada.</p>
      </div>
    </section>

    <button type="button" onClick={onOpenHistory} className={`${styles.rise} ${styles.delay5} group flex w-full flex-col gap-2 rounded-xl border border-[#E4E2E0] bg-white px-4 py-3 text-left transition-colors hover:border-[#D4C4B5] hover:bg-[#FDFBF8] sm:flex-row sm:items-center sm:justify-between sm:px-5 sm:py-3.5`}>
      <span className="flex flex-wrap items-center gap-2 text-[12px] font-medium text-[#504539] sm:text-[13px]"><Info size={16} className="text-[#A3722A]" /> <span>Cuotas hist�ricas: <strong className="font-semibold tabular-nums text-[#1a1c1c]">{formatNumber(summary.records.quotas)} registros</strong></span></span>
      <span className="inline-flex shrink-0 items-center gap-1 text-[12px] font-semibold text-[#7F561E]">Ver hist�rico <ChevronRight size={15} className="transition-transform group-hover:translate-x-0.5" /></span>
    </button>
  </div>;
}

