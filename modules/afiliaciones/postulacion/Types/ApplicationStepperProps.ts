import { MembershipType } from './MembershipType'

export interface ApplicationStepperProps {

    membershipType: MembershipType;

    currentStep: number;

    completedSteps: number[];

    onStepChange: (step: number) => void;

}