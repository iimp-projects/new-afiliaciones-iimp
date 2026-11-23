"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, CheckCircle2, ChevronDown, FileQuestion, FileSearch, RefreshCcw, X } from "lucide-react";
import { Skeleton } from "@/modules/shared/Components/Skeleton";
import { AppSelect } from "@/modules/shared/Components/Form";
import type { QuotaAssociateDetail } from "../Models/QuotaAdmin";
import { CategoryBadge } from "./CategoryBadge";
import { accountingStatusLabel, accountingStatusTone, coverageLabel, coverageTone, errorCodeLabel, formatDate, formatDateTime, formatMoney, formatNumber, initials, isFutureYear, membershipLabel, parseAmount, quotaPeriodLabel } from "./quotaUi";
import styles from "./quotasDrawer.module.css";

type Currency = "S/" | "US$";
type HistoryStatus = "ALL" | "FACTURADO" | "PENDIENTE";
type PresenceFilter = "ALL" | "CURRENT" | "ABSENT";

const historyStatusOptions = [{ value: "ALL", label: "Todos" }, { value: "FACTURADO", label: "Facturado" }, { value: "PENDIENTE", label: "Pendiente" }];
const presenceOptions = [{ value: "ALL", label: "Todas" }, { value: "CURRENT", label: "Vigentes" }, { value: "ABSENT", label: "Ausentes" }];

function detailCoverageLabel(status: string | null | undefined): string {
  if (status === "NOT_FOUND") return "No encontrado en el SIE";
  if (status === "NO_DATA") return "Sin información disponible";
  if (status === "FAILED") return "Error de sincronización";
  return coverageLabel(status);
}

type HistoryRow = QuotaAssociateDetail["history"][number];

/** Una cuota que el SIE reporta pendiente en un año futuro es el próximo pago, no una deuda. */
function isUpcomingRow(row: HistoryRow): boolean {
  return row.accountingStatus === "PENDIENTE" && isFutureYear(row.year);
}

function rowStatusLabel(row: HistoryRow): string {
  return isUpcomingRow(row) ? "Próxima cuota" : accountingStatusLabel(row.accountingStatus);
}

function rowStatusTone(row: HistoryRow): string {
  return isUpcomingRow(row) ? "border-[#E8D09E] bg-[#FDFBF8] text-[#7F561E]" : accountingStatusTone(row.accountingStatus);
}

function CurrencySelector({ value, onChange }: { value: Currency; onChange: (currency: Currency) => void }) {
  return <div role="group" aria-label="Moneda del resumen" className="inline-flex rounded-lg border border-[#E4E2E0] bg-[#F9F9F9] p-1">
    {(["S/", "US$"] as const).map((currency) => <button key={currency} type="button" aria-pressed={value === currency} onClick={() => onChange(currency)} className={`h-8 rounded-md px-3 text-[12px] font-semibold transition-colors ${value === currency ? "bg-[#7F561E] text-white shadow-sm" : "text-[#5F5E5D] hover:bg-white hover:text-[#7F561E]"}`}>{currency === "S/" ? "S/ Soles" : "US$ Dólares"}</button>)}
  </div>;
}

function FinancialEmptyState({ kind, detail }: { kind: "NOT_FOUND" | "NO_DATA" | "FAILED"; detail: QuotaAssociateDetail }) {
  const config = kind === "NOT_FOUND"
    ? { icon: FileSearch, title: "Información financiera no disponible", description: "No se encontró información de este asociado en el SIE. No es posible determinar su situación económica.", state: "No encontrado en el SIE" }
    : kind === "NO_DATA"
      ? { icon: FileQuestion, title: "Sin información de cuotas disponible", description: "El SIE respondió correctamente, pero no proporcionó registros de cuotas para este asociado.", state: "Sin información disponible" }
      : { icon: AlertTriangle, title: "No se pudo actualizar la información financiera", description: "La consulta más reciente no pudo completarse. No se muestran importes para evitar interpretaciones incorrectas.", state: "Error de sincronización" };
  const Icon = config.icon;
  const errorCode = detail.synchronization.errorCode;
  return <section className={`${styles.section} ${styles.delay1} rounded-xl border border-[#E4E2E0] bg-[#FFFEFC] p-8 text-center`}>
    <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#FDFBF8] text-[#A3722A]"><Icon size={25} strokeWidth={2} /></span>
    <h3 className="mt-4 text-[18px] font-semibold text-[#1a1c1c]">{config.title}</h3>
    <p className="mx-auto mt-2 max-w-lg text-[13px] font-medium leading-5 text-[#5F5E5D]">{config.description}</p>
    <span className={`mt-4 inline-flex rounded-md px-2.5 py-1 text-[11px] font-semibold ${coverageTone(detail.synchronization.status)}`}>{config.state}</span>
    {errorCode && <details className="mx-auto mt-4 max-w-lg text-left"><summary className="cursor-pointer text-center text-[11px] font-semibold text-[#7F561E]">Ver detalle técnico</summary><p className="mt-2 rounded-lg border border-[#E4E2E0] bg-white p-3 text-[11px] font-medium text-slate-600">{errorCodeLabel(errorCode)} · <span className="font-mono text-[10px] text-slate-400">{errorCode}</span></p></details>}
  </section>;
}

function SectionTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return <div><h3 className="text-[18px] font-semibold tracking-tight text-[#1a1c1c]">{title}</h3>{subtitle && <p className="mt-1 text-[12px] font-medium text-[#5F5E5D]">{subtitle}</p>}</div>;
}

export function QuotasAssociateDrawer({ personId, onClose }: { personId: number | null; onClose: () => void }) {
  const [mounted, setMounted] = useState(false);
  const [detail, setDetail] = useState<QuotaAssociateDetail | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [currency, setCurrency] = useState<Currency>("S/");
  const [yearFilter, setYearFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState<HistoryStatus>("ALL");
  const [presenceFilter, setPresenceFilter] = useState<PresenceFilter>("ALL");
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [showAllYears, setShowAllYears] = useState(false);
  const [closing, setClosing] = useState(false);
  const [showTechnical, setShowTechnical] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const panelRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const closingRef = useRef(false);
  const onCloseRef = useRef(onClose);

  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  const requestClose = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    setClosing(true);
    window.setTimeout(() => onCloseRef.current(), 200);
  }, []);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (personId == null) return;
    const controller = new AbortController();
    setDetail(null);
    setError("");
    setIsLoading(true);
    setCurrency("S/");
    setYearFilter("ALL");
    setStatusFilter("ALL");
    setPresenceFilter("ALL");
    setExpandedRow(null);
    setShowAllYears(false);
    setShowTechnical(false);
    setClosing(false);
    closingRef.current = false;
    void (async () => {
      try {
        const response = await fetch(`/api/afiliaciones/quotas/associates/${personId}`, { signal: controller.signal, cache: "no-store" });
        const body = await response.json();
        if (!response.ok) throw new Error(body?.message ?? "No se pudo cargar el detalle.");
        setDetail(body.data);
      } catch (cause) {
        if ((cause as Error)?.name !== "AbortError") setError("No pudimos cargar el detalle del asociado. Inténtalo nuevamente.");
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    })();
    return () => controller.abort();
  }, [personId, reloadToken]);

  useEffect(() => {
    if (personId == null) return;
    previousFocus.current = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const timer = window.setTimeout(() => closeRef.current?.focus(), 60);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); requestClose(); return; }
      if (event.key !== "Tab" || !panelRef.current) return;
      const focusable = Array.from(panelRef.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')).filter((element) => element.offsetParent !== null);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocus.current?.focus?.();
    };
  }, [personId, requestClose]);

  const quotaHistory = useMemo(() => detail?.history.filter((row) => row.concept === "CUOTA") ?? [], [detail]);
  const currencyHistory = useMemo(() => quotaHistory.filter((row) => row.currency === currency), [quotaHistory, currency]);
  const hasQuotaHistory = quotaHistory.length > 0;
  const cuota = detail?.summary.cuota;
  const facturado = cuota?.facturadoByCurrency.find((row) => row.currency === currency);
  const pendiente = cuota?.pendienteByCurrency.find((row) => row.currency === currency);
  const facturadoCount = facturado?.count ?? 0;
  const pendienteCount = pendiente?.count ?? 0;
  const totalCount = currencyHistory.length;
  const totalAmount = parseAmount(facturado?.amount) + parseAmount(pendiente?.amount);
  const facturadoPercent = totalAmount > 0 ? (parseAmount(facturado?.amount) / totalAmount) * 100 : 0;
  const hasCurrencyData = Boolean(facturado || pendiente) || currencyHistory.length > 0;
  const coverage = detail?.synchronization.status ?? null;
  const hasRecentError = hasQuotaHistory && (coverage === "NOT_FOUND" || coverage === "FAILED");
  const pendingYears = useMemo(() => [...new Set(currencyHistory.filter((row) => row.accountingStatus === "PENDIENTE" && !isFutureYear(row.year)).map((row) => row.year))].sort((a, b) => a - b), [currencyHistory]);
  const upcomingQuotas = useMemo(() => currencyHistory
    .filter((row) => row.accountingStatus === "PENDIENTE" && isFutureYear(row.year))
    .sort((a, b) => a.year - b.year || (a.quotaNumber ?? 0) - (b.quotaNumber ?? 0)), [currencyHistory]);
  const availableYears = useMemo(() => [...new Set(currencyHistory.map((row) => row.year))].sort((a, b) => b - a), [currencyHistory]);
  const visiblePendingYears = showAllYears ? pendingYears : pendingYears.slice(0, 8);
  const filteredHistory = useMemo(() => currencyHistory
    .filter((row) => yearFilter === "ALL" || String(row.year) === yearFilter)
    .filter((row) => statusFilter === "ALL" || row.accountingStatus === statusFilter)
    .filter((row) => presenceFilter === "ALL" || (presenceFilter === "CURRENT" ? row.isPresentInLastSuccessfulSync : !row.isPresentInLastSuccessfulSync))
    .sort((a, b) => b.year - a.year || (b.quotaNumber ?? 0) - (a.quotaNumber ?? 0)), [currencyHistory, yearFilter, statusFilter, presenceFilter]);
  const emptyKind: "NOT_FOUND" | "NO_DATA" | "FAILED" | null = !detail ? null
    : !hasQuotaHistory && coverage === "NOT_FOUND" ? "NOT_FOUND"
      : !hasQuotaHistory && coverage === "FAILED" ? "FAILED"
        : !hasQuotaHistory ? "NO_DATA" : null;

  if (personId == null || !mounted) return null;

  return createPortal(<div className={`${styles.overlay} ${closing ? styles.overlayClosing : ""} fixed inset-0 z-[200] flex justify-end bg-slate-950/45 backdrop-blur-[2px]`} onMouseDown={(event) => { if (event.target === event.currentTarget) requestClose(); }}>
    <aside ref={panelRef} role="dialog" aria-modal="true" aria-labelledby="quota-drawer-title" className={`${styles.panel} ${closing ? styles.panelClosing : ""} flex h-full w-full max-w-[1040px] flex-col overflow-hidden bg-[#F9F9F9] shadow-2xl`}>
      <header className="z-20 flex items-start justify-between gap-4 border-b border-[#E4E2E0] bg-white px-4 py-4 sm:px-6">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#FDFBF8] text-base font-semibold text-[#7F561E]">{detail ? initials(detail.identity.fullName) : <span className="h-6 w-6 animate-pulse rounded-full bg-[#E8D09E]" />}</span>
          <div className="min-w-0">
            <h2 id="quota-drawer-title" className="truncate text-[24px] font-semibold leading-tight tracking-tight text-[#1a1c1c]">{detail?.identity.fullName ?? "Cargando asociado…"}</h2>
            <p className="mt-1 truncate text-[12px] font-medium text-[#5F5E5D]">{detail?.identity.institutionalCode ? `Código ${detail.identity.institutionalCode}` : "Sin código institucional"}{detail ? ` · ${detail.identity.documentType} ${detail.identity.documentNumber ?? "—"}` : ""}</p>
            {detail && <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <CategoryBadge code={detail.identity.categoryCode} name={detail.identity.categoryName} />
              {detail.identity.membershipStatus && membershipLabel(detail.identity.membershipStatus) !== (detail.identity.categoryName ?? "") && <span className="rounded-md bg-[#F9F9F9] px-2 py-1 text-[11px] font-semibold text-[#504539]">{membershipLabel(detail.identity.membershipStatus)}</span>}
              <span className={`rounded-md px-2 py-1 text-[10px] font-semibold ${coverageTone(coverage)}`}>{detailCoverageLabel(coverage)}</span>
            </div>}
          </div>
        </div>
        <button ref={closeRef} type="button" onClick={requestClose} aria-label="Cerrar detalle" className="rounded-xl p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"><X size={20} /></button>
      </header>

      <div className="flex-1 overflow-y-auto overflow-x-hidden px-4 py-5 sm:px-6">
        {isLoading && <div className="space-y-4"><Skeleton className="h-52" /><Skeleton className="h-14" /><Skeleton className="h-80" /></div>}
        {error && <div className="flex flex-col items-center gap-3 rounded-xl border border-rose-100 bg-white p-8 text-center"><AlertTriangle size={30} className="text-rose-500" /><p className="text-sm font-semibold text-slate-700">{error}</p><button type="button" onClick={() => { setError(""); setReloadToken((value) => value + 1); }} className="rounded-lg border border-[#E4E2E0] bg-white px-4 py-2 text-sm font-semibold text-[#7F561E] hover:bg-[#FDFBF8]"><RefreshCcw size={14} className="mr-1 inline" /> Reintentar</button></div>}
        {detail && !isLoading && !error && <div className="space-y-5">
          {hasRecentError && <div className={`${styles.section} flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50/70 p-3.5 text-[12px] font-medium text-amber-900`}><AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-600" /><p>Se muestra la última información disponible. La consulta más reciente no pudo completarse ({detailCoverageLabel(coverage)}).</p></div>}

          {emptyKind ? <FinancialEmptyState kind={emptyKind} detail={detail} /> : <>
            <section className={`${styles.section} ${styles.delay1} rounded-xl border border-[#E4E2E0] bg-white p-5`}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><SectionTitle title="Resumen financiero" subtitle="Cuotas de membresía de la moneda seleccionada." /><CurrencySelector value={currency} onChange={setCurrency} /></div>
              <div key={currency} className={`${styles.swap} mt-4`}>
                {hasCurrencyData ? <>
                  <div className="grid grid-cols-1 divide-y divide-[#E4E2E0] rounded-lg border border-[#E4E2E0] sm:grid-cols-3 sm:divide-x sm:divide-y-0">
                    <div className="px-4 py-4"><p className="text-[13px] font-semibold text-[#504539]">Cuotas facturadas</p><p className="mt-2 text-[26px] font-semibold leading-none tracking-tight text-[#1a1c1c] tabular-nums">{formatMoney(facturado?.amount ?? "0.00", currency)}</p><p className="mt-2 text-[12px] font-medium text-[#5F5E5D]">{formatNumber(facturadoCount)} cuotas</p></div>
                    <div className="px-4 py-4"><p className="text-[13px] font-semibold text-[#504539]">Cuotas pendientes</p><p className="mt-2 text-[26px] font-semibold leading-none tracking-tight text-[#1a1c1c] tabular-nums">{formatMoney(pendiente?.amount ?? "0.00", currency)}</p><p className="mt-2 text-[12px] font-medium text-[#5F5E5D]">{formatNumber(pendienteCount)} cuotas</p></div>
                    <div className="px-4 py-4"><p className="text-[13px] font-semibold text-[#504539]">Total de cuotas</p><p className="mt-2 text-[26px] font-semibold leading-none tracking-tight text-[#1a1c1c] tabular-nums">{formatNumber(totalCount)}</p><p className="mt-2 text-[12px] font-medium text-[#5F5E5D]">registros en {currency}</p></div>
                  </div>
                  {totalAmount > 0 && <div className="mt-4"><div className="flex items-center justify-between gap-3"><p className="text-[12px] font-medium text-[#5F5E5D]">Proporción de importes facturados y pendientes</p><p className="text-[12px] font-semibold tabular-nums text-[#7F561E]">{facturadoPercent.toFixed(1)}% facturado</p></div><div className="mt-2 flex h-[8px] w-full overflow-hidden rounded-full bg-[#F1F0EE]" role="img" aria-label={`${facturadoPercent.toFixed(1)}% facturado y ${(100 - facturadoPercent).toFixed(1)}% pendiente`}><span className="block bg-[#7F561E]" style={{ width: `${facturadoPercent}%` }} /><span className="block bg-[#D4C4B5]" style={{ width: `${100 - facturadoPercent}%` }} /></div></div>}
                </> : <p className="rounded-lg border border-[#E4E2E0] bg-[#F9F9F9] px-4 py-3 text-[12px] font-medium text-[#5F5E5D]">Sin cuotas registradas en {currency === "S/" ? "soles" : "dólares"} para este asociado.</p>}
                <p className="mt-3 text-[11px] font-medium text-[#827568]">Facturado no equivale a pagado. Pendiente no equivale automáticamente a deuda exigible.</p>
              </div>
            </section>

            {upcomingQuotas.length > 0 && <section className={`${styles.section} ${styles.delay2} rounded-xl border border-[#E8D09E] bg-[#FDFBF8] px-4 py-3`}>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><p className="text-[13px] font-semibold text-[#504539]">Próxima cuota a pagar</p><div className="flex flex-wrap items-center gap-1.5">{upcomingQuotas.map((row, index) => <span key={`up-${row.year}-${row.quotaNumber ?? index}`} className="rounded-md border border-[#E8D09E] bg-white px-2.5 py-1 text-[11px] font-semibold text-[#7F561E]">{row.year} · {formatMoney(row.amount, row.currency)} · {quotaPeriodLabel(row)}</span>)}</div></div>
              <p className="mt-1.5 text-[11px] font-medium text-[#827568]">El SIE la reporta como PENDIENTE, pero corresponde a un período futuro: no se cuenta como cuota pendiente.</p>
            </section>}

            <section className={`${styles.section} ${styles.delay2} rounded-xl border border-[#E4E2E0] bg-white px-4 py-3`}>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><p className="text-[13px] font-semibold text-[#504539]">Años pendientes</p>{pendingYears.length > 0 ? <div className="flex flex-wrap items-center gap-1.5">{visiblePendingYears.map((year) => <span key={year} title={isFutureYear(year) ? "Período futuro" : `Período ${year}`} className={`rounded-md px-2.5 py-1 text-[11px] font-semibold ${isFutureYear(year) ? "border border-dashed border-[#D4C4B5] bg-slate-50 text-slate-500" : "bg-[#FDFBF8] text-[#7F561E]"}`}>{year}{isFutureYear(year) ? " · futuro" : ""}</span>)}{pendingYears.length > 8 && <button type="button" onClick={() => setShowAllYears((value) => !value)} className="rounded-md px-2 py-1 text-[11px] font-semibold text-[#7F561E] hover:bg-[#FDFBF8]">{showAllYears ? "Ver menos" : `+${pendingYears.length - 8} años`}</button>}</div> : <p className="text-[12px] font-medium text-[#5F5E5D]">Sin cuotas pendientes reportadas.</p>}</div>
            </section>

            <section className={`${styles.section} ${styles.delay3} overflow-hidden rounded-xl border border-[#E4E2E0] bg-white`}>
              <div className="flex flex-col gap-3 border-b border-[#F1F0EE] px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                <SectionTitle title="Histórico de cuotas" subtitle={`Registros de membresía en ${currency}.`} />
                <span className="w-fit rounded-md bg-[#F9F9F9] px-2.5 py-1 text-[10px] font-semibold text-[#504539]">{formatNumber(currencyHistory.length)} registros</span>
              </div>
              {currencyHistory.length === 0 ? <p className="px-4 py-8 text-center text-[12px] font-medium text-[#5F5E5D]">Sin cuotas registradas en {currency}.</p> : <>
                <div className="flex flex-wrap items-end gap-2 border-b border-[#F1F0EE] px-4 py-3">
                  <label className="block text-[10px] font-semibold text-[#827568]">Año<AppSelect aria-label="Filtrar por año" value={yearFilter} options={[{ value: "ALL", label: "Todos" }, ...availableYears.map((year) => ({ value: String(year), label: String(year) }))]} onChange={setYearFilter} searchable portal className="mt-1 min-w-[105px]" /></label>
                  <label className="block text-[10px] font-semibold text-[#827568]">Estado<AppSelect aria-label="Filtrar por estado" value={statusFilter} options={historyStatusOptions} onChange={(value) => setStatusFilter(value as HistoryStatus)} searchable portal className="mt-1 min-w-[125px]" /></label>
                  <label className="block text-[10px] font-semibold text-[#827568]">Presencia<AppSelect aria-label="Filtrar por presencia" value={presenceFilter} options={presenceOptions} onChange={(value) => setPresenceFilter(value as PresenceFilter)} searchable portal className="mt-1 min-w-[115px]" /></label>
                  {(yearFilter !== "ALL" || statusFilter !== "ALL" || presenceFilter !== "ALL") && <button type="button" onClick={() => { setYearFilter("ALL"); setStatusFilter("ALL"); setPresenceFilter("ALL"); }} className="h-8 rounded-md border border-[#E4E2E0] px-2 text-[11px] font-semibold text-[#7F561E] hover:bg-[#FDFBF8]">Limpiar</button>}
                </div>
                <div key={`${currency}-${yearFilter}-${statusFilter}-${presenceFilter}`} className={styles.swap}>
                  <div className="hidden md:block">
                    <table className="w-full table-fixed text-left text-[12px]"><colgroup><col style={{ width: "8%" }} /><col style={{ width: "8%" }} /><col style={{ width: "24%" }} /><col style={{ width: "17%" }} /><col style={{ width: "15%" }} /><col style={{ width: "19%" }} /><col style={{ width: "9%" }} /></colgroup><thead className="border-b border-[#F1F0EE] bg-[#FAFAF8] text-[10px] font-semibold text-[#827568]"><tr><th className="px-3 py-2.5">Año</th><th className="px-3 py-2.5">N.º</th><th className="px-3 py-2.5">Período</th><th className="px-3 py-2.5 text-right">Importe</th><th className="px-3 py-2.5">Estado</th><th className="px-3 py-2.5">Comprobante</th><th className="px-3 py-2.5" /></tr></thead><tbody>{filteredHistory.map((row, index) => {
                      const key = `${row.year}-${row.quotaNumber ?? "ins"}-${row.currency}-${index}`;
                      const expanded = expandedRow === key;
                      return <Fragment key={key}><tr className="border-b border-[#F5F3EF] last:border-0"><td className="px-3 py-2.5 font-semibold text-[#1a1c1c]">{row.year}</td><td className="px-3 py-2.5 text-[#5F5E5D]">{row.quotaNumber ?? "—"}</td><td className="px-3 py-2.5 text-[11px] text-[#5F5E5D]">{quotaPeriodLabel(row)}</td><td className="px-3 py-2.5 text-right font-semibold tabular-nums text-[#1a1c1c]">{formatMoney(row.amount, row.currency)}</td><td className="px-3 py-2.5"><span className={`inline-flex whitespace-nowrap rounded-md px-2 py-1 text-[10px] font-semibold ${rowStatusTone(row)}`}>{rowStatusLabel(row)}</span></td><td className="truncate px-3 py-2.5 text-[11px] text-[#5F5E5D]">{row.receiptSerie || row.receiptNumber ? `${row.receiptSerie ?? ""} ${row.receiptNumber ?? ""}`.trim() : "—"}</td><td className="px-3 py-2.5 text-right"><button type="button" aria-expanded={expanded} aria-label={`Ver detalle de la cuota ${row.year}`} onClick={() => setExpandedRow(expanded ? null : key)} className="rounded-md p-1.5 text-[#827568] transition-colors hover:bg-[#FDFBF8] hover:text-[#7F561E]"><ChevronDown size={15} className={`transition-transform ${expanded ? "rotate-180" : ""}`} /></button></td></tr>{expanded && <tr className="border-b border-[#F5F3EF] bg-[#FFFEFC]"><td colSpan={7} className="px-4 py-3"><div className="grid grid-cols-2 gap-3 text-[11px] sm:grid-cols-4"><div><p className="font-semibold text-[#827568]">Fecha de pago reportada</p><p className="mt-0.5 font-medium text-[#504539]">{formatDate(row.paidAt)}</p></div><div><p className="font-semibold text-[#827568]">Origen</p><p className="mt-0.5 font-medium text-[#504539]">{row.provider}</p></div><div><p className="font-semibold text-[#827568]">Última sincronización</p><p className="mt-0.5 font-medium text-[#504539]">{formatDateTime(row.lastSeenAt)}</p></div><div><p className="font-semibold text-[#827568]">Presencia en origen</p><p className="mt-0.5 font-medium text-[#504539]">{row.isPresentInLastSuccessfulSync ? "Vigente" : "Ausente en la última respuesta"}</p></div></div></td></tr>}</Fragment>;
                    })}{filteredHistory.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-[12px] font-medium text-[#5F5E5D]">No hay cuotas con los filtros seleccionados.</td></tr>}</tbody></table>
                  </div>
                  <div className="space-y-2 p-3 md:hidden">{filteredHistory.map((row, index) => {
                    const key = `m-${row.year}-${row.quotaNumber ?? "ins"}-${row.currency}-${index}`;
                    const expanded = expandedRow === key;
                    return <article key={key} className="rounded-lg border border-[#E4E2E0] bg-white p-3"><div className="flex items-start justify-between gap-2"><div><p className="text-[13px] font-semibold text-[#1a1c1c]">{row.year} · Cuota {row.quotaNumber ?? "—"}</p><p className="mt-0.5 text-[11px] text-[#5F5E5D]">{row.periodStart || isUpcomingRow(row) ? quotaPeriodLabel(row) : "Sin período"}</p></div><span className={`rounded-md px-2 py-1 text-[10px] font-semibold ${rowStatusTone(row)}`}>{rowStatusLabel(row)}</span></div><div className="mt-2 flex items-center justify-between"><p className="text-[15px] font-semibold tabular-nums text-[#1a1c1c]">{formatMoney(row.amount, row.currency)}</p><button type="button" aria-expanded={expanded} onClick={() => setExpandedRow(expanded ? null : key)} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold text-[#7F561E] hover:bg-[#FDFBF8]">Detalle <ChevronDown size={13} className={`transition-transform ${expanded ? "rotate-180" : ""}`} /></button></div>{expanded && <div className="mt-3 grid grid-cols-2 gap-2 border-t border-[#F1F0EE] pt-3 text-[11px]"><div><p className="font-semibold text-[#827568]">Pago reportado</p><p className="text-[#504539]">{formatDate(row.paidAt)}</p></div><div><p className="font-semibold text-[#827568]">Comprobante</p><p className="text-[#504539]">{row.receiptSerie || row.receiptNumber ? `${row.receiptSerie ?? ""} ${row.receiptNumber ?? ""}`.trim() : "—"}</p></div><div><p className="font-semibold text-[#827568]">Presencia</p><p className="text-[#504539]">{row.isPresentInLastSuccessfulSync ? "Vigente" : "Ausente"}</p></div><div><p className="font-semibold text-[#827568]">Última sync</p><p className="text-[#504539]">{formatDateTime(row.lastSeenAt)}</p></div></div>}</article>;
                  })}{filteredHistory.length === 0 && <p className="py-6 text-center text-[12px] font-medium text-[#5F5E5D]">No hay cuotas con los filtros seleccionados.</p>}</div>
                </div>
              </>}
            </section>
          </>}

          <section className={`${styles.section} ${styles.delay4} rounded-xl border border-[#E4E2E0] bg-white px-4 py-4`}>
            <div className="flex flex-wrap items-center justify-between gap-2"><SectionTitle title="Sincronización e incidencias" /><span className={`rounded-md px-2 py-1 text-[10px] font-semibold ${coverageTone(coverage)}`}>{detailCoverageLabel(coverage)}</span></div>
            <div className="mt-3 grid gap-2 text-[12px] sm:grid-cols-3"><div><p className="font-semibold text-[#827568]">Última sincronización</p><p className="mt-0.5 font-medium text-[#504539]">{formatDateTime(detail.synchronization.lastSync)}</p></div><div><p className="font-semibold text-[#827568]">Disponibilidad</p><p className="mt-0.5 font-medium text-[#504539]">{hasQuotaHistory ? "Con información financiera" : "Sin información financiera"}</p></div><div><p className="font-semibold text-[#827568]">Incidencias vigentes</p><p className="mt-0.5 font-medium text-[#504539]">{detail.incidences.length}</p></div></div>
            {detail.incidences.length > 0 ? <div className="mt-3 space-y-2">{detail.incidences.map((incidence, index) => <div key={index} className="rounded-lg border border-amber-100 bg-amber-50/60 p-3 text-[12px] text-amber-900"><p className="font-semibold">{errorCodeLabel(incidence.errorCode)}</p><button type="button" onClick={() => setShowTechnical((value) => !value)} className="mt-1 text-[11px] font-semibold text-[#7F561E] hover:underline">{showTechnical ? "Ocultar detalle técnico" : "Ver detalle técnico"}</button>{showTechnical && <p className="mt-1 rounded-md bg-white/70 p-2 font-mono text-[10px] text-slate-500">{incidence.errorCode ?? incidence.status} · intentos: {incidence.attempts}</p>}</div>)}</div> : <p className="mt-3 flex items-center gap-1.5 text-[12px] font-medium text-emerald-700"><CheckCircle2 size={14} /> Sin incidencias vigentes.</p>}
          </section>
        </div>}
      </div>
    </aside>
  </div>, document.body);
}
