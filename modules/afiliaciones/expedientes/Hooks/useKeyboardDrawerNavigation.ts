"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import type { ExpedienteDTO } from "../Entities/ExpedienteDTO";

export function useKeyboardDrawerNavigation(expedientes: ExpedienteDTO[]) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeCaseCode = searchParams.get("case");

  useEffect(() => {
    if (!activeCaseCode || expedientes.length === 0) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Evitamos intervenir si el usuario está escribiendo en un input o textarea
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return;

      const currentIndex = expedientes.findIndex(exp => exp.applicationCode === activeCaseCode);
      if (currentIndex === -1) return;

      let newCode = null;

      if (e.key === 'ArrowDown' || e.key === 'j') {
        e.preventDefault(); // Evita scrollear la página
        if (currentIndex < expedientes.length - 1) {
          newCode = expedientes[currentIndex + 1].applicationCode;
        }
      } else if (e.key === 'ArrowUp' || e.key === 'k') {
        e.preventDefault();
        if (currentIndex > 0) {
          newCode = expedientes[currentIndex - 1].applicationCode;
        }
      }

      if (newCode) {
        const newParams = new URLSearchParams(searchParams.toString());
        newParams.set("case", newCode);
        // replace en vez de push evita llenar el historial del navegador con "flechazos"
        router.replace(`${pathname}?${newParams.toString()}`, { scroll: false }); 
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeCaseCode, expedientes, router, pathname, searchParams]);
}