/** Stable identifier for one logical operational condition. */
export function buildOperationalAlertKey(type: string, applicationId: number, relatedId?: number): string {
  return relatedId === undefined ? `${type}:${applicationId}` : `${type}:${applicationId}:${relatedId}`;
}
