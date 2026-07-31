export function StatusBadge({ status }: { status: string }) {
    const config: Record<string, { label: string, classes: string }> = {
        SUBMITTED: { label: "Ingresado", classes: "bg-blue-50 text-blue-700 border-blue-200" },
        AWAITING_ENDORSEMENTS: { label: "Avales", classes: "bg-purple-50 text-purple-700 border-purple-200" },
        UNDER_EVALUATION: { label: "En Evaluación", classes: "bg-amber-50 text-amber-700 border-amber-200" },
        OBSERVED: { label: "Observado", classes: "bg-red-50 text-red-700 border-red-200" },
        APPROVED: { label: "Aprobado", classes: "bg-emerald-50 text-emerald-700 border-emerald-200" },
        REJECTED: { label: "Rechazado", classes: "bg-slate-100 text-slate-500 border-slate-300" },
    };

    const current = config[status] || { label: status, classes: "bg-gray-100 text-gray-600 border-gray-200" };

    return (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest border ${current.classes}`}>
            {current.label}
        </span>
    );
}