"use client";

import { DynamicIcon } from "@/modules/layout/Utils/DynamicIcon";
import { mockWorkspaceMetrics } from "../../Mocks/ExpedientesMockData";
import { useWorkspaceFilters } from "../../Hooks/useWorkspaceFilters";
import type { MetricSemanticColor } from "../../Contracts/WorkspaceContracts";

const colorStyles: Record<MetricSemanticColor, { bg: string, text: string, activeRing: string }> = {
    danger:  { bg: "bg-red-50", text: "text-red-600", activeRing: "ring-red-500/50" },
    warning: { bg: "bg-amber-50", text: "text-amber-600", activeRing: "ring-amber-500/50" },
    info:    { bg: "bg-blue-50", text: "text-blue-600", activeRing: "ring-blue-500/50" },
    success: { bg: "bg-emerald-50", text: "text-emerald-600", activeRing: "ring-emerald-500/50" },
    neutral: { bg: "bg-slate-100", text: "text-slate-600", activeRing: "ring-slate-400/50" },
};

export function MetricsRow() {
    const { applyTacticalFilter, isFilterActive } = useWorkspaceFilters();

    return (
        <div className="flex flex-wrap items-center gap-3">
            {mockWorkspaceMetrics.map((metric) => {
                const isActive = isFilterActive(metric.filterPayload);
                const styles = colorStyles[metric.color];

                return (
                    <button
                        key={metric.id}
                        onClick={() => applyTacticalFilter(metric.filterPayload)}
                        className={`relative flex items-center gap-3 px-4 py-3 rounded-2xl border transition-all duration-200 outline-none ${isActive ? `bg-white border-transparent shadow-md ring-2 ${styles.activeRing} scale-[1.02]` : `bg-white/60 border-slate-200 hover:bg-white hover:shadow-sm hover:border-slate-300`}`}
                    >
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${styles.bg} ${styles.text}`}>
                            <DynamicIcon name={metric.icon} size={20} strokeWidth={2.5} />
                        </div>
                        <div className="flex flex-col items-start text-left">
                            <span className={`text-xl font-black leading-none ${isActive ? 'text-slate-800' : 'text-slate-600'}`}>{metric.count}</span>
                            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mt-0.5">{metric.label}</span>
                        </div>
                    </button>
                );
            })}
        </div>
    );
}