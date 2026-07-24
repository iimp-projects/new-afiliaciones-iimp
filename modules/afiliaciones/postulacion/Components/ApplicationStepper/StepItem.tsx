"use client";

import { Check } from "lucide-react";

import type { ApplicationStep } from "../../Types/ApplicationStep";

interface StepItemProps {
  step: ApplicationStep;

  isActive: boolean;

  isCompleted: boolean;

  isLocked: boolean;

  onClick?: () => void;
}

export default function StepItem({
  step,

  isActive,

  isCompleted,

  isLocked,

  onClick,
}: StepItemProps) {
  const Icon = step.icon;

  const clickable = !isLocked && !isActive;

  return (
    <div
      className="
                relative
                flex
                flex-col
                items-center
                text-center
            "
    >
      {isActive && (
        <div
          className="
                        absolute
                        -top-10
                        left-1/2
                        -translate-x-1/2
                        px-3
                        py-1
                        rounded-full
                        bg-white
                        text-[#C5A059]
                        text-[10px]
                        uppercase
                        font-bold
                        shadow-lg
                    "
        >
          ACTUAL
        </div>
      )}

      <button
        type="button"
        onClick={clickable ? onClick : undefined}
        disabled={!clickable}
        className={`
                    relative
                    z-10
                    w-16
                    h-16
                    rounded-2xl
                    flex
                    items-center
                    justify-center
                    transition-all
                    duration-300

                    ${
                      isCompleted
                        ? `
                                bg-emerald-500
                                text-white
                                shadow-lg
                                hover:scale-105
                              `
                        : isActive
                          ? `
                                    bg-white
                                    text-[#C5A059]
                                    scale-110
                                    shadow-[0_15px_40px_rgba(255,255,255,.35)]
                                  `
                          : isLocked
                            ? `
                                        bg-white/10
                                        border
                                        border-white/10
                                        text-white/30
                                        cursor-not-allowed
                                      `
                            : `
                                        bg-white/10
                                        backdrop-blur-md
                                        border
                                        border-white/20
                                        text-white
                                        hover:bg-white/20
                                        hover:scale-105
                                        cursor-pointer
                                      `
                    }

                `}
      >
        {isCompleted ? <Check size={24} strokeWidth={3} /> : <Icon size={24} />}
      </button>

      <span
        className={`
                    mt-4
                    text-[11px]
                    uppercase
                    tracking-[0.15em]
                    font-semibold

                    ${isActive ? "text-white" : "text-white/60"}

                `}
      >
        Paso {step.id}
      </span>

      <span
        className={`
                    mt-1
                    text-sm
                    font-bold
                    leading-tight
                    max-w-[150px]

                    ${isActive ? "text-white" : "text-white/80"}

                `}
      >
        {step.title}
      </span>
    </div>
  );
}
