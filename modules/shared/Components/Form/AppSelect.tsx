"use client";

import { Check, ChevronDown, Search } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

export type AppSelectOption = { value: string | number; label: string };

type Props = {
  label?: string;
  value: string | number;
  options: AppSelectOption[];
  placeholder?: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  error?: string;
  required?: boolean;
  helperText?: string;
  className?: string;
  searchable?: boolean;
  portal?: boolean;
  "aria-label"?: string;
};

type Placement = {
  left: number;
  width: number;
  top?: number;
  bottom?: number;
  maxHeight: number;
};

export function AppSelect({
  label,
  value,
  options,
  placeholder = "Seleccione una opción",
  onChange,
  disabled = false,
  error,
  required = false,
  helperText,
  className = "",
  searchable = false,
  portal = false,
  "aria-label": ariaLabel,
}: Props) {
  const id = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(-1);
  const [placement, setPlacement] = useState<Placement | null>(null);

  const selected = options.find((option) => String(option.value) === String(value));

  const filtered = useMemo(() => {
    if (!searchable) return options;
    const normalized = query.trim().toLocaleLowerCase("es");
    if (!normalized) return options;
    return options.filter((option) => option.label.toLocaleLowerCase("es").includes(normalized));
  }, [options, query, searchable]);

  useEffect(() => {
    if (!open) return;
    const update = () => {
      const trigger = buttonRef.current;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const openUp = spaceBelow < 280 && rect.top > spaceBelow;
      setPlacement({
        left: rect.left,
        width: rect.width,
        top: openUp ? undefined : rect.bottom + 6,
        bottom: openUp ? window.innerHeight - rect.top + 6 : undefined,
        maxHeight: Math.max(180, Math.min(340, (openUp ? rect.top : spaceBelow) - 16)),
      });
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!rootRef.current?.contains(target) && !panelRef.current?.contains(target)) {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  useEffect(() => {
    if (open && searchable) searchRef.current?.focus();
  }, [open, searchable]);

  const choose = (next: string | number) => {
    onChange(String(next));
    setOpen(false);
    setQuery("");
    setActiveIndex(-1);
  };

  const toggle = () => {
    if (disabled) return;
    if (!open) {
      setActiveIndex(options.findIndex((option) => String(option.value) === String(value)));
    } else {
      setQuery("");
    }
    setOpen((current) => !current);
  };

  const onButtonKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return;
    if (event.key === "Escape") {
      event.stopPropagation();
      setOpen(false);
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      toggle();
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) {
        setActiveIndex(options.findIndex((option) => String(option.value) === String(value)));
        setOpen(true);
        return;
      }
      const move = event.key === "ArrowDown" ? 1 : -1;
      setActiveIndex((index) => Math.max(0, Math.min(filtered.length - 1, index + move)));
    }
  };

  const onSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      event.stopPropagation();
      setOpen(false);
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const move = event.key === "ArrowDown" ? 1 : -1;
      setActiveIndex((index) => Math.max(0, Math.min(filtered.length - 1, index + move)));
      return;
    }
    if (event.key === "Enter" && filtered[activeIndex]) {
      event.preventDefault();
      choose(filtered[activeIndex].value);
    }
  };

  const listMaxHeight = portal && placement ? Math.max(120, placement.maxHeight - (searchable ? 56 : 8)) : undefined;

  const dropdown = open && (!portal || placement) ? (
    <div
      ref={panelRef}
      style={
        portal && placement
          ? {
              position: "fixed",
              left: placement.left,
              width: placement.width,
              top: placement.top,
              bottom: placement.bottom,
              zIndex: 2147483000,
            }
          : undefined
      }
      className={
        portal
          ? "overflow-hidden rounded-xl border border-slate-200 bg-white p-1 shadow-2xl"
          : "absolute z-50 mt-1 w-full overflow-hidden rounded-xl border border-slate-200 bg-white p-1 shadow-xl"
      }
      role="presentation"
    >
      {searchable && (
        <div className="relative border-b border-slate-100 p-2">
          <Search size={15} className="pointer-events-none absolute left-4 top-4 text-slate-400" />
          <input
            ref={searchRef}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActiveIndex(0);
            }}
            onKeyDown={onSearchKeyDown}
            className="w-full rounded-lg bg-slate-50 py-2 pl-8 pr-2 text-sm outline-none focus:ring-2 focus:ring-[#b48a37]/15"
            placeholder="Buscar..."
            aria-label={`Buscar ${label ?? "opciones"}`}
          />
        </div>
      )}
      <ul
        id={`${id}-options`}
        role="listbox"
        aria-label={label}
        className="max-h-56 overflow-y-auto py-1"
        style={listMaxHeight ? { maxHeight: listMaxHeight } : undefined}
      >
        {filtered.length ? (
          filtered.map((option, index) => {
            const isSelected = String(option.value) === String(value);
            return (
              <li key={String(option.value)} role="option" aria-selected={isSelected}>
                <button
                  type="button"
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => choose(option.value)}
                  className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm ${
                    isSelected
                      ? "bg-[#fbf4e7] font-semibold text-[#172a45]"
                      : activeIndex === index
                        ? "bg-slate-50 text-[#172a45]"
                        : "text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <span className="truncate pr-2">{option.label}</span>
                  {isSelected && <Check size={15} className="shrink-0 text-[#b48a37]" />}
                </button>
              </li>
            );
          })
        ) : (
          <li className="px-3 py-3 text-sm text-slate-500">No se encontraron resultados.</li>
        )}
      </ul>
    </div>
  ) : null;

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <label
        htmlFor={id}
        className={label ? "mb-1.5 block text-[10px] font-bold uppercase tracking-[.13em] text-slate-500" : "sr-only"}
      >
        {label}
        {required && <span aria-hidden="true" className="text-red-500"> *</span>}
      </label>
      <button
        ref={buttonRef}
        id={id}
        type="button"
        disabled={disabled}
        aria-label={ariaLabel ?? label}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${id}-options`}
        onClick={toggle}
        onKeyDown={onButtonKeyDown}
        className={`flex h-10 w-full items-center justify-between gap-2 rounded-xl border bg-white px-3 text-left text-sm outline-none transition hover:border-slate-300 focus:border-[#b48a37] focus:ring-2 focus:ring-[#b48a37]/15 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400 ${
          error ? "border-red-300" : "border-slate-200"
        }`}
      >
        <span className={`truncate ${selected ? "font-medium text-[#172a45]" : "text-slate-400"}`}>
          {selected?.label ?? placeholder}
        </span>
        <ChevronDown size={16} className={`shrink-0 text-slate-400 transition ${open ? "rotate-180" : ""}`} />
      </button>
      {portal && typeof document !== "undefined" ? createPortal(dropdown, document.body) : dropdown}
      {error ? (
        <p className="mt-1 text-xs text-red-600">{error}</p>
      ) : helperText ? (
        <p className="mt-1 text-xs text-slate-500">{helperText}</p>
      ) : null}
    </div>
  );
}
