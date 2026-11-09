"use client";
/* eslint-disable react-hooks/set-state-in-effect -- la persistencia (localStorage) y el fade-in se resuelven explícitamente al montar. */

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Info, X } from "lucide-react";

interface InfoBannerProps {
  title: string;
  children: ReactNode;
  storageKey?: string;
}

export function InfoBanner({ title, children, storageKey }: InfoBannerProps) {
  const [mounted, setMounted] = useState(false);
  const [closing, setClosing] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (storageKey) {
      try {
        if (window.localStorage.getItem(storageKey) === "dismissed") {
          setDismissed(true);
          return;
        }
      } catch {
        // Ignorar errores de almacenamiento.
      }
    }
    setMounted(true);
  }, [storageKey]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
    };
  }, []);

  const handleDismiss = () => {
    setClosing(true);
    timeoutRef.current = window.setTimeout(() => {
      setDismissed(true);
      if (storageKey) {
        try {
          window.localStorage.setItem(storageKey, "dismissed");
        } catch {
          // Ignorar errores de almacenamiento.
        }
      }
    }, 300);
  };

  if (dismissed) return null;

  return (
    <div
      className={`mb-4 flex items-start gap-3 rounded-2xl border border-blue-200 bg-blue-50 p-4 transition-all duration-300 ease-out ${
        closing
          ? "opacity-0 -translate-y-1 scale-95"
          : mounted
            ? "opacity-100 translate-y-0"
            : "opacity-0 translate-y-1"
      }`}
    >
      <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-100">
        <Info size={18} className="text-blue-600" strokeWidth={2.2} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-extrabold text-blue-900">{title}</p>
        <div className="mt-0.5 text-[13px] font-medium leading-snug text-blue-900/70">{children}</div>
      </div>
      <button
        type="button"
        onClick={handleDismiss}
        aria-label="Cerrar aviso informativo"
        className="shrink-0 rounded-lg p-1.5 text-blue-400 transition-colors hover:bg-blue-100 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/50"
      >
        <X size={18} strokeWidth={2.5} />
      </button>
    </div>
  );
}
