"use client";

import { Info } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type FieldHelpProps = {
  title: string;
  description: string;
  examples?: string[];
};

export function FieldHelp({ title, description, examples }: FieldHelpProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const onOtherHelp = () => setOpen(false);
    document.addEventListener("field-help-open", onOtherHelp);
    if (!open) return () => document.removeEventListener("field-help-open", onOtherHelp);
    const onPointerDown = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("field-help-open", onOtherHelp);
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const id = `field-help-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  return (
    <span ref={ref} className="relative inline-flex align-middle">
      <button type="button" aria-label={`Ayuda: ${title}`} aria-expanded={open} aria-describedby={open ? id : undefined} onClick={() => { if (!open) document.dispatchEvent(new Event("field-help-open")); setOpen((value) => !value); }} className="ml-1 inline-flex h-5 w-5 items-center justify-center rounded-full text-slate-400 outline-none transition hover:bg-[#C5A059]/10 hover:text-[#C5A059] focus-visible:ring-2 focus-visible:ring-[#C5A059]/40">
        <Info size={14} aria-hidden="true" />
      </button>
      {open && (
        <span id={id} role="tooltip" className="absolute left-0 top-7 z-[150] w-[min(300px,calc(100vw-2rem))] rounded-lg border border-slate-200 bg-white p-3 text-left text-xs font-normal normal-case tracking-normal text-slate-600 shadow-lg">
          <span className="block leading-relaxed">{description}</span>
          {examples?.length ? <span className="mt-2 block text-slate-500"><strong className="font-semibold text-slate-700">Ejemplos:</strong> {examples.join(", ")}</span> : null}
        </span>
      )}
    </span>
  );
}
