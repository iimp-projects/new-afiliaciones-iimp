-- Align the QA database with the existing Prisma MembershipApproval model.
ALTER TABLE "membership_approvals"
ADD COLUMN "rejection_reason" TEXT;
