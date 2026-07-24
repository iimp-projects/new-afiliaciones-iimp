import {
    User,
    GraduationCap,
    Briefcase,
    ShieldCheck,
    CheckCircle2,
} from "lucide-react";

import { MembershipType } from "../Types/MembershipType";
import type { ApplicationStep } from "../Types/ApplicationStep";

export const APPLICATION_STEPS: Record<
    MembershipType,
    ApplicationStep[]
> = {

    [MembershipType.ASSOCIATE]: [

        {
            id: 1,
            title: "DATOS PERSONALES",
            path: "personal-information",
            icon: User,
        },

        {
            id: 2,
            title: "FORMACIÓN ACADÉMICA",
            path: "academic-studies",
            icon: GraduationCap,
        },

        {
            id: 3,
            title: "EXPERIENCIA LABORAL",
            path: "employment",
            icon: Briefcase,
        },

        {
            id: 4,
            title: "AVALES Y TÉRMINOS",
            path: "endorsements",
            icon: ShieldCheck,
        },

        {
            id: 5,
            title: "FINALIZACIÓN",
            path: "finish",
            icon: CheckCircle2,
        },

    ],

    [MembershipType.STUDENT]: [

        {
            id: 1,
            title: "DATOS PERSONALES",
            path: "personal-information",
            icon: User,
        },

        {
            id: 2,
            title: "ESTUDIOS",
            path: "academic-studies",
            icon: GraduationCap,
        },

        {
            id: 3,
            title: "FINALIZACIÓN",
            path: "finish",
            icon: CheckCircle2,
        },

    ],

};

export function getApplicationSteps(
    membershipType: MembershipType
): ApplicationStep[] {

    return APPLICATION_STEPS[membershipType];

}

export function getApplicationStep(
    membershipType: MembershipType,
    currentStep: number,
): ApplicationStep | undefined {

    return APPLICATION_STEPS[membershipType]
        .find(step => step.id === currentStep);

}

export function getTotalApplicationSteps(
    membershipType: MembershipType,
): number {

    return APPLICATION_STEPS[membershipType].length;

}