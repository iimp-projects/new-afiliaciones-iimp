import type { CSSProperties } from "react";

interface SkeletonProps {
  className?: string;
  style?: CSSProperties;
}

export function Skeleton({ className = "", style }: SkeletonProps) {
  return (
    <div className={`relative overflow-hidden rounded-xl bg-slate-100 ${className}`} style={style}>
      <div className="absolute inset-0 animate-shimmer bg-gradient-to-r from-transparent via-white/70 to-transparent" aria-hidden="true" />
    </div>
  );
}
