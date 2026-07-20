import { SecurityEventType } from '@prisma/client';

export { SecurityEventType };

export interface SecurityRequestMeta {
  ipAddress?: string | null;
  userAgent?: string | null;
  os?: string | null;
  browser?: string | null;
}

export interface CreateSecurityEventInput extends SecurityRequestMeta {
  userId?: number | null;
  type: SecurityEventType;
  metadata?: Record<string, any> | null;
}