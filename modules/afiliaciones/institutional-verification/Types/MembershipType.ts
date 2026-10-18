export const MEMBERSHIP_TYPES = [
  "ACTIVE",
  "STUDENT",
  "VITALICIO",
  "HONORARIO",
  "ADHERENTE",
  "FALLECIDO",
  "RENUNCIANTE",
  "SEPARADO",
  "ANULADO",
] as const;

export type MembershipType = (typeof MEMBERSHIP_TYPES)[number];

/** Tipos elegibles para el beneficio institucional de inscripción (PERUMIN). */
export const ELIGIBLE_MEMBERSHIP_TYPES: readonly MembershipType[] = [
  "ACTIVE",
  "STUDENT",
  "VITALICIO",
  "HONORARIO",
];

/** Tipos que existen en SIE pero no otorgan elegibilidad. */
export const INELIGIBLE_MEMBERSHIP_TYPES: readonly MembershipType[] = [
  "ADHERENTE",
  "FALLECIDO",
  "RENUNCIANTE",
  "SEPARADO",
  "ANULADO",
];

/** Estados terminales que nunca vuelven a ser vigentes. */
export const TERMINAL_MEMBERSHIP_TYPES: readonly MembershipType[] = [
  "FALLECIDO",
  "RENUNCIANTE",
  "SEPARADO",
  "ANULADO",
];

/** Tipos cuya vigencia no depende de cuotas facturadas. */
export const LIFETIME_MEMBERSHIP_TYPES: readonly MembershipType[] = [
  "VITALICIO",
  "HONORARIO",
];

/** Mapeo del valor `tipo` que entrega SIE en `GET /asociados/estado`. */
const SIE_TIPO_TO_TYPE: Record<string, MembershipType> = {
  Activo: "ACTIVE",
  Estudiante: "STUDENT",
  Vitalicio: "VITALICIO",
  Honorario: "HONORARIO",
  Adherente: "ADHERENTE",
  Fallecido: "FALLECIDO",
  Renunciante: "RENUNCIANTE",
  Separado: "SEPARADO",
  Anulado: "ANULADO",
};

export function mapSieTipo(tipo: string): MembershipType | null {
  return SIE_TIPO_TO_TYPE[tipo] ?? null;
}
