"use client";

import StepItem from "./StepItem";
import StepProgress from "./StepProgress";

import type { ApplicationStep } from "../../Types/ApplicationStep";

interface StepDesktopProps {
  steps: ApplicationStep[];

  currentStep: number;

  completedSteps: number[];

  onStepChange?: (step: number) => void;
}

export default function StepDesktop({
  steps,

  currentStep,

  completedSteps,

  onStepChange,
}: StepDesktopProps) {
  return (
    <div className="hidden md:block relative">
      <StepProgress currentStep={currentStep} totalSteps={steps.length} />

      <div
        className={`
                    grid
                    relative
                    gap-4
                    lg:gap-6
                `}
        style={{
          gridTemplateColumns: `repeat(${steps.length}, minmax(0,1fr))`,
        }}
      >
        {steps.map((step) => (
          <StepItem
            key={step.id}
            step={step}
            isActive={step.id === currentStep}
            isCompleted={completedSteps.includes(step.id)}
            isLocked={
              !completedSteps.includes(step.id) && step.id > currentStep
            }
            onClick={() => onStepChange?.(step.id)}
          />
        ))}
      </div>
    </div>
  );
}
