import { categoryLabel, categoryStyle } from "./quotaUi";

export function CategoryBadge({ code, name }: { code?: string | null; name?: string | null }) {
  const acronym = code?.trim().toUpperCase();
  const label = categoryLabel(code, name);
  const showAcronym = Boolean(acronym) && acronym !== label.toUpperCase();
  return <span title={acronym ? `${label} (${acronym})` : label} className={`inline-flex items-center rounded-md px-2 py-1 text-[11px] font-semibold ${categoryStyle(code)}`}>
    <span>{label}{showAcronym && <span className="text-[10px] font-bold opacity-70">({acronym})</span>}</span>
  </span>;
}
