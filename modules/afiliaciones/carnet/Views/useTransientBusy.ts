"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Estado de carga acotado para acciones que delegan al navegador (descarga o
 * impresión del PDF), donde no existe una promesa que observar. Evita que el
 * usuario perciba el botón como inerte y limpia el temporizador al desmontar.
 */
export function useTransientBusy(durationMs: number) {
  const [busy, setBusy] = useState(false);
  const timer = useRef<number | null>(null);

  const clear = useCallback(() => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  useEffect(() => clear, [clear]);

  const trigger = useCallback(() => {
    clear();
    setBusy(true);
    timer.current = window.setTimeout(() => {
      setBusy(false);
      timer.current = null;
    }, durationMs);
  }, [clear, durationMs]);

  return [busy, trigger] as const;
}
