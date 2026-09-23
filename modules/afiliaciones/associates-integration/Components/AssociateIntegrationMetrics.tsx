import { AlertCircle, CheckCircle2, Clock3, RefreshCw } from "lucide-react";

type Props = { total: number; synced: number; pendingRetry: number; failed: number };
const cards = [{ key: "total", label: "Total", hint: "Según filtros", Icon: Clock3, tone: "text-slate-500" }, { key: "synced", label: "Sincronizados", hint: "En esta página", Icon: CheckCircle2, tone: "text-emerald-600" }, { key: "pendingRetry", label: "Pendientes / reintento", hint: "En esta página", Icon: RefreshCw, tone: "text-amber-600" }, { key: "failed", label: "Requieren revisión", hint: "En esta página", Icon: AlertCircle, tone: "text-rose-600" }] as const;

export function AssociateIntegrationMetrics(props: Props) {
  return <section aria-label="Resumen de integraciones" className="grid grid-cols-2 gap-3 lg:grid-cols-4">{cards.map(({ key, label, hint, Icon, tone }) => <article key={key} className="min-w-0 rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm"><div className="flex items-start justify-between gap-2"><p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</p><Icon size={16} className={tone} /></div><p className="mt-2 text-2xl font-black tracking-tight text-slate-800">{props[key]}</p><p className="mt-0.5 text-[11px] font-medium text-slate-400">{hint}</p></article>)}</section>;
}
