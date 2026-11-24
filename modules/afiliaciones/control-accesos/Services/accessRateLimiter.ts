import { InMemoryRateLimiter } from "@/modules/afiliaciones/document-validation/Services/InMemoryRateLimiter";

export const accessScanRateLimiter = new InMemoryRateLimiter();

export function accessRequestKey(request: Request, userId: number): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "local";
  return `${userId}:${ip}`;
}
