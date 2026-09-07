"use client";

import Image from "next/image";
import { useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

const subscribe = () => () => {};
const clientSnapshot = () => true;
const serverSnapshot = () => false;

export interface ProcessLoadingOverlayProps {
  open: boolean;
  title: string;
  description: string;
  variant?: "default" | "payment";
  progress?: number;
}

export function ProcessLoadingOverlay({
  open,
  title,
  description,
  variant = "default",
  progress,
}: ProcessLoadingOverlayProps) {
  const mounted = useSyncExternalStore(subscribe, clientSnapshot, serverSnapshot);
  if (!open || !mounted) return null;

  const boundedProgress = progress === undefined ? undefined : Math.min(100, Math.max(0, progress));

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] grid place-items-center bg-slate-950/65 px-5 backdrop-blur-sm animate-in fade-in duration-200"
      role="status"
      aria-busy="true"
      aria-live="polite"
    >
      <div className="flex w-full max-w-md flex-col items-center text-center text-white">
        <Image
          src="/images/logo-iimp.png"
          alt="IIMP"
          width={180}
          height={64}
          priority
          className="h-auto w-[140px] animate-pulse motion-reduce:animate-none sm:w-[170px]"
        />
        <div className="mt-8 h-10 w-10 animate-spin rounded-full border-4 border-white/25 border-t-[#C5A059] motion-reduce:animate-none" aria-hidden="true" />
        <h2 className="mt-5 text-2xl font-black tracking-tight">{title}</h2>
        <p className="mt-3 text-base text-white/90">{description}</p>
        {boundedProgress === undefined ? (
          <div className="mt-7 h-1 w-full max-w-xs overflow-hidden rounded-full bg-white/20" aria-hidden="true">
            <div className="h-full w-2/5 animate-sweep rounded-full bg-[#C5A059] motion-reduce:animate-none" />
          </div>
        ) : (
          <div className="mt-7 h-1 w-full max-w-xs overflow-hidden rounded-full bg-white/20" aria-label={`${boundedProgress}% completado`}>
            <div className="h-full rounded-full bg-[#C5A059] transition-[width] duration-300" style={{ width: `${boundedProgress}%` }} />
          </div>
        )}
        {variant === "payment" && <p className="mt-5 text-sm text-white/75">Por favor, espera unos segundos.</p>}
      </div>
    </div>,
    document.body,
  );
}
