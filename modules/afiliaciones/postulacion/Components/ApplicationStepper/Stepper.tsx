"use client";

import StepDesktop from "./StepDesktop";
import StepMobile from "./StepMobile";

import { getApplicationSteps } from "../../Constants/Steps";

import { MembershipType } from "../../Types/MembershipType";

interface StepperProps {

    membershipType: MembershipType;

    currentStep: number;

    completedSteps: number[];

    onStepChange?: (step: number) => void;

}

export default function Stepper({

    membershipType,

    currentStep,

    completedSteps,

    onStepChange,

}: StepperProps) {

    const steps = getApplicationSteps(
        membershipType,
    );

    return (

        <div className="w-full">

            <StepMobile

                steps={steps}

                currentStep={currentStep}

                completedSteps={completedSteps}

                onStepChange={onStepChange}

            />

            <StepDesktop

                steps={steps}

                currentStep={currentStep}

                completedSteps={completedSteps}

                onStepChange={onStepChange}

            />

        </div>

    );

}