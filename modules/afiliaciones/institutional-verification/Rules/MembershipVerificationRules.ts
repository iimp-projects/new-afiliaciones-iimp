import type { SieAssociateState, SieAssociateStateQuota } from "@/modules/afiliaciones/associates-integration/Models/AssociateIntegration";
import { ELIGIBLE_MEMBERSHIP_TYPES, LIFETIME_MEMBERSHIP_TYPES, mapSieTipo, TERMINAL_MEMBERSHIP_TYPES, type MembershipType } from "../Types/MembershipType";

export type Vigencia = "VIGENTE" | "NO_VIGENTE" | "INDETERMINATE";

export type VerificationStatus = "ELIGIBLE" | "INELIGIBLE" | "NOT_ASSOCIATE" | "INDETERMINATE";

export type VerificationResult = {
  /** Resultado de alto nivel consumible por el integrador. */
  status: VerificationStatus;
  /** `true` si SIE confirma que el documento pertenece a un asociado. `null` si SIE no da información suficiente. */
  associate: boolean | null;
  /** Tipo de membresía actual según SIE. `null` cuando no puede determinarse. */
  membershipType: MembershipType | null;
  /** Elegibilidad para el beneficio institucional. `null` cuando es indeterminable. */
  eligible: boolean | null;
  /** Vigencia institucional. `null` para estados terminales o no aplicable. */
  vigencia: Vigencia | null;
  /** Motivo legible, solo presente cuando hay indeterminación. Nunca incluye datos sensibles. */
  reason?: string;
};

/**
 * Reglas puras y deterministas de verificación institucional de asociados.
 *
 * No accede a PostgreSQL ni a SIE: recibe el estado devuelto por SIE y lo
 * clasifica. La fuente de verdad de la vigencia es exclusivamente SIE en vivo;
 * una persona ausente del padrón local (`Person`/`User`) sigue siendo verificable.
 *
 * Interpretación de la regla institucional de vigencia (pendiente de
 * confirmación contra respuestas reales de SIE — ver docs/SIE_MEMBERSHIP_RULES):
 *  - ACTIVE y STUDENT exigen una cuota `CUOTA` facturada con periodo válido que
 *    cubra la fecha actual (fechaInicio <= hoy <= fechaFin).
 *  - VITALICIO, HONORARIO y ADHERENTE no exigen cuotas facturadas: su vigencia
 *    depende solo de que SIE los informe en ese estado vigente.
 *  - FALLECIDO, RENUNCIANTE, SEPARADO y ANULADO son estados terminales no elegibles.
 */
export function classifyVerification(state: SieAssociateState, now: Date = new Date()): VerificationResult {
  if (!state.status) {
    return { status: "NOT_ASSOCIATE", associate: false, membershipType: null, eligible: null, vigencia: null };
  }

  const membershipType = determineMembershipType(state.cuotas);
  if (membershipType === null) {
    return {
      status: "INDETERMINATE",
      associate: true,
      membershipType: null,
      eligible: null,
      vigencia: null,
      reason: "SIE no informa un tipo de membresía que permita determinar elegibilidad.",
    };
  }

  if (TERMINAL_MEMBERSHIP_TYPES.includes(membershipType)) {
    return { status: "INELIGIBLE", associate: true, membershipType, eligible: false, vigencia: null };
  }

  if (ELIGIBLE_MEMBERSHIP_TYPES.includes(membershipType)) {
    if (LIFETIME_MEMBERSHIP_TYPES.includes(membershipType)) {
      return { status: "ELIGIBLE", associate: true, membershipType, eligible: true, vigencia: "VIGENTE" };
    }

    const vigencia = determineActiveStudentVigencia(state.cuotas, peruToday(now));
    if (vigencia === "VIGENTE") {
      return { status: "ELIGIBLE", associate: true, membershipType, eligible: true, vigencia };
    }
    if (vigencia === "NO_VIGENTE") {
      return { status: "INELIGIBLE", associate: true, membershipType, eligible: false, vigencia };
    }
    return {
      status: "INDETERMINATE",
      associate: true,
      membershipType,
      eligible: null,
      vigencia,
      reason: "SIE no entrega cuotas suficientes para confirmar la vigencia institucional.",
    };
  }

  // ADHERENTE: vigente según SIE, pero no elegible para el beneficio.
  return { status: "INELIGIBLE", associate: true, membershipType, eligible: false, vigencia: "VIGENTE" };
}

export function determineMembershipType(cuotas: SieAssociateStateQuota[]): MembershipType | null {
  const typed = cuotas
    .map((quota) => mapSieTipo(quota.tipo))
    .filter((type): type is MembershipType => type !== null);

  if (typed.length === 0) return null;

  const latest = [...cuotas].sort(byRecencyDesc)[0];
  const latestType = mapSieTipo(latest.tipo);
  if (latestType === null) return null;

  const key = recencyKey(latest);
  for (const quota of [...cuotas].sort(byRecencyDesc)) {
    if (recencyKey(quota) !== key) break;
    if (mapSieTipo(quota.tipo) !== latestType) return null;
  }

  return latestType;
}

export function determineActiveStudentVigencia(cuotas: SieAssociateStateQuota[], today: string): Vigencia {
  const membershipCuotas = cuotas.filter((quota) => quota.concepto === "CUOTA");

  if (membershipCuotas.length === 0) return "INDETERMINATE";

  const covering = membershipCuotas.some((quota) => isFacturadoCovering(quota, today));
  if (covering) return "VIGENTE";

  const ambiguousFacturado = membershipCuotas.some(
    (quota) => quota.estadoContable === "Facturado" && (!quota.fechaInicio || !quota.fechaFin || quota.fechaInicio > quota.fechaFin),
  );
  if (ambiguousFacturado) return "INDETERMINATE";

  return "NO_VIGENTE";
}

function isFacturadoCovering(quota: SieAssociateStateQuota, today: string): boolean {
  if (quota.estadoContable !== "Facturado") return false;
  if (!quota.fechaInicio || !quota.fechaFin) return false;
  if (quota.fechaInicio > quota.fechaFin) return false;
  return quota.fechaInicio <= today && today <= quota.fechaFin;
}

/** Fecha local de hoy en Perú (America/Lima) como `YYYY-MM-DD`. */
export function peruToday(now: Date): string {
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) throw new Error("La fecha de verificación no es válida.");
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Lima",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  if (!year || !month || !day) throw new Error("No se pudo resolver la fecha de verificación.");
  return `${year}-${month}-${day}`;
}

function byRecencyDesc(left: SieAssociateStateQuota, right: SieAssociateStateQuota): number {
  if (left.anno !== right.anno) return right.anno - left.anno;
  if (left.fechaFin !== right.fechaFin) return right.fechaFin.localeCompare(left.fechaFin);
  return right.fechaInicio.localeCompare(left.fechaInicio);
}

function recencyKey(quota: SieAssociateStateQuota): string {
  return `${quota.anno}|${quota.fechaFin}|${quota.fechaInicio}`;
}
