"use client";
import type { WorkflowData } from "./types";

export function MicroPipeline({ workflow }: { workflow: WorkflowData }) {
  return (
    <div className="flex items-center gap-1 w-full h-1.5" title={`Paso actual: ${workflow.steps[workflow.currentStepIndex]?.label}`}>
      {workflow.steps.map((step) => {
        let bgColor = "bg-slate-200"; 
        
        if (step.state === "completed") {
          bgColor = "bg-emerald-500";
        } else if (step.state === "current") {
          bgColor = "bg-[#C5A059] animate-pulse shadow-[0_0_8px_rgba(197,160,89,0.8)]";
        } else if (step.state === "blocked") {
          bgColor = "bg-red-500 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.8)]";
        }

        return (
          <div key={step.id} className={`h-full flex-1 rounded-full transition-all duration-500 ${bgColor}`} />
        );
      })}
    </div>
  );
}