-- Align the remaining MembershipApproval JSON fields with the Prisma model.
ALTER TABLE "membership_approvals"
ADD COLUMN "resend_history" JSONB,
ADD COLUMN "chat_messages" JSONB;
