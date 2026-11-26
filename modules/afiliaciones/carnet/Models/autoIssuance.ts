export type AutoIssuanceInput = {
  eligible: boolean;
  generated: boolean;
  revoked: boolean;
  issuanceEnabled: boolean;
  canIssue: boolean;
};

/**
 * Decide si corresponde preparar automáticamente una credencial al abrir el
 * carné. Nunca reemite una credencial revocada, nunca escribe con emisión
 * deshabilitada y respeta el permiso de emisión del actor.
 */
export function shouldAutoIssueCard(input: AutoIssuanceInput): boolean {
  return Boolean(
    input.eligible &&
    !input.generated &&
    !input.revoked &&
    input.issuanceEnabled &&
    input.canIssue,
  );
}
