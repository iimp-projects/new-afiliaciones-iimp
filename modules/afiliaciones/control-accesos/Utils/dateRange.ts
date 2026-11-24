const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

export function parseRangeDate(value: string | undefined, endOfDay = false): Date | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  if (endOfDay && DATE_ONLY.test(value)) date.setHours(23, 59, 59, 999);
  return date;
}
