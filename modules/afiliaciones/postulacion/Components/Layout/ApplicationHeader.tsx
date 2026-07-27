"use client";

import Link from "next/link";
import { UserCircle2 } from "lucide-react";

import Stepper from "../ApplicationStepper/Stepper";

import { MembershipType } from "../../Types/MembershipType";

interface ApplicationHeaderProps {
  membershipType: MembershipType;

  currentStep: number;

  completedSteps: number[];

  title: string;

  description: string;

  onStepChange?(step: number): void;
}

const membershipLabels: Record<MembershipType, string> = {
  ACTIVE: "Asociado Activo",
  STUDENT: "Asociado Estudiante",
};

export default function ApplicationHeader({
  membershipType,
  currentStep,
  completedSteps,
  title,
  description,
  onStepChange,
}: ApplicationHeaderProps) {
  return (
    <>
      {/* HERO */}
      <div className="absolute top-0 left-0 w-full h-[650px] bg-gradient-to-br from-[#2a1700] via-[#C5A059]/90 to-[#4a2d00] z-0 overflow-hidden">
        <div
          className="absolute inset-0 opacity-20 mix-blend-overlay bg-cover bg-center"
          style={{
            backgroundImage: "url('/images/minero.jpg')",
          }}
        />

        <div className="absolute bottom-0 left-0 w-full h-40 bg-gradient-to-t from-[#F7F8FA] to-transparent" />
      </div>

      <div className="relative z-20">
        {/* NAVBAR */}

        <nav className="w-full px-6 py-6 flex justify-between items-center max-w-5xl mx-auto">
          <img
            src="/images/logo-iimp.png"
            alt="IIMP"
            className="h-12 w-auto brightness-0 invert drop-shadow-md"
          />

          <Link
            href="/login"
            className="
                            px-5
                            py-2.5
                            rounded-xl
                            bg-white/10
                            hover:bg-white/20
                            text-white
                            font-bold
                            text-sm
                            border
                            border-white/20
                            backdrop-blur-md
                            transition-all
                            flex
                            items-center
                            gap-2
                            shadow-lg
                        "
          >
            <UserCircle2 size={18} />
            Iniciar Sesión
          </Link>
        </nav>

        {/* CONTENIDO */}

        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="mt-10 mb-14">
            <Stepper
              membershipType={membershipType}
              currentStep={currentStep}
              completedSteps={completedSteps}
              onStepChange={onStepChange}
            />
          </div>

          <div className="pb-10">
            <div className="flex items-center gap-3 mb-4">
              <span className="px-3 py-1 rounded-full bg-white/20 border border-white/30 text-white text-xs font-bold uppercase tracking-widest backdrop-blur-sm">
                Afiliaciones IIMP
              </span>

              <span className="px-3 py-1 rounded-full bg-[#FFFDF8] text-[#C5A059] text-xs font-extrabold uppercase tracking-widest shadow-sm">
                {membershipLabels[membershipType]}
              </span>
            </div>

            <h1 className="text-4xl md:text-5xl font-extrabold text-white tracking-tight drop-shadow-lg mb-4">
              {title}
            </h1>

            <p className="text-lg text-white/90 font-medium">{description}</p>
          </div>
        </div>
      </div>
    </>
  );
}
