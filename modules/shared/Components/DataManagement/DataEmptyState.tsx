import type { ReactNode } from "react";
import { History } from "lucide-react";

type Props = { title: string; description: string; icon?: ReactNode; action?: ReactNode };

export function DataEmptyState({ title, description, icon, action }: Props) {
  return <section className="flex min-h-72 flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 px-6 text-center"><div className="mb-4 rounded-2xl bg-[#fdfaf5] p-4 text-[#a67c00]">{icon ?? <History size={30} />}</div><h2 className="text-lg font-black text-slate-800">{title}</h2><p className="mt-2 max-w-md text-sm leading-6 text-slate-500">{description}</p>{action && <div className="mt-5">{action}</div>}</section>;
}
