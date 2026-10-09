"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { GlobalModalRoot } from "@/modules/shared/Components/GlobalModalRoot";
import { getRemainingMs, shouldRegisterHumanActivity, SESSION_ACTIVITY_THROTTLE_MS, type SessionExpiryReason, type SessionSnapshot } from "@/modules/auth/session/sessionPresentation";

const WARNING_MS = 5 * 60 * 1000;
const CHANNEL_NAME = "iimp-session-state";
type ExpiryReason = SessionExpiryReason;
type Snapshot = SessionSnapshot;
type SessionPresentation = { remainingMs: number | null; expiryReason: ExpiryReason; expired: boolean };
const SessionContext = createContext<SessionPresentation>({ remainingMs: null, expiryReason: null, expired: false });

export function useSessionPresentation() { return useContext(SessionContext); }
function isSnapshot(value: unknown): value is Snapshot { return !!value && typeof value === "object" && typeof (value as Partial<Snapshot>).valid === "boolean" && typeof (value as Partial<Snapshot>).serverNow === "string"; }
export function announceSessionEnded() { if (typeof BroadcastChannel !== "undefined") { const channel = new BroadcastChannel(CHANNEL_NAME); channel.postMessage({ type: "ended" }); channel.close(); } }

export function SessionManager({ children }: { children: ReactNode }) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [expired, setExpired] = useState(false);
  const [serverOffsetMs, setServerOffsetMs] = useState(0);
  const lastActivityRequestRef = useRef(0), pendingActivityRef = useRef(false), channelRef = useRef<BroadcastChannel | null>(null);
  const applySnapshot = useCallback((next: Snapshot, broadcast = true) => { setServerOffsetMs(Date.parse(next.serverNow) - Date.now()); setSnapshot(next); if (!next.valid) setExpired(true); if (broadcast) channelRef.current?.postMessage({ type: "snapshot", snapshot: next }); }, []);
  const checkStatus = useCallback(async () => {
    try { const response = await fetch("/api/auth/session-status", { cache: "no-store", credentials: "same-origin" }); const body: unknown = await response.json(); if (!isSnapshot(body)) return false; applySnapshot(body); return body.valid; }
    catch { return false; } // Una falla de red no es una expiración.
  }, [applySnapshot]);
  const registerActivity = useCallback(async (isHumanActivity: boolean) => {
    const clientNow = Date.now();
    if (!shouldRegisterHumanActivity({ isHumanActivity, isVisible: document.visibilityState === "visible", isPending: pendingActivityRef.current, now: clientNow, lastRequestAt: lastActivityRequestRef.current })) return;
    pendingActivityRef.current = true; lastActivityRequestRef.current = clientNow;
    try { const response = await fetch("/api/auth/session-activity", { method: "POST", credentials: "same-origin", cache: "no-store", headers: { "Content-Type": "application/json" }, body: "{}" }); const body: unknown = await response.json(); if (isSnapshot(body)) applySnapshot(body); }
    catch { /* Se reintentará ante una interacción humana posterior. */ }
    finally { pendingActivityRef.current = false; }
  }, [applySnapshot]);

  useEffect(() => { void checkStatus(); const interval = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(interval); }, [checkStatus]);
  useEffect(() => { const channel = typeof BroadcastChannel === "undefined" ? null : new BroadcastChannel(CHANNEL_NAME); channelRef.current = channel; if (!channel) return; channel.onmessage = (event: MessageEvent<unknown>) => { const message = event.data as { type?: unknown; snapshot?: unknown }; if (message.type === "snapshot" && isSnapshot(message.snapshot)) applySnapshot(message.snapshot, false); if (message.type === "ended") setExpired(true); }; return () => { channel.close(); channelRef.current = null; }; }, [applySnapshot]);
  useEffect(() => { const activity = () => { void registerActivity(true); }; const visible = () => { if (document.visibilityState === "visible") void checkStatus(); }; window.addEventListener("pointerdown", activity, { passive: true }); window.addEventListener("keydown", activity); window.addEventListener("touchstart", activity, { passive: true }); document.addEventListener("submit", activity, true); document.addEventListener("visibilitychange", visible); return () => { window.removeEventListener("pointerdown", activity); window.removeEventListener("keydown", activity); window.removeEventListener("touchstart", activity); document.removeEventListener("submit", activity, true); document.removeEventListener("visibilitychange", visible); }; }, [checkStatus, registerActivity]);
  const presentation = useMemo<SessionPresentation>(() => { const remainingMs = getRemainingMs(snapshot, serverOffsetMs, now); if (remainingMs === null) return { remainingMs: null, expiryReason: snapshot?.expiryReason ?? null, expired }; return { remainingMs, expiryReason: snapshot?.expiryReason ?? null, expired: expired || remainingMs === 0 }; }, [expired, now, serverOffsetMs, snapshot]);
  useEffect(() => { if (presentation.remainingMs !== 0 || expired) return; void checkStatus(); }, [checkStatus, expired, presentation.remainingMs]);
  const warning = presentation.remainingMs !== null && presentation.remainingMs > 0 && presentation.remainingMs <= WARNING_MS;
  return <SessionContext.Provider value={presentation}>{children}{warning && <div role="status" aria-live="polite" className="fixed right-4 bottom-4 z-40 max-w-sm rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900 shadow-lg">{presentation.expiryReason === "ABSOLUTE" ? "Tu sesión finalizará pronto. Guarda tus cambios." : "Tu sesión está próxima a finalizar. Continúa utilizando el sistema para mantenerla activa."}</div>}{presentation.expired && <GlobalModalRoot title="Tu sesión ha finalizado"><div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"><h2 className="text-lg font-extrabold text-slate-900">Tu sesión ha finalizado</h2><p className="mt-2 text-sm leading-6 text-slate-600">Por seguridad, tu sesión ha terminado. Inicia sesión nuevamente para continuar utilizando el sistema.</p><button type="button" onClick={() => window.location.assign("/api/auth/session-expired")} className="mt-6 w-full rounded-xl bg-[#7f561e] px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-[#684719]">Volver a iniciar sesión</button></div></GlobalModalRoot>}</SessionContext.Provider>;
}
