
import type { Prisma } from "@prisma/client";

export interface Application {
  id: number;

  applicationCode: string;

  trackingCode: string;

  personId: number | null;

  documentType: string;

  documentNumber: string;

  email: string;

  phone: string;

  affiliateType: string;

  status: string;

  currentStep: number;

  draftData: Prisma.JsonValue | null;

  correspondencePreference: string | null;

  submittedAt: Date | null;

  verifiedAt: Date | null;

  lastAccessAt: Date | null;

  expiresAt: Date | null;

  createdAt: Date;

  updatedAt: Date;

  deletedAt: Date | null;
}