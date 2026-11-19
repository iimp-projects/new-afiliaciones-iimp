"use client";

import { useEffect, useRef, useState, type ElementType } from "react";
import { createPortal } from "react-dom";
import { MoreVertical } from "lucide-react";

export type DataAction<T> = { key: string; label: string; icon?: ElementType; visible?: boolean | ((row: T) => boolean); disabled?: boolean | ((row: T) => boolean); destructive?: boolean; tooltip?: string; onClick: (row: T) => void };

const MENU_MARGIN = 8;
const MENU_WIDTH = 192;

export function DataActionMenu<T>({ row, actions }: { row: T; actions: DataAction<T>[] }) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const visibleActions = actions.filter((action) => typeof action.visible === "function" ? action.visible(row) : action.visible !== false);

  useEffect(() => {
    if (!open) return;

    const place = () => {
      const button = buttonRef.current;
      const menu = menuRef.current;
      if (!button || !menu) return;

      const rect = button.getBoundingClientRect();
      const menuWidth = menu.offsetWidth || MENU_WIDTH;
      const menuHeight = menu.offsetHeight || 160;
      const openUp = rect.bottom + menuHeight + MENU_MARGIN > window.innerHeight;
      const top = openUp ? Math.max(MENU_MARGIN, rect.top - menuHeight - 4) : rect.bottom + 4;
      const left = Math.max(MENU_MARGIN, Math.min(rect.right - menuWidth, window.innerWidth - menuWidth - MENU_MARGIN));

      setCoords({ top, left });
    };

    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const close = (event: MouseEvent) => {
      const target = event.target as Node;
      if (menuRef.current?.contains(target)) return;
      if (buttonRef.current?.contains(target)) return;
      setOpen(false);
    };

    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  return <>
    <button
      ref={buttonRef}
      aria-label="Acciones"
      aria-haspopup="menu"
      aria-expanded={open}
      title="Acciones"
      onClick={() => { setCoords(null); setOpen(!open); }}
      className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-[#a67c00]"
    >
      <MoreVertical size={18} />
    </button>
    {open && typeof document !== "undefined" && createPortal(
      <div
        ref={menuRef}
        role="menu"
        style={{ position: "fixed", top: coords?.top ?? 0, left: coords?.left ?? 0, visibility: coords ? "visible" : "hidden" }}
        className="z-[200] w-48 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl"
      >
        {visibleActions.map((action, index) => {
          const Icon = action.icon;
          const disabled = typeof action.disabled === "function" ? action.disabled(row) : action.disabled;
          return <div key={action.key}>{index > 0 && action.destructive && <div className="my-1 border-t border-slate-100" />}<button title={action.tooltip} disabled={disabled} onClick={() => { setOpen(false); action.onClick(row); }} className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-bold hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 ${action.destructive ? "text-amber-700 hover:bg-amber-50" : "text-slate-600"}`}>{Icon && <Icon size={14} />}{action.label}</button></div>;
        })}
      </div>,
      document.body
    )}
  </>;
}
