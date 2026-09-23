-- Add WHATSAPP to the VerificationChannel enum.
-- schema.prisma declares EMAIL | SMS | WHATSAPP, but the enum created in
-- 20260722192610_remove_flow_from_membership_application only defined EMAIL | SMS.
-- This migration closes that schema drift for every environment built from migrations.
ALTER TYPE "VerificationChannel" ADD VALUE IF NOT EXISTS 'WHATSAPP';
