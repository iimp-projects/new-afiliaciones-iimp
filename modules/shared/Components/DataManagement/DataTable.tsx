import type { ReactNode } from "react";
import { DataLoadingState } from "./DataLoadingState";

export type DataTableColumn<T> = { key: string; header: ReactNode; width?: string; minWidth?: string; align?: "left" | "center" | "right"; render: (row: T) => ReactNode };
type Props<T> = { data: T[]; columns: DataTableColumn<T>[]; rowKey: (row: T) => string | number; loading?: boolean; emptyState?: ReactNode; minWidth?: string; rowClassName?: (row: T) => string };

export function DataTable<T>({ data, columns, rowKey, loading = false, emptyState, minWidth = "1060px", rowClassName }: Props<T>) {
  return <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="overflow-x-auto"><table className="w-full text-left" style={{ minWidth }}><thead className="border-b border-slate-200 bg-slate-50/80"><tr>{columns.map((column) => <th key={column.key} style={{ width: column.width, minWidth: column.minWidth }} className={`px-5 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400 ${column.align === "center" ? "text-center" : column.align === "right" ? "text-right" : "text-left"}`}>{column.header}</th>)}</tr></thead><tbody>{loading ? <tr><td colSpan={columns.length}><DataLoadingState /></td></tr> : data.length ? data.map((row) => <tr key={rowKey(row)} className={`border-b border-slate-100 transition-colors last:border-0 hover:bg-[#fdfaf5] ${rowClassName?.(row) ?? ""}`}>{columns.map((column) => <td key={column.key} className={`px-5 py-3.5 ${column.align === "center" ? "text-center" : column.align === "right" ? "text-right" : "text-left"}`}>{column.render(row)}</td>)}</tr>) : <tr><td colSpan={columns.length}>{emptyState}</td></tr>}</tbody></table></div></section>;
}
