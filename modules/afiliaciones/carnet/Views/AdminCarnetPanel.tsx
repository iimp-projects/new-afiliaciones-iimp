"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, RefreshCw, ShieldX } from "lucide-react";
import { CardFace, type CardViewData, type CardViewState } from "./CardView";

type Preview = CardViewData & { card: CardViewState };

export function AdminCarnetPanel({ personId }: { personId: number }) {
  const router = useRouter();
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState<"revoke" | "regenerate" | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/afiliaciones/carnet/${personId}`, { cache: "no-store" });
      const body = await response.json();
      if (!response.ok || !body.success) {
        setError(body.message || "No fue posible consultar el carnet.");
        setPreview(null);
        return;
      }
      setPreview(body.data);
    } catch {
      setError("No fue posible consultar el carnet.");
      setPreview(null);
    } finally {
      setLoading(false);
    }
  }, [personId]);

  useEffect(() => {
    void load();
  }, [load]);

  const revoke = useCallback(async () => {
    if (!reason.trim()) return;
    setBusy("revoke");
    setError(null);
    try {
      const response = await fetch(`/api/afiliaciones/carnet/${personId}/revoke`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reason: reason.trim() }),
      });
      const body = await response.json();
      if (!response.ok || !body.success) {
        setError(body.message || "No fue posible revocar el carnet.");
        return;
      }
      setReason("");
      router.refresh();
      await load();
    } catch {
      setError("No fue posible revocar el carnet.");
    } finally {
      setBusy(null);
    }
  }, [reason, personId, router, load]);

  const regenerate = useCallback(async () => {
    setBusy("regenerate");
    setError(null);
    try {
      const response = await fetch(`/api/afiliaciones/carnet/${personId}/regenerate`, { method: "POST" });
      const body = await response.json();
      if (!response.ok || !body.success) {
        setError(body.message || "No fue posible regenerar el carnet.");
        return;
      }
      router.refresh();
      await load();
    } catch {
      setError("No fue posible regenerar el carnet.");
    } finally {
      setBusy(null);
    }
  }, [personId, router, load]);

  if (loading) return <p className="p-5 text-sm text-slate-500">Consultando carnet…</p>;
  if (error && !preview) return <p className="p-5 text-sm text-slate-500">{error}</p>;
  if (!preview) return null;

  const issued = preview.card.generated && preview.card.status === "ISSUED";
  const revoked = preview.card.generated && preview.card.status === "REVOKED";
  const verificationUrl = issued && preview.card.verificationToken
    ? `${window.location.origin}/verificar-carnet/${preview.card.verificationToken}`
    : null;

  return (
    <div className="space-y-5">
      {issued && <CardFace data={preview} verificationUrl={verificationUrl} />}

      {!preview.eligible && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-800">
          Carnet no disponible: {preview.reason}
        </div>
      )}

      {preview.eligible && !preview.card.generated && (
        <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 text-sm leading-6 text-slate-500">
          Aún no se generó la credencial. El asociado puede generarla desde Mi Cuenta.
        </div>
      )}

      {revoked && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-700">
          Credencial revocada. {preview.card.revokedReason ? `Motivo: ${preview.card.revokedReason}` : ""}
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex flex-wrap items-center gap-3">
        {issued && (
          <a
            href={`/api/afiliaciones/carnet/${personId}/download`}
            className="inline-flex h-9 items-center gap-2 rounded-xl border border-[#E6C982] px-4 text-xs font-bold text-[#936B2E] hover:bg-[#FFF8E8]"
          >
            <Download size={14} /> Descargar PDF
          </a>
        )}

        {issued && (
          <div className="flex items-center gap-2">
            <input
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Motivo de revocación (obligatorio)"
              className="h-9 w-64 rounded-xl border border-slate-200 px-3 text-xs"
            />
            <button
              type="button"
              onClick={revoke}
              disabled={busy !== null || !reason.trim()}
              className="inline-flex h-9 items-center gap-2 rounded-xl bg-red-600 px-4 text-xs font-bold text-white hover:bg-red-700 disabled:opacity-50"
            >
              <ShieldX size={14} /> Revocar
            </button>
          </div>
        )}

        {revoked && (
          <button
            type="button"
            onClick={regenerate}
            disabled={busy !== null}
            className="inline-flex h-9 items-center gap-2 rounded-xl bg-[#B8892D] px-4 text-xs font-bold text-white hover:bg-[#9E7425] disabled:opacity-50"
          >
            <RefreshCw size={14} /> Regenerar credencial
          </button>
        )}
      </div>
    </div>
  );
}
