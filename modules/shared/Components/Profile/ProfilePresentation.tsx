import type { ReactNode } from "react";

const missing = "No registrado";

export function ProfileReadField({ label, value }: { label: string | null; value: string | number | null | undefined }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-[.13em] text-slate-400">{label ?? missing}</p>
      <p className="mt-1 text-sm font-semibold text-[#172a45]">{value || missing}</p>
    </div>
  );
}

export function ProfileCard({ title, icon, children, tone = "default" }: { title: string; icon: ReactNode; children: ReactNode; tone?: "default" | "membership" }) {
  return (
    <section className={`rounded-2xl border p-5 shadow-sm ${tone === "membership" ? "border-[#e6d2a5] bg-[#fcfaf5]" : "border-slate-200 bg-white"}`}>
      <h2 className={`flex items-center gap-2 border-b pb-3 font-extrabold text-[#172a45] ${tone === "membership" ? "border-[#ead9b9]" : "border-slate-100"}`}>
        {icon}
        {title}
      </h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}
