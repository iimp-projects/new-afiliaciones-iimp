"use client";

import { useCallback, useEffect, useState } from "react";
import type { QuotaDashboardSummary } from "../Models/QuotaAdmin";

export function useQuotasSummary() {
  const [summary, setSummary] = useState<QuotaDashboardSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async (signal?: AbortSignal) => {
    setIsLoading(true);
    setError("");
    try {
      const response = await fetch("/api/afiliaciones/quotas/summary", { signal, cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body?.message);
      setSummary(body.data);
    } catch (cause) {
      if ((cause as Error)?.name !== "AbortError") setError("No pudimos cargar el resumen de cuotas. Inténtalo nuevamente.");
    } finally {
      if (!signal?.aborted) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  return { summary, isLoading, error, reload: load };
}
