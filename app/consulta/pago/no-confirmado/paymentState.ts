export function isMatchingFailedPayment(
  payment: { applicationId: number; status: string } | null,
  reference: { applicationId: number } | null,
): boolean {
  return payment !== null && reference !== null && payment.applicationId === reference.applicationId && payment.status === "FAILED";
}
