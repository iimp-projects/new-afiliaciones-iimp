"use client";

interface StepProgressProps {
  currentStep: number;

  totalSteps: number;
}

export default function StepProgress({
  currentStep,

  totalSteps,
}: StepProgressProps) {
  const progress =
    totalSteps <= 1 ? 0 : ((currentStep - 1) / (totalSteps - 1)) * 100;

  return (
    <>
      <div
        className="
                    absolute
                    top-8
                    left-0
                    w-full
                    h-[3px]
                    bg-white/20
                    rounded-full
                "
      />

      <div
        className="
                    absolute
                    top-8
                    left-0
                    h-[3px]
                    bg-white
                    rounded-full
                    transition-all
                    duration-700
                "
        style={{
          width: `${progress}%`,
        }}
      />
    </>
  );
}
