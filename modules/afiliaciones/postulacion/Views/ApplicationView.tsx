"use client";

import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { useRouter } from "next/navigation";
// Asegúrate de tener todos estos iconos importados
import {
  CheckCircle2,
  XCircle,
  ArrowRight,
  UserCircle2,
  ShieldCheck,
  Mail,
  Clock,
  MapPin,
  Phone,
  Info,
} from "lucide-react";
import Link from "next/link";
import confetti from "canvas-confetti";

// Layout Components
import ApplicationHeader from "../Components/Layout/ApplicationHeader";
import ApplicationFooter from "../Components/Layout/ApplicationFooter";
import {
  getApplicationSteps,
  getTotalApplicationSteps,
} from "../Constants/Steps";

// Step Components
import PersonalDataStep, {
  StepRef,
} from "../Components/ApplicationStepper/PersonalDataStep";
import EducationStep from "../Components/ApplicationStepper/EducationStep";
import ExperienceStep from "../Components/ApplicationStepper/EmploymentStep";
import EndorsementsStep from "../Components/ApplicationStepper/EndorsementsStep";
import DeclarationStep from "../Components/ApplicationStepper/DeclarationStep";

import { ApplicationApi } from "../Services/ApplicationApi";
import { resolvePersonalInformationUploads } from "../Services/PersonalInformationUploads";
import type { ApplicationDraft } from "../Models/ApplicationDraft";
import type { PersonalInformation } from "../Models/PersonalInformation";
import { MembershipType } from "../Types/MembershipType";
import { ProcessLoadingOverlay } from "@/modules/shared/Components/ProcessLoadingOverlay";
import { ApplicationStateNotice } from "../Components/ApplicationStateNotice";
import { ApplicationApiError } from "../Services/ApplicationApiError";

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
  const router = useRouter();
  const stepRef = useRef<StepRef>(null);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [application, setApplication] = useState<string | null>(
    trackingCode ?? null,
  );
  const [applicationId, setApplicationId] = useState<number | null>(null);
  const [isStepValid, setIsStepValid] = useState(false);
  const [flowError, setFlowError] = useState<{ code: string; message: string } | null>(null);
  useEffect(() => {
    const handleFlow = (event: Event) => setFlowError((event as CustomEvent<{ code: string; message: string }>).detail);
    window.addEventListener("application:flow", handleFlow);
    return () => window.removeEventListener("application:flow", handleFlow);
  }, []);

  // ESTADO QUE CONTROLA SI YA SE ENVIÓ PARA MOSTRAR LA PANTALLA FINAL
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [recoveryMessage, setRecoveryMessage] = useState<string | null>(null);
  const submissionConfettiFiredRef = useRef(false);

  const [draft, setDraft] = useState<ApplicationDraft>({
    ...emptyDraft,
    membershipType,
  });
  const [currentStep, setCurrentStep] = useState(1);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);

  const refreshCompletedSteps = useCallback((step: number) => {
    setCompletedSteps((previous) => {
      if (previous.includes(step)) return previous;
      return [...previous, step];
    });
  }, []);

  const initialize = useCallback(async () => {
    if (!trackingCode) return;
    try {
      setLoading(true);
      const response = await api.getByTracking(trackingCode);
      if (response.affiliateType !== membershipType) {
        router.replace(`/postulacion/${response.affiliateType === "STUDENT" ? "estudiante" : "asociado"}?trackingCode=${encodeURIComponent(response.trackingCode)}`);
        return;
      }
      setApplication(response.trackingCode);
      setApplicationId(response.id);

      setCurrentStep(response.currentStep);

      const restoredCompletedSteps = [];
      for (let i = 1; i < response.currentStep; i++) {
        restoredCompletedSteps.push(i);
      }
      setCompletedSteps(restoredCompletedSteps);

      const applicationDraft = (response.draftData ??
        {}) as unknown as ApplicationDraft;
      setDraft({ ...applicationDraft, membershipType });

      setRecoveryMessage(
        `¡Bienvenido de vuelta! Hemos recuperado tu información de forma segura. Continúa tu postulación en el Paso ${response.currentStep}.`,
      );
      setTimeout(() => setRecoveryMessage(null), 10000);
    } catch (error) {
      setFlowError({ code: error instanceof ApplicationApiError ? error.code : "VERIFICATION_REQUIRED", message: error instanceof Error ? error.message : "Verifica tu identidad para continuar." });
    } finally {
      setLoading(false);
    }
  }, [api, membershipType, trackingCode, router]);

  useEffect(() => {
    initialize();
  }, [initialize]);

  // ========================================================
  // LÓGICA DE GUARDADO Y ENVÍO FINAL
  // ========================================================
  const savePersonalInformation = async (
    personalInformation: PersonalInformation,
  ): Promise<void> => {
    setSaving(true);
    try {
      // El upload exige una postulación autorizada (cookie de acceso). Por eso
      // el borrador debe existir ANTES de subir los archivos del paso.
      let currentApplication = application;
      if (!currentApplication) {
        const response = await api.start({
          affiliateType: membershipType,
          documentType: personalInformation.documentType,
          documentNumber: personalInformation.documentNumber,
          email: personalInformation.primaryEmail,
          phone: personalInformation.phone,
        });
        currentApplication = response.trackingCode;
        setApplication(response.trackingCode);
        setApplicationId(response.id);
      }

      const resolvedPersonalInformation = await resolvePersonalInformationUploads(
        personalInformation,
        (file, folder) => api.uploadFile(file, folder),
      );

      const newDraft: ApplicationDraft = {
        ...draft,
        membershipType,
        personalInformation: resolvedPersonalInformation,
      };
      setDraft(newDraft);
      await api.updateDraft(currentApplication, { currentStep, draftData: newDraft });
    } catch (error) {
      throw error;
    } finally {
      setSaving(false);
    }
  };

  const saveAcademicStudies = async (
    academicStudies: ApplicationDraft["academicStudies"],
  ): Promise<void> => {
    if (!application) return;
    setSaving(true);
    try {
      const newDraft: ApplicationDraft = { ...draft, academicStudies };
      setDraft(newDraft);
      await api.updateDraft(application, { currentStep, draftData: newDraft });
    } catch (error) {
      throw error;
    } finally {
      setSaving(false);
    }
  };

  const saveEmploymentInformation = async (
    employmentInformation: ApplicationDraft["employmentInformation"],
  ): Promise<void> => {
    if (!application) return;
    setSaving(true);
    try {
      const newDraft: ApplicationDraft = { ...draft, employmentInformation };
      setDraft(newDraft);
      await api.updateDraft(application, { currentStep, draftData: newDraft });
    } catch (error) {
      throw error;
    } finally {
      setSaving(false);
    }
  };

  const saveEndorsements = async (
    endorsements: ApplicationDraft["endorsements"],
  ): Promise<void> => {
    if (!application) return;
    setSaving(true);
    try {
      const newDraft: ApplicationDraft = { ...draft, endorsements };
      setDraft(newDraft);
      await api.updateDraft(application, { currentStep, draftData: newDraft });
    } catch (error) {
      throw error;
    } finally {
      setSaving(false);
    }
  };

  const submitFinalApplication = async (): Promise<void> => {
    if (!application) return;
    setSaving(true);
    try {
      await api.submit(application);

      // Transformamos la vista a la pantalla de éxito
      setIsSubmitted(true);
      window.scrollTo({ top: 0, behavior: "smooth" });

      // Celebramos con confetti (una sola vez, respetando reduced-motion)
      fireSubmissionConfetti();
    } catch (error) {
      throw error;
    } finally {
      setSaving(false);
    }
  };

  const fireSubmissionConfetti = () => {
    if (submissionConfettiFiredRef.current) return;
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    submissionConfettiFiredRef.current = true;

    const duration = 3 * 1000;
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 150 };
    const randomInRange = (min: number, max: number) =>
      Math.random() * (max - min) + min;
    const colors = ["#C5A059", "#E8D09E", "#D6A84A", "#2F3136", "#F7F8FA"];
    const interval = window.setInterval(function () {
      const timeLeft = animationEnd - Date.now();
      if (timeLeft <= 0) return window.clearInterval(interval);
      const particleCount = 50 * (timeLeft / duration);
      confetti({
        ...defaults,
        particleCount,
        colors,
        origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 },
      });
      confetti({
        ...defaults,
        particleCount,
        colors,
        origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 },
      });
    }, 250);
  };

  // ========================================================
  // CONTROL DE NAVEGACIÓN
  // ========================================================
  const nextStep = () => {
    refreshCompletedSteps(currentStep);
    setCurrentStep((previous) => previous + 1);
  };

  const previousStep = () => {
    setCurrentStep((previous) => (previous <= 1 ? 1 : previous - 1));
  };

  const changeStep = (step: number) => {
    if (completedSteps.includes(step)) setCurrentStep(step);
  };

  const handleFooterNext = () => {
    if (stepRef.current) {
      stepRef.current.submit();
    } else {
      nextStep();
    }
  };

  const getStepInfo = (step: number) => {
    switch (step) {
      case 1:
        return {
          title: "Datos Personales",
          description: "Complete la información requerida...",
        };
      case 2:
        return {
          title: "Formación Académica",
          description: "Registre sus grados académicos...",
        };
      case 3:
        return {
          title: "Experiencia Laboral",
          description: "Registre su centro de trabajo...",
        };
      case 4:
        return {
          title: "Avales Institucionales",
          description: "Registre a los asociados hábiles que lo presentan.",
        };
      case 5:
        return {
          title: "Declaración Jurada",
          description: "Genere y adjunte su solicitud firmada.",
        };
      default:
        return { title: "", description: "" };
    }
  };

  if (flowError) {
    return <main className="min-h-screen grid place-items-center bg-slate-50 p-6"><ApplicationStateNotice status="PENDING" context="POSTULACION" title="Encontramos una solicitud asociada a este documento" description={flowError.message} onPrimary={() => router.push(flowError.code === "VERIFICATION_REQUIRED" || flowError.code === "APPLICATION_EXISTS" ? "/consulta" : "/consulta?applicationId=authorized")} onClose={() => router.push("/postulacion")} /></main>;
  }

  if (loading) {
    return (
      <div className="w-full min-h-screen flex items-center justify-center bg-[#F7F8FA]">
        <div className="flex flex-col items-center gap-3">
          <svg
            className="animate-spin h-8 w-8 text-[#C5A059]"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            ></circle>
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            ></path>
          </svg>
          <span className="text-sm font-bold text-slate-600">
            Recuperando información...
          </span>
        </div>
      </div>
    );
  }

  // ========================================================
  // PANTALLA DE ÉXITO (Reemplaza a FinishStep por completo)
  // ========================================================
  if (isSubmitted) {
    const isStudent = membershipType === MembershipType.STUDENT;
    return (
      <div className="w-full min-h-screen bg-[#F7F8FA] relative font-sans antialiased flex flex-col">
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-[#2a1700] via-[#C5A059]/90 to-[#4a2d00] z-0 overflow-hidden">
          <div
            className="absolute inset-0 z-0 opacity-20 mix-blend-overlay bg-cover bg-center"
            style={{ backgroundImage: "url('/images/minero.jpg')" }}
          ></div>
          <div className="absolute bottom-0 left-0 w-full h-[50vh] bg-gradient-to-t from-[#F7F8FA] to-transparent z-10"></div>
        </div>

        <div className="relative z-20 flex flex-col flex-1">
          <nav className="w-full px-6 py-6 flex justify-between items-center max-w-5xl mx-auto">
            <img
              src="/images/logo-iimp.png"
              alt="IIMP Logo"
              className="h-12 w-auto brightness-0 invert drop-shadow-md"
            />
            <Link
              href="/login"
              className="px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-sm border border-white/20 backdrop-blur-md transition-all flex items-center gap-2 shadow-lg"
            >
              <UserCircle2 size={18} /> Iniciar Sesión
            </Link>
          </nav>

          <div className="flex-1 flex items-center justify-center p-4 sm:p-6 w-full max-w-4xl mx-auto pb-20">
            <section className="bg-white rounded-[32px] border border-gray-200 shadow-2xl overflow-hidden text-center relative w-full mt-4 animate-in fade-in slide-in-from-bottom-8 duration-700">
              <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-[#C5A059] to-[#E8D09E]"></div>

              <div className="p-8 sm:p-12">
                <div className="mx-auto w-20 h-20 rounded-full bg-emerald-50 border-4 border-emerald-100 flex items-center justify-center mb-6 shadow-sm animate-[bounce_1s_ease-in-out_1]">
                  <CheckCircle2 className="w-10 h-10 text-emerald-500" />
                </div>
                <span className="inline-block px-4 py-1.5 rounded-full bg-[#C5A059]/10 text-[#C5A059] text-xs font-bold uppercase tracking-widest mb-4 border border-[#C5A059]/20">
                  Postulación Enviada con Éxito
                </span>
                <h1 className="text-3xl md:text-4xl font-black text-[#1E293B] tracking-tight mb-4">
                  ¡Hemos recibido su solicitud!
                </h1>
                <p className="text-lg text-gray-500 font-medium mb-10 max-w-xl mx-auto leading-relaxed">
                  Su expediente de postulación como{" "}
                  <strong>
                    {isStudent ? "Asociado Estudiante" : "Asociado Activo"}
                  </strong>{" "}
                  ha sido registrado y se encuentra en etapa de evaluación.
                </p>

                {/* GRID DE INFORMACIÓN (Qué sigue + Contacto) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10 text-left">
                  {/* COLUMNA 1: Próximos pasos */}
                  <div className="bg-[#F7F8FA] border border-gray-200 rounded-2xl p-6 shadow-sm">
                    <h3 className="font-bold text-[#2F3136] mb-5 uppercase tracking-wide text-sm flex items-center gap-2">
                      <ShieldCheck size={18} className="text-[#C5A059]" />
                      ¿Qué sucederá ahora?
                    </h3>
                    <ul className="space-y-4">
                      <li className="flex items-start gap-3">
                        <span className="w-6 h-6 rounded-full bg-white border border-gray-200 flex items-center justify-center shrink-0 shadow-sm text-[#C5A059] font-bold text-xs mt-0.5">
                          1
                        </span>
                        <p className="text-sm text-gray-600 font-medium leading-relaxed">
                          Su expediente pasará a una{" "}
                          <strong>
                            revisión detallada por nuestro personal
                            administrativo
                          </strong>
                          .
                        </p>
                      </li>
                      <li className="flex items-start gap-3">
                        <span className="w-6 h-6 rounded-full bg-white border border-gray-200 flex items-center justify-center shrink-0 shadow-sm text-[#C5A059] font-bold text-xs mt-0.5">
                          2
                        </span>
                        <p className="text-sm text-gray-600 font-medium leading-relaxed">
                          El tiempo estimado de evaluación es de{" "}
                          <strong>3 a 5 días hábiles</strong>.
                        </p>
                      </li>
                      <li className="flex items-start gap-3">
                        <span className="w-6 h-6 rounded-full bg-white border border-gray-200 flex items-center justify-center shrink-0 shadow-sm text-[#C5A059] font-bold text-xs mt-0.5">
                          3
                        </span>
                        <p className="text-sm text-gray-600 font-medium leading-relaxed">
                          Recibirá las instrucciones de activación o pago
                          directamente en su correo principal.
                        </p>
                      </li>
                    </ul>
                  </div>

                  {/* COLUMNA 2: Datos de Contacto (Petición del usuario) */}
                  <div className="bg-[#FFFDF8] border border-[#E8D09E] rounded-2xl p-6 shadow-sm">
                    <h3 className="font-bold text-[#4a2d00] mb-5 uppercase tracking-wide text-sm flex items-center gap-2">
                      <Info size={18} className="text-[#C5A059]" />
                      Atención al Asociado
                    </h3>
                    <ul className="space-y-4">
                      <li className="flex items-start gap-3">
                        <MapPin
                          size={16}
                          className="text-[#C5A059] shrink-0 mt-0.5"
                        />
                        <span className="text-sm text-[#7f561e] leading-relaxed">
                          <strong>Dirección:</strong>
                          <br />
                          Calle los Canarios 155-157, Urb. San César II Etapa,
                          La Molina, Lima 12, Perú.
                        </span>
                      </li>
                      <li className="flex items-start gap-3">
                        <Clock
                          size={16}
                          className="text-[#C5A059] shrink-0 mt-0.5"
                        />
                        <span className="text-sm text-[#7f561e] leading-relaxed">
                          <strong>Horario de Atención:</strong>
                          <br />
                          Lunes a viernes de 08:30 a 17:30 hrs.
                        </span>
                      </li>
                      <li className="flex items-start gap-3">
                        <Mail
                          size={16}
                          className="text-[#C5A059] shrink-0 mt-0.5"
                        />
                        <span className="text-sm text-[#7f561e] leading-relaxed">
                          <strong>Correo:</strong>
                          <br />
                          asociados@iimp.org.pe
                        </span>
                      </li>
                      <li className="flex items-start gap-3">
                        <Phone
                          size={16}
                          className="text-[#C5A059] shrink-0 mt-0.5"
                        />
                        <span className="text-sm text-[#7f561e] leading-relaxed">
                          <strong>Teléfonos y Whatsapp:</strong>
                          <br />
                          +51 982 097 019 / +51 951 294 314
                        </span>
                      </li>
                    </ul>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                  <button
                    onClick={() => router.push("/")}
                    className="w-full sm:w-auto h-12 px-8 rounded-xl border-2 border-gray-200 text-slate-600 font-bold text-sm hover:bg-gray-50 transition-all flex items-center justify-center"
                  >
                    Volver al Inicio
                  </button>
                  <button
                    onClick={() => router.push("/login")}
                    className="w-full sm:w-auto h-12 px-8 rounded-xl bg-[#C5A059] hover:bg-[#b58f48] text-white font-bold text-sm shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2"
                  >
                    Ir a mi panel <ArrowRight size={18} />
                  </button>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    );
  }

  const stepInfo = getStepInfo(currentStep);

  return (
    <div className="w-full min-h-screen bg-[#F7F8FA] relative font-sans antialiased pb-24">
      <ProcessLoadingOverlay
        open={saving}
        title={currentStep === 1 ? "Guardando tus datos personales" : currentStep === 2 ? "Guardando tu información académica" : currentStep === 3 ? "Guardando tu información" : currentStep === 4 ? "Guardando tu información" : "Enviando tu postulación"}
        description={currentStep === 1 ? "Estamos preparando la información académica. Esto tomará solo unos segundos." : currentStep === 2 ? "Estamos preparando la información laboral de tu postulación." : currentStep === 3 ? "Estamos preparando la sección de avales y términos." : currentStep === 4 ? "Estamos preparando la declaración final de tu postulación." : "Estamos registrando tu solicitud. Por favor, no cierres esta ventana."}
      />
      <ApplicationHeader
        membershipType={membershipType}
        currentStep={currentStep}
        completedSteps={completedSteps}
        title={stepInfo.title}
        description={stepInfo.description}
        onStepChange={changeStep}
      />
      <main className="max-w-5xl mx-auto w-full px-4 sm:px-6 relative z-20">
        {recoveryMessage && (
          <div className="mb-8 p-4 rounded-2xl bg-[#f0faeb] border border-[#a2e584] flex items-center justify-between shadow-sm animate-in fade-in slide-in-from-top-4">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-6 h-6 text-[#2d7a0c] shrink-0" />
              <p className="text-sm font-bold text-[#1f5a04]">
                {recoveryMessage}
              </p>
            </div>
            <button
              onClick={() => setRecoveryMessage(null)}
              className="text-[#2d7a0c] hover:text-[#1f5a04] transition-colors"
            >
              <XCircle className="w-5 h-5" />
            </button>
          </div>
        )}

        {currentStep === 1 && (
          <PersonalDataStep
            affiliateType={membershipType}
            ref={stepRef}
            value={draft.personalInformation}
            saving={saving}
            onSave={savePersonalInformation}
            onNext={nextStep}
          />
        )}

        {currentStep === 2 && (
          <EducationStep
            ref={stepRef}
            membershipType={membershipType}
            value={draft.academicStudies}
            saving={saving}
            onBack={previousStep}
            onSave={saveAcademicStudies}
            // Si es estudiante no hay paso 3, le pasamos una función vacía al onNext porque onFinalSubmit toma el control
            onNext={
              membershipType === MembershipType.STUDENT ? () => {} : nextStep
            }
            onValidityChange={setIsStepValid}
            // 👇 Pasamos onFinalSubmit si es estudiante
            onFinalSubmit={
              membershipType === MembershipType.STUDENT
                ? submitFinalApplication
                : undefined
            }
          />
        )}

        {currentStep === 3 && (
          <ExperienceStep
            ref={stepRef}
            value={draft.employmentInformation}
            saving={saving}
            onBack={previousStep}
            onSave={saveEmploymentInformation}
            onNext={nextStep}
            onValidityChange={setIsStepValid}
          />
        )}

        {currentStep === 4 && (
          applicationId && <EndorsementsStep
            applicationId={applicationId}
            ref={stepRef}
            value={draft.endorsements}
            saving={saving}
            onBack={previousStep}
            onSave={saveEndorsements}
            onNext={nextStep}
            onValidityChange={setIsStepValid}
          />
        )}

        {currentStep === 5 && (
          <DeclarationStep
            ref={stepRef}
            value={draft.endorsements}
            draftContext={draft}
            saving={saving}
            onBack={previousStep}
            onSave={saveEndorsements}
            onNext={() => {}}
            onValidityChange={setIsStepValid}
            onFinalSubmit={submitFinalApplication}
          />
        )}
      </main>

      <ApplicationFooter
        currentStep={currentStep}
        isSubmitting={saving}
        showCancel={true}
        showPrevious={currentStep > 1}
        nextLabel={
          currentStep === getTotalApplicationSteps(membershipType)
            ? "ENVIAR PARA REVISIÓN"
            : "Guardar y Continuar"
        }
        onCancel={() => router.push("/login")}
        onPrevious={previousStep}
        onNext={handleFooterNext}
      />
    </div>
  );
}
