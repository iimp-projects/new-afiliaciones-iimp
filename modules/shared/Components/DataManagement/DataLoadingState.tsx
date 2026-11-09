import { Skeleton } from "../Skeleton";

type Props = { rows?: number };

export function DataLoadingState({ rows = 5 }: Props) {
  return <div aria-label="Cargando registros" className="space-y-3 p-5">{Array.from({ length: rows }).map((_, index) => <Skeleton key={index} className="h-14" />)}</div>;
}
