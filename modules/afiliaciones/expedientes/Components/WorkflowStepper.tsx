export function WorkflowStepper({ currentStep, status }: { currentStep: number, status: string }) {
    const totalSteps = 5;
    const isError = status === 'OBSERVED' || status === 'REJECTED';

    return (
        <div className="flex items-center gap-1 w-full">
            {Array.from({ length: totalSteps }).map((_, i) => {
                const step = i + 1;
                const isCompleted = step < currentStep;
                const isCurrent = step === currentStep;
                
                let bgColor = "bg-slate-100"; // Pending
                if (isCompleted) bgColor = "bg-emerald-500";
                if (isCurrent) bgColor = isError ? "bg-red-500 animate-pulse" : "bg-[#C5A059] animate-pulse";

                return (
                    <div key={step} className={`h-1.5 flex-1 rounded-full ${bgColor}`} />
                );
            })}
        </div>
    );
}