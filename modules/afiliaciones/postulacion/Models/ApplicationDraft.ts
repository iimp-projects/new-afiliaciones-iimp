import { MembershipType } from "../Types/MembershipType";

import { PersonalInformation } from "./PersonalInformation";
import { AcademicStudy } from "./AcademicStudy";
import { EmploymentInformation } from "./EmploymentInformation";
import { Endorsements } from "./Endorsements";

export interface ApplicationDraft {

    /**
     * Tipo de afiliación seleccionada.
     */
    membershipType: MembershipType;

    /**
     * Paso 1
     * Información personal del postulante.
     */
    personalInformation?: PersonalInformation;

    /**
     * Paso 2
     * Estudios académicos registrados por el postulante.
     */
    academicStudies?: AcademicStudy[];

    /**
     * Paso 3
     * Información del centro de trabajo actual o último empleo.
     */
    employmentInformation?: EmploymentInformation;

    /**
     * Paso 4
     * Avales que respaldan la postulación y
     * aceptación de la Declaración Jurada.
     */
    endorsements?: Endorsements;

}