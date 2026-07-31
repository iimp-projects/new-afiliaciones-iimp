"use client";
import { useMemo } from "react";

const gradients = [
  "from-blue-500 to-indigo-600",
  "from-emerald-400 to-teal-600",
  "from-amber-400 to-orange-500",
  "from-rose-400 to-red-600",
  "from-violet-500 to-fuchsia-600",
  "from-[#D6A84A] to-[#8C6215]", 
];

interface FallbackAvatarProps {
  identifier: string;
  initials: string;
  size?: number;
}

export function FallbackAvatar({ identifier, initials, size = 80 }: FallbackAvatarProps) {
  const gradientClass = useMemo(() => {
    let hash = 0;
    for (let i = 0; i < identifier.length; i++) {
      hash = identifier.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % gradients.length;
    return gradients[index];
  }, [identifier]);

  return (
    <div 
      className={`rounded-2xl shadow-sm bg-gradient-to-br flex items-center justify-center text-white font-black tracking-widest shrink-0 ${gradientClass}`}
      style={{ width: size, height: size, fontSize: size * 0.35 }}
    >
      {initials}
    </div>
  );
}