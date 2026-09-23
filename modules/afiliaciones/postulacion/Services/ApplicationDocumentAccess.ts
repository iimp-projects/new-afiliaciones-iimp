export const APPLICATION_KEY_PREFIX = "afiliaciones/applications";

export interface ApplicationDocumentScope {
  readonly allowedPrefixes: readonly string[];
}

/**
 * Resuelve el alcance de lectura de documentos S3.
 *
 * - Una identidad interna autorizada puede leer documentos de expedientes
 *   (`afiliaciones/applications/...`), nunca el resto del bucket.
 * - Un postulante solo puede leer los documentos de sus propias solicitudes
 *   (`afiliaciones/applications/<applicationId>`).
 * - Un afiliado externo no obtiene alcance interno: cae en la rama de
 *   postulante y solo accede a las solicitudes de su cookie.
 */
export function resolveApplicationDocumentScope(params: {
  isInternal: boolean;
  applicantApplicationIds: readonly number[];
}): ApplicationDocumentScope | null {
  if (params.isInternal) {
    return { allowedPrefixes: [APPLICATION_KEY_PREFIX] };
  }

  const applicationIds = params.applicantApplicationIds.filter(
    (applicationId) => Number.isSafeInteger(applicationId) && applicationId > 0,
  );
  if (applicationIds.length === 0) return null;

  return {
    allowedPrefixes: applicationIds.map(
      (applicationId) => `${APPLICATION_KEY_PREFIX}/${applicationId}`,
    ),
  };
}
