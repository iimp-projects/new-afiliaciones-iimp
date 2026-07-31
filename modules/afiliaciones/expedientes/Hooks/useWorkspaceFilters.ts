"use client";

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useCallback } from 'react';
import type { ExpedientesSearchFilters } from '../Contracts/WorkspaceContracts';

export function useWorkspaceFilters() {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    // Aplica filtros tácticos (reemplazando los anteriores para no mezclarlos)
    const applyTacticalFilter = useCallback((filters: Partial<ExpedientesSearchFilters>) => {
        const params = new URLSearchParams(); // Empezamos limpio
        
        // Mantenemos la búsqueda en texto si existía
        const currentQuery = searchParams.get("query");
        if (currentQuery) params.set("query", currentQuery);

        // Inyectamos los nuevos filtros de la métrica
        Object.entries(filters).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
                params.set(key, String(value));
            }
        });

        // Hacemos push a la URL (esto dispara una navegación shallow en App Router)
        router.push(`${pathname}?${params.toString()}`);
    }, [pathname, searchParams, router]);

    // Comprueba si una métrica está activa comparando su payload con la URL actual
    const isFilterActive = useCallback((filters: Partial<ExpedientesSearchFilters>) => {
        if (Object.keys(filters).length === 0) {
            // Es la métrica "Todos", está activa si no hay filtros específicos
            return !searchParams.has("status") && !searchParams.has("priority") && !searchParams.has("requiresAttention");
        }
        
        // Verifica si todos los filtros del payload están en la URL
        return Object.entries(filters).every(([key, value]) => 
            searchParams.get(key) === String(value)
        );
    }, [searchParams]);

    return { searchParams, applyTacticalFilter, isFilterActive };
}