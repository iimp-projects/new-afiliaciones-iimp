type Props = { rows?: number };

export function DataLoadingState({ rows = 5 }: Props) {
  return <div aria-label="Cargando registros" className="space-y-3 p-5">{Array.from({ length: rows }).map((_, index) => <div key={index} className="h-14 animate-pulse rounded-xl bg-slate-100" />)}</div>;
}
