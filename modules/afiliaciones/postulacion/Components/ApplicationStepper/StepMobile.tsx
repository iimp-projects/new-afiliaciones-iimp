"use client";

import { Check } from "lucide-react";

import type { ApplicationStep } from "../../Types/ApplicationStep";

interface StepMobileProps {
  steps: ApplicationStep[];

  currentStep: number;

  completedSteps: number[];

  onStepChange?: (step: number) => void;
}

export default function StepMobile({
  steps,

  currentStep,

  completedSteps,

  onStepChange,
}: StepMobileProps) {
  return (
    <div className="md:hidden space-y-3">
      {steps.map((step) => {
        const Icon = step.icon;

        const active = step.id === currentStep;

        const completed = completedSteps.includes(step.id);

        const locked = !completed && step.id > currentStep;

        return (
          <button
            key={step.id}
            type="button"
            disabled={locked || active}
            onClick={() => onStepChange?.(step.id)}
            className={`
                                w-full
                                flex
                                items-center
                                gap-4
                                rounded-2xl
                                px-4
                                py-4
                                transition-all

                                ${
                                  active
                                    ? "bg-white text-[#C5A059] shadow-xl"
                                    : completed
                                      ? "bg-emerald-500 text-white"
                                      : locked
                                        ? "bg-white/5 text-white/40"
                                        : "bg-white/10 backdrop-blur-md text-white"
                                }

                            `}
          >
            <div
              className="
                                    w-12
                                    h-12
                                    rounded-xl
                                    flex
                                    items-center
                                    justify-center
                                    bg-black/5
                                "
            >
              {completed ? <Check size={20} /> : <Icon size={20} />}
            </div>

            <div className="flex-1 text-left">
              <p
                className="
                                        text-xs
                                        uppercase
                                        opacity-70
                                    "
              >
                Paso {step.id}
              </p>

              <p
                className="
                                        font-semibold
                                    "
              >
                {step.title}
              </p>
            </div>

            {active && (
              <span
                className="
                                            px-2
                                            py-1
                                            rounded-full
                                            text-[10px]
                                            font-bold
                                            bg-[#C5A059]
                                            text-white
                                        "
              >
                ACTUAL
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
