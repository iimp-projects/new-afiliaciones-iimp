"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import PersonalDataStep from "../Components/ApplicationStepper/PersonalDataStep";
import EducationStep from "../Components/ApplicationStepper/EducationStep";
import Stepper from "../Components/ApplicationStepper/Stepper";

import { ApplicationApi } from "../Services/ApplicationApi";

import type { ApplicationDraft } from "../Models/ApplicationDraft";
import type { PersonalInformation } from "../Models/PersonalInformation";

import type { MembershipType } from "../Types/MembershipType";

interface ApplicationViewProps {
  membershipType: MembershipType;

  trackingCode?: string;
}

const emptyDraft: ApplicationDraft = {
  membershipType: undefined as never,

  personalInformation: undefined,

  academicStudies: [],

  employmentInformation: undefined,

  endorsements: undefined,
};

export default function ApplicationView({
  membershipType,

  trackingCode,
}: ApplicationViewProps) {
  const api = useMemo(() => new ApplicationApi(), []);

  const [loading, setLoading] = useState(false);

  const [saving, setSaving] = useState(false);

  const [application, setApplication] = useState<string | null>(
    trackingCode ?? null,
  );

  const [draft, setDraft] = useState<ApplicationDraft>({
    ...emptyDraft,
    membershipType,
  });

  const [currentStep, setCurrentStep] = useState(1);

  const [completedSteps, setCompletedSteps] = useState<number[]>([]);

  const refreshCompletedSteps = useCallback(
    (step: number) => {
      setCompletedSteps((previous) => {
        if (previous.includes(step)) {
          return previous;
        }

        return [...previous, step];
      });
    },

    [],
  );

  const initialize = useCallback(async () => {
    if (!trackingCode) {
      return;
    }

    try {
      setLoading(true);

      const response = await api.getByTracking(trackingCode);

      setApplication(response.trackingCode);

      setCurrentStep(response.currentStep);

      const applicationDraft = (response.draftData ??
        {}) as unknown as ApplicationDraft;

      setDraft({
        ...applicationDraft,

        membershipType,
      });
    } finally {
      setLoading(false);
    }
  }, [api, membershipType, trackingCode]);

  useEffect(() => {
    initialize();
  }, [initialize]);

  const savePersonalInformation = async (
    personalInformation: PersonalInformation,
  ): Promise<void> => {
    setSaving(true);

    try {
      const newDraft: ApplicationDraft = {
        ...draft,

        membershipType,

        personalInformation,
      };

      setDraft(newDraft);

      /**
       * ===============================
       * Primera vez
       * ===============================
       */
      if (!application) {
        const response = await api.start({
          affiliateType: membershipType,

          documentType: personalInformation.documentType,

          documentNumber: personalInformation.documentNumber,

          email: personalInformation.primaryEmail,

          phone: personalInformation.phone,
        });

        setApplication(response.trackingCode);

        await api.updateDraft(
          response.trackingCode,

          {
            currentStep: 1,

            draftData: newDraft,
          },
        );

        refreshCompletedSteps(1);

        setCurrentStep(2);

        return;
      }

      /**
       * ===============================
       * Ya existe la postulación
       * ===============================
       */

      await api.updateDraft(
        application,

        {
          currentStep,

          draftData: newDraft,
        },
      );
    } catch (error) {
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  const saveAcademicStudies = async (
    academicStudies: ApplicationDraft["academicStudies"],
  ): Promise<void> => {
    if (!application) {
      return;
    }

    setSaving(true);

    try {
      const newDraft: ApplicationDraft = {
        ...draft,

        academicStudies,
      };

      setDraft(newDraft);

      await api.updateDraft(
        application,

        {
          currentStep: 2,

          draftData: newDraft,
        },
      );
    } finally {
      setSaving(false);
    }
  };

  const nextStep = () => {
    refreshCompletedSteps(currentStep);

    setCurrentStep((previous) => previous + 1);
  };

  const previousStep = () => {
    setCurrentStep((previous) => {
      if (previous <= 1) {
        return 1;
      }

      return previous - 1;
    });
  };

  const changeStep = (step: number) => {
    if (completedSteps.includes(step)) {
      setCurrentStep(step);
    }
  };

  if (loading) {
    return <div className="py-20 flex justify-center">Cargando...</div>;
  }

  return (
    <div className="space-y-10">
      <Stepper
        membershipType={membershipType}
        currentStep={currentStep}
        completedSteps={completedSteps}
        onStepChange={changeStep}
      />

      {currentStep === 1 && (
        <PersonalDataStep
          value={draft.personalInformation}
          saving={saving}
          onSave={savePersonalInformation}
          onNext={nextStep}
        />
      )}

      {currentStep === 2 && (
        <EducationStep
          value={draft.academicStudies}
          saving={saving}
          onBack={previousStep}
          onSave={saveAcademicStudies}
          onNext={nextStep}
        />
      )}
    </div>
  );
}
