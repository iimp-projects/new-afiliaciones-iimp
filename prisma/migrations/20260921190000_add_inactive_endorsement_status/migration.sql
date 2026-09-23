-- Add INACTIVE to the EndorsementStatus enum.
-- schema.prisma declares PENDING | APPROVED | REJECTED | INACTIVE, but the enum
-- created in 20260719024048_init only defined PENDING | APPROVED | REJECTED.
-- validate-sponsor filters `status != 'INACTIVE'`, so the missing value caused
-- Postgres error 22P02 (invalid input value for enum "EndorsementStatus": "INACTIVE").
ALTER TYPE "EndorsementStatus" ADD VALUE IF NOT EXISTS 'INACTIVE';
