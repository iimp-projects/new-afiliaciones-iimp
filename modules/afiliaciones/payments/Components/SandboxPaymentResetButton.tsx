"use client";

import { useState } from "react";

export function SandboxPaymentResetButton({ paymentId }: { paymentId: number }) {
  const [isResetting, setIsResetting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = async () => {
    if (!window.confirm("Esta acción eliminará únicamente el resultado de la transacción Sandbox y permitirá volver a realizar el pago. No debe utilizarse en producción.")) return;
    setIsResetting(true);
    setError(null);
    try {
      const response = await fetch(`/api/payments/${paymentId}/sandbox-reset`, { method: "POST" });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.message || "No fue posible reiniciar el pago de prueba.");
      window.location.reload();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No fue posible reiniciar el pago de prueba.");
    } finally {
      setIsResetting(false);
    }
  };

  return <div className="mt-3">
    <button type="button" onClick={reset} disabled={isResetting} className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60">
      {isResetting ? "Reiniciando pago..." : "Reiniciar pago de prueba"}
    </button>
    {error && <p role="alert" className="mt-2 text-xs font-medium text-red-700">{error}</p>}
  </div>;
}
