import { PaymentStatus, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
async function main() {
  const applications = await prisma.membershipApplication.findMany({ where: { status: "COMPLETED", deletedAt: null }, select: { id: true, personId: true, affiliateType: true, email: true, payments: { select: { status: true } }, person: { select: { documentNumber: true, user: { select: { id: true, type: true, status: true, role: { select: { slug: true } } } } } } } });
  const summary = applications.reduce((result, application) => { const hasUser = Boolean(application.person?.user); const eligible = Boolean(application.person?.documentNumber && application.email && (application.affiliateType === "STUDENT" || application.payments.some((payment) => payment.status === PaymentStatus.PAID))); result.total++; if (hasUser) result.withUser++; else result.withoutUser++; if (!application.email) result.withoutEmail++; if (!application.person?.documentNumber) result.withoutDocument++; if (eligible) result.eligible++; return result; }, { total: 0, withUser: 0, withoutUser: 0, withoutEmail: 0, withoutDocument: 0, eligible: 0 });
  console.log(JSON.stringify(summary, null, 2));
}
main().finally(() => prisma.$disconnect());
