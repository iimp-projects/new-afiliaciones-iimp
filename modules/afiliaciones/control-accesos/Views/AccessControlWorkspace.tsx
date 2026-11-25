"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  BadgeCheck,
  Building2,
  Camera,
  DoorOpen,
  Download,
  IdCard,
  Keyboard,
  LoaderCircle,
  Search,
  ShieldAlert,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { CameraQrScanner } from "../Components/CameraQrScanner";

type Site = { id: number; code: string; name: string; isActive: boolean };
type Point = { id: number; siteId: number; code: string; name: string; movementMode: "ENTRY" | "EXIT" | "BOTH"; isActive: boolean };
type SearchResult = { id: number; fullName: string; code: string | null; category: string | null; photoUrl: string | null };
type Validation = {
  result: "ALLOWED" | "DENIED" | "REVIEW_REQUIRED";
  reasonCode: string;
  message: string;
  person: SearchResult | null;
  card: { status: "ISSUED" | "REVOKED" | "NONE" };
  membership: { known: boolean; pendingQuotaCount: number; source: "NEW" | "MIGRATED" | null };
  session: { open: boolean; sessionId: number | null; entryAt: string | null; entryPoint: string | null };
  ticket: string | null;
  movementType: "ENTRY" | "EXIT";
};
type MovementResult = {
  result: "ALLOWED" | "DENIED" | "REVIEW_REQUIRED";
  reasonCode: string;
  message: string;
  movementId: string | null;
  occurredAt: string | null;
  movementType: "ENTRY" | "EXIT";
  idempotent: boolean;
};
type Movement = {
  id: string;
  person: { id: number; fullName: string; code: string | null };
  site: { id: number; name: string };
  accessPoint: { id: number; name: string };
  movementType: "ENTRY" | "EXIT";
  validationResult: "ALLOWED" | "DENIED" | "REVIEW_REQUIRED";
  reasonCode: string | null;
  occurredAt: string;
  registeredBy: string | null;
};
type Presence = {
  sessionId: number;
  person: { id: number; fullName: string; code: string | null; photoUrl: string | null };
  site: { id: number; name: string };
  entryPoint: { id: number; name: string };
  entryAt: string;
};
type Dashboard = { entries: number; exits: number; denied: number; review: number; open: number; since: string };
type Mode = "scan" | "camera" | "search";
type Busy = "validate" | "confirm" | "search" | null;

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const body = await response.json().catch(() => null);
  if (!response.ok || !body?.success) throw new Error(body?.message || "No se pudo completar la operación.");
  return body as T;
}

function idempotencyKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function formatTime(value: string | null): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("es-PE", { dateStyle: "short", timeStyle: "short", timeZone: "America/Lima" }).format(new Date(value));
}

function ResultBadge({ result }: { result: "ALLOWED" | "DENIED" | "REVIEW_REQUIRED" }) {
  const map = {
    ALLOWED: { label: "Autorizado", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    REVIEW_REQUIRED: { label: "Requiere revisión", className: "bg-amber-50 text-amber-800 border-amber-200" },
    DENIED: { label: "Denegado", className: "bg-red-50 text-red-700 border-red-200" },
  }[result];
  return <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-bold ${map.className}`}>{map.label}</span>;
}

export function AccessControlWorkspace({ canOperate, canManage, canExport }: { canOperate: boolean; canManage: boolean; canExport: boolean }) {
  const [sites, setSites] = useState<Site[]>([]);
  const [points, setPoints] = useState<Point[]>([]);
  const [siteId, setSiteId] = useState<number | null>(null);
  const [pointId, setPointId] = useState<number | null>(null);
  const [movementType, setMovementType] = useState<"ENTRY" | "EXIT">("ENTRY");
  const [mode, setMode] = useState<Mode>("scan");
  const [qrInput, setQrInput] = useState("");
  const [manualQuery, setManualQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [validation, setValidation] = useState<Validation | null>(null);
  const [feedback, setFeedback] = useState<MovementResult | null>(null);
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<string | null>(null);
  const [override, setOverride] = useState(false);
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [presence, setPresence] = useState<Presence[]>([]);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const focusScanner = useCallback(() => {
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }, []);

  const loadSites = useCallback(async () => {
    try {
      const body = await requestJson<{ data: Site[] }>("/api/afiliaciones/control-accesos/sedes");
      setSites(body.data);
      setSiteId((current) => current ?? body.data.find((site) => site.isActive)?.id ?? body.data[0]?.id ?? null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudieron cargar las sedes.");
    }
  }, []);

  const loadPoints = useCallback(async (site: number) => {
    try {
      const body = await requestJson<{ data: Point[] }>(`/api/afiliaciones/control-accesos/puntos?siteId=${site}`);
      setPoints(body.data);
      setPointId((current) => body.data.find((point) => point.id === current)?.id ?? body.data.find((point) => point.isActive)?.id ?? body.data[0]?.id ?? null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudieron cargar los puntos de acceso.");
    }
  }, []);

  const refreshActivity = useCallback(async (site?: number) => {
    const suffix = site ? `?siteId=${site}` : "";
    const [dash, movs, pres] = await Promise.allSettled([
      requestJson<{ data: Dashboard }>(`/api/afiliaciones/control-accesos/dashboard${suffix}`),
      requestJson<{ data: { items: Movement[] } }>(`/api/afiliaciones/control-accesos/movimientos?pageSize=8${site ? `&siteId=${site}` : ""}`),
      requestJson<{ data: { items: Presence[] } }>(`/api/afiliaciones/control-accesos/presencia?pageSize=8${site ? `&siteId=${site}` : ""}`),
    ]);
    if (dash.status === "fulfilled") setDashboard(dash.value.data);
    if (movs.status === "fulfilled") setMovements(movs.value.data.items);
    if (pres.status === "fulfilled") setPresence(pres.value.data.items);
  }, []);

  useEffect(() => {
    void loadSites();
  }, [loadSites]);
  useEffect(() => {
    if (siteId) void loadPoints(siteId);
  }, [siteId, loadPoints]);
  useEffect(() => {
    void refreshActivity(siteId ?? undefined);
  }, [siteId, refreshActivity]);
  useEffect(() => {
    if (canOperate && mode === "scan") focusScanner();
  }, [canOperate, mode, focusScanner]);

  const resetResult = () => {
    setValidation(null);
    setFeedback(null);
    setOverride(false);
  };

  const runValidation = async (input: { rawQr?: string; personId?: number; source: "QR_USB" | "QR_CAMERA" | "MANUAL_SEARCH" }) => {
    if (!siteId || !pointId) {
      setError("Seleccione una sede y un punto de acceso.");
      return;
    }
    setBusy("validate");
    setError(null);
    resetResult();
    try {
      const body = await requestJson<{ data: Validation }>("/api/afiliaciones/control-accesos/validate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...input, siteId, accessPointId: pointId, movementType }),
      });
      setValidation(body.data);
      setQrInput("");
      setSearchResults([]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo validar la credencial.");
    } finally {
      setBusy(null);
      focusScanner();
    }
  };

  const confirmMovement = async () => {
    if (!validation?.ticket) return;
    const endpoint = validation.movementType === "ENTRY" ? "check-in" : "check-out";
    setBusy("confirm");
    setError(null);
    try {
      const body = await requestJson<{ data: MovementResult }>(`/api/afiliaciones/control-accesos/${endpoint}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ticket: validation.ticket,
          idempotencyKey: idempotencyKey(),
          adminOverride: canManage && override,
        }),
      });
      setFeedback(body.data);
      setValidation(null);
      setOverride(false);
      await refreshActivity(siteId ?? undefined);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo registrar el movimiento.");
    } finally {
      setBusy(null);
      focusScanner();
    }
  };

  const searchPerson = async () => {
    if (manualQuery.trim().length < 3) {
      setError("Ingrese al menos 3 caracteres para buscar.");
      return;
    }
    setBusy("search");
    setError(null);
    resetResult();
    try {
      const body = await requestJson<{ data: SearchResult[] }>(
        `/api/afiliaciones/control-accesos/search?q=${encodeURIComponent(manualQuery.trim())}&limit=10`,
      );
      setSearchResults(body.data);
      if (body.data.length === 0) setError("No se encontraron asociados con ese criterio.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo realizar la búsqueda.");
    } finally {
      setBusy(null);
    }
  };

  const selectedSite = sites.find((site) => site.id === siteId);
  const movementLabel = movementType === "ENTRY" ? "Registrar ingreso" : "Registrar salida";
  const confirmDisabled = busy !== null || !validation?.ticket || (validation.result === "REVIEW_REQUIRED" && !(canManage && override));

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 pb-10">
      <header className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-5 py-5 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#f8f1e3] text-[#a87924]"><DoorOpen size={22} /></span>
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-[#14233D]">Control de accesos</h1>
            <p className="text-xs text-slate-500">Validación de credenciales y registro de ingresos/salidas.</p>
          </div>
        </div>
        {canOperate && (
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
            <span className={`h-2.5 w-2.5 rounded-full ${busy ? "bg-amber-500" : "bg-emerald-500"}`} />
            {busy ? "Procesando…" : "Lector preparado"}
          </div>
        )}
      </header>

      {!canOperate && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Modo solo consulta: tu rol permite revisar movimientos y presencia, pero no registrar accesos.
        </div>
      )}

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Ingresos hoy", value: dashboard?.entries ?? 0, icon: ArrowDownLeft, color: "text-emerald-600" },
          { label: "Salidas hoy", value: dashboard?.exits ?? 0, icon: ArrowUpRight, color: "text-sky-600" },
          { label: "En sede", value: dashboard?.open ?? 0, icon: Building2, color: "text-[#a87924]" },
          { label: "Revisiones / denegados", value: (dashboard?.review ?? 0) + (dashboard?.denied ?? 0), icon: ShieldAlert, color: "text-red-600" },
        ].map((item) => (
          <div key={item.label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500"><item.icon size={15} className={item.color} /> {item.label}</div>
            <p className="mt-2 text-2xl font-semibold text-[#14233D]">{item.value}</p>
          </div>
        ))}
      </section>

      {canOperate && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="text-xs font-semibold text-slate-500">Sede
              <select value={siteId ?? ""} onChange={(event) => setSiteId(Number(event.target.value) || null)} className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700">
                {sites.map((site) => <option key={site.id} value={site.id}>{site.name}{site.isActive ? "" : " (inactiva)"}</option>)}
              </select>
            </label>
            <label className="text-xs font-semibold text-slate-500">Punto de acceso
              <select value={pointId ?? ""} onChange={(event) => setPointId(Number(event.target.value) || null)} className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700">
                {points.map((point) => <option key={point.id} value={point.id}>{point.name} · {point.movementMode === "BOTH" ? "Ingreso/Salida" : point.movementMode === "ENTRY" ? "Ingreso" : "Salida"}</option>)}
              </select>
            </label>
            <div className="text-xs font-semibold text-slate-500">Movimiento
              <div className="mt-1 grid grid-cols-2 gap-2">
                <button type="button" onClick={() => { setMovementType("ENTRY"); resetResult(); }} className={`h-10 rounded-lg border text-sm font-semibold ${movementType === "ENTRY" ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-white text-slate-500"}`}>Ingreso</button>
                <button type="button" onClick={() => { setMovementType("EXIT"); resetResult(); }} className={`h-10 rounded-lg border text-sm font-semibold ${movementType === "EXIT" ? "border-sky-300 bg-sky-50 text-sky-700" : "border-slate-200 bg-white text-slate-500"}`}>Salida</button>
              </div>
            </div>
          </div>

          <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div>
              <div className="mb-3 grid grid-cols-3 gap-1 rounded-lg bg-slate-100 p-1">
                {([["scan", "Lector USB", Keyboard], ["camera", "Cámara", Camera], ["search", "Búsqueda", Search]] as const).map(([value, label, Icon]) => (
                  <button key={value} type="button" onClick={() => setMode(value)} className={`inline-flex h-9 items-center justify-center gap-1.5 rounded-md text-xs font-semibold ${mode === value ? "bg-white text-[#14233D] shadow-sm" : "text-slate-500 hover:text-slate-700"}`}><Icon size={14} /> {label}</button>
                ))}
              </div>

              {mode === "scan" && (
                <div>
                  <label className="text-xs font-semibold text-slate-500">Escanea el QR del carné
                    <input
                      ref={inputRef}
                      value={qrInput}
                      onChange={(event) => setQrInput(event.target.value.slice(0, 2048))}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          if (qrInput.trim() && busy === null) void runValidation({ rawQr: qrInput.trim(), source: "QR_USB" });
                        }
                      }}
                      placeholder="El lector escribirá aquí automáticamente…"
                      autoComplete="off"
                      className="mt-1 h-12 w-full rounded-lg border border-slate-200 px-3 font-mono text-sm focus:border-[#a87924] focus:outline-none"
                    />
                  </label>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <p className="text-[11px] text-slate-400">Compatible con lectores QR 2D en modo teclado (Enter para validar).</p>
                    <button type="button" onClick={() => qrInput.trim() && void runValidation({ rawQr: qrInput.trim(), source: "QR_USB" })} disabled={!qrInput.trim() || busy !== null} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#a87924] px-3 text-xs font-semibold text-white hover:bg-[#8f661d] disabled:opacity-50">
                      {busy === "validate" ? <LoaderCircle size={14} className="animate-spin" /> : <ShieldCheck size={14} />} Validar
                    </button>
                  </div>
                </div>
              )}

              {mode === "camera" && (
                <CameraQrScanner disabled={busy !== null} onDetected={(value) => { setQrInput(value); void runValidation({ rawQr: value, source: "QR_CAMERA" }); }} />
              )}

              {mode === "search" && (
                <div>
                  <label className="text-xs font-semibold text-slate-500">Búsqueda manual autorizada
                    <div className="mt-1 flex gap-2">
                      <input value={manualQuery} onChange={(event) => setManualQuery(event.target.value.slice(0, 120))} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void searchPerson(); } }} placeholder="Nombre, código o documento" className="h-12 w-full rounded-lg border border-slate-200 px-3 text-sm focus:border-[#a87924] focus:outline-none" />
                      <button type="button" onClick={() => void searchPerson()} disabled={busy !== null} className="inline-flex h-12 items-center gap-1.5 rounded-lg bg-[#a87924] px-4 text-xs font-semibold text-white hover:bg-[#8f661d] disabled:opacity-50">
                        {busy === "search" ? <LoaderCircle size={14} className="animate-spin" /> : <Search size={14} />} Buscar
                      </button>
                    </div>
                  </label>
                  <div className="mt-3 space-y-2">
                    {searchResults.map((person) => (
                      <button key={person.id} type="button" onClick={() => void runValidation({ personId: person.id, source: "MANUAL_SEARCH" })} className="flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 text-left hover:border-[#C5A059]">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-100">
                          {person.photoUrl ? <img src={person.photoUrl} alt={person.fullName} className="h-full w-full object-cover" /> : <UserRound size={18} className="text-slate-400" />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-[#14233D]">{person.fullName}</span>
                          <span className="block text-xs text-slate-500">{person.code ?? "Sin código"} · {person.category ?? "Categoría no disponible"}</span>
                        </span>
                        <ShieldCheck size={16} className="text-[#a87924]" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="min-h-[260px] rounded-xl border border-slate-200 bg-slate-50/60 p-4">
              {!validation && !feedback && <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-slate-400"><IdCard size={30} /><p className="text-xs">Escanea o busca un asociado para validar su credencial.</p></div>}

              {validation && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-2">
                    <ResultBadge result={validation.result} />
                    <span className="text-[11px] font-semibold text-slate-400">{validation.reasonCode}</span>
                  </div>
                  {validation.person && (
                    <div className="flex items-center gap-3">
                      <span className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-100">
                        {validation.person.photoUrl ? <img src={validation.person.photoUrl} alt={validation.person.fullName} className="h-full w-full object-cover" /> : <UserRound size={22} className="text-slate-400" />}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-[#14233D]">{validation.person.fullName}</p>
                        <p className="text-xs text-slate-500">{validation.person.code ?? "Sin código"} · {validation.person.category ?? "Categoría no disponible"}</p>
                      </div>
                    </div>
                  )}
                  <p className="rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-600">{validation.message}</p>
                  <dl className="grid grid-cols-2 gap-2 text-xs">
                    <div><dt className="text-slate-400">Credencial</dt><dd className="font-semibold text-slate-700">{validation.card.status === "ISSUED" ? "Vigente" : validation.card.status === "REVOKED" ? "Revocada" : "No encontrada"}</dd></div>
                    <div><dt className="text-slate-400">Membresía</dt><dd className="font-semibold text-slate-700">{validation.membership.known ? "Identificada" : "Indeterminada"}</dd></div>
                    <div><dt className="text-slate-400">Sesión</dt><dd className="font-semibold text-slate-700">{validation.session.open ? `Ingreso ${formatTime(validation.session.entryAt)}` : "Sin ingreso abierto"}</dd></div>
                    <div><dt className="text-slate-400">Cuotas pendientes</dt><dd className="font-semibold text-slate-700">{validation.membership.pendingQuotaCount}</dd></div>
                  </dl>

                  {validation.result === "REVIEW_REQUIRED" && canManage && (
                    <label className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                      <input type="checkbox" checked={override} onChange={(event) => setOverride(event.target.checked)} className="mt-0.5" />
                      <span>Resolver con autorización administrativa (queda auditado).</span>
                    </label>
                  )}

                  {validation.ticket ? (
                    <button type="button" onClick={() => void confirmMovement()} disabled={confirmDisabled} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#a87924] px-4 text-sm font-semibold text-white hover:bg-[#8f661d] disabled:opacity-50">
                      {busy === "confirm" ? <LoaderCircle size={16} className="animate-spin" /> : movementLabel.startsWith("Registrar ingreso") ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />} {busy === "confirm" ? "Registrando…" : movementLabel}
                    </button>
                  ) : <p className="text-xs text-slate-400">No hay acciones disponibles para este resultado.</p>}
                </div>
              )}

              {feedback && (
                <div className="space-y-3">
                  <ResultBadge result={feedback.result} />
                  <p className="text-sm font-semibold text-[#14233D]">{feedback.message}</p>
                  <p className="text-xs text-slate-500">{feedback.occurredAt ? `Registrado: ${formatTime(feedback.occurredAt)}` : ""}</p>
                  <button type="button" onClick={() => { setFeedback(null); focusScanner(); }} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-600 hover:bg-slate-50">Continuar</button>
                </div>
              )}
            </div>
          </div>

          {error && <p className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">{error}</p>}
        </section>
      )}

      <section className="grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
            <div>
              <h2 className="text-sm font-semibold text-[#14233D]">Últimos movimientos</h2>
              <span className="text-xs text-slate-400">{selectedSite?.name ?? "Todas las sedes"}</span>
            </div>
            {canExport && (
              <a href={`/api/afiliaciones/control-accesos/reportes/export${siteId ? `?siteId=${siteId}` : ""}`} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 text-xs font-semibold text-emerald-700 hover:bg-emerald-100">
                <Download size={14} /> Exportar
              </a>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-400">
                <tr><th className="px-4 py-2.5">Fecha</th><th className="px-4 py-2.5">Asociado</th><th className="px-4 py-2.5">Sede / Punto</th><th className="px-4 py-2.5">Tipo</th><th className="px-4 py-2.5">Resultado</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {movements.map((row) => (
                  <tr key={row.id}>
                    <td className="whitespace-nowrap px-4 py-2.5 text-slate-500">{formatTime(row.occurredAt)}</td>
                    <td className="px-4 py-2.5"><p className="font-semibold text-slate-700">{row.person.fullName}</p><p className="text-slate-400">{row.person.code ?? "—"}</p></td>
                    <td className="px-4 py-2.5 text-slate-500">{row.site.name}<br />{row.accessPoint.name}</td>
                    <td className="px-4 py-2.5 font-semibold text-slate-600">{row.movementType === "ENTRY" ? "Ingreso" : "Salida"}</td>
                    <td className="px-4 py-2.5"><ResultBadge result={row.validationResult} /></td>
                  </tr>
                ))}
                {movements.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">Sin movimientos registrados.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <h2 className="text-sm font-semibold text-[#14233D]">Asociados en sede</h2>
            <span className="text-xs text-slate-400">{presence.length}</span>
          </div>
          <ul className="divide-y divide-slate-100">
            {presence.map((row) => (
              <li key={row.sessionId} className="flex items-center gap-3 px-5 py-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-100">
                  {row.person.photoUrl ? <img src={row.person.photoUrl} alt={row.person.fullName} className="h-full w-full object-cover" /> : <UserRound size={16} className="text-slate-400" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-700">{row.person.fullName}</p>
                  <p className="text-xs text-slate-400">{row.entryPoint.name} · desde {formatTime(row.entryAt)}</p>
                </div>
                <BadgeCheck size={16} className="text-emerald-500" />
              </li>
            ))}
            {presence.length === 0 && <li className="px-5 py-8 text-center text-xs text-slate-400">No hay ingresos abiertos.</li>}
          </ul>
        </div>
      </section>
    </div>
  );
}
