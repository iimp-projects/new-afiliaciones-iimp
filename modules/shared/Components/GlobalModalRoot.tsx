"use client";

import { useEffect, useRef, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";

const subscribe = () => () => {};
const clientSnapshot = () => true;
const serverSnapshot = () => false;

export function GlobalModalRoot({ title, children }: { title: string; children: ReactNode }) {
  const mounted = useSyncExternalStore(subscribe, clientSnapshot, serverSnapshot);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!mounted || !root) return;

    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const bodyOverflow = document.body.style.overflow;
    const pageOverflow = document.documentElement.style.overflow;
    const background = new Map<HTMLElement, boolean>();
    const blockBackground = () => {
      for (const element of Array.from(document.body.children)) {
        // The existing loader uses its own body portal above this dialog.
        if (!(element instanceof HTMLElement) || element === root || element.matches('[role="status"][aria-busy="true"]') || background.has(element)) continue;
        background.set(element, element.inert);
        element.inert = true;
      }
    };
    const focusable = () => Array.from(root.querySelectorAll<HTMLElement>('input:not(:disabled), button:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"]'))
      .filter((element) => element.getClientRects().length > 0);
    const focusInside = () => (focusable()[0] || root).focus({ preventScroll: true });
    const containFocus = (event: FocusEvent) => {
      if (!root.contains(event.target as Node)) focusInside();
    };
    const containTab = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const elements = focusable();
      const first = elements[0] || root;
      const last = elements[elements.length - 1] || root;
      if (event.shiftKey && (document.activeElement === first || document.activeElement === root)) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === root)) {
        event.preventDefault(); first.focus();
      }
    };

    blockBackground();
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    focusInside();
    const observer = new MutationObserver(blockBackground);
    observer.observe(document.body, { childList: true });
    document.addEventListener("focusin", containFocus);
    root.addEventListener("keydown", containTab);

    return () => {
      observer.disconnect();
      document.removeEventListener("focusin", containFocus);
      root.removeEventListener("keydown", containTab);
      for (const [element, wasInert] of background) element.inert = wasInert;
      document.body.style.overflow = bodyOverflow;
      document.documentElement.style.overflow = pageOverflow;
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    };
  }, [mounted]);

  if (!mounted) return null;

  // The whole backdrop is global; 9998 keeps the existing 9999 loader on top.
  return createPortal(<div ref={rootRef} tabIndex={-1} className="fixed inset-0 w-screen h-dvh z-[9998] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={title}>
    {children}
  </div>, document.body);
}
