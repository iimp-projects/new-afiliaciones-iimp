import "dotenv/config";
import { ApplicationStatus, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Classification = "READY" | "INVALID_EMAIL" | "NO_EMAIL" | "EMAIL_COLLISION" | "NO_DOCUMENT";

interface Row {
  applicationId: number;
  personId: number;
  documentNumber: string | null;
  affiliateType: string;
  email: string | null;
  classification: Classification;
}

function resolveEmail(row: { contacts: { email: string | null }[]; email: string | null }): string | null {
  const contact = row.contacts.find((c) => c.email)?.email;
  return (contact ?? row.email ?? null)?.trim().toLowerCase() ?? null;
}

async function main() {
  const apps = await prisma.membershipApplication.findMany({
    where: { status: ApplicationStatus.COMPLETED, deletedAt: null, person: { isNot: null } },
    select: {
      id: true,
      email: true,
      affiliateType: true,
      person: {
        select: {
          id: true,
          documentNumber: true,
          contacts: { orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }], select: { email: true } },
          user: { select: { id: true, deletedAt: true } },
        },
      },
    },
  });

  const withoutAccount = apps.filter((a) => !a.person || !a.person.user || a.person.user.deletedAt);

  // Mapa de email -> personId para detectar colisiones (case-insensitive)
  const users = await prisma.user.findMany({ where: { deletedAt: null }, select: { email: true, personId: true } });
  const emailToPerson = new Map<string, number>();
  for (const u of users) emailToPerson.set(u.email.trim().toLowerCase(), u.personId ?? -1);

  const rows: Row[] = withoutAccount.map((a) => {
    const person = a.person!;
    const email = resolveEmail({ contacts: person.contacts, email: a.email });
    const classification = classify({ documentNumber: person.documentNumber, email, emailToPerson, personId: person.id });
    return { applicationId: a.id, personId: person.id, documentNumber: person.documentNumber, affiliateType: a.affiliateType, email, classification };
  });

  const counts = rows.reduce<Record<Classification, number>>(
    (acc, r) => { acc[r.classification] += 1; return acc; },
    { READY: 0, INVALID_EMAIL: 0, NO_EMAIL: 0, EMAIL_COLLISION: 0, NO_DOCUMENT: 0 },
  );

  const ready = rows.filter((r) => r.classification === "READY");
  const readyByType = { ACTIVE: ready.filter((r) => r.affiliateType === "ACTIVE").length, STUDENT: ready.filter((r) => r.affiliateType === "STUDENT").length };
  const manualReview = rows.filter((r) => r.classification !== "READY");

  const out = {
    completedWithoutAccount: withoutAccount.length,
    classifications: counts,
    readyByType,
    readyTotal: ready.length,
    manualReviewTotal: manualReview.length,
    manualReviewBreakdown: {
      EMAIL_COLLISION: counts.EMAIL_COLLISION,
      INVALID_EMAIL: counts.INVALID_EMAIL,
      NO_EMAIL: counts.NO_EMAIL,
      NO_DOCUMENT: counts.NO_DOCUMENT,
    },
    collisionSamples: rows.filter((r) => r.classification === "EMAIL_COLLISION").slice(0, 20).map((r) => ({ applicationId: r.applicationId, email: r.email, documentNumber: r.documentNumber })),
    invalidEmailSamples: rows.filter((r) => r.classification === "INVALID_EMAIL").slice(0, 20).map((r) => ({ applicationId: r.applicationId, email: r.email })),
  };

  console.log(JSON.stringify(out, (_, v) => (typeof v === "bigint" ? Number(v) : v), 2));
}

function classify(input: { documentNumber: string | null; email: string | null; personId: number; emailToPerson: Map<string, number> }): Classification {
  if (!input.documentNumber || !input.documentNumber.trim()) return "NO_DOCUMENT";
  if (!input.email) return "NO_EMAIL";
  if (!EMAIL_REGEX.test(input.email)) return "INVALID_EMAIL";
  const owner = input.emailToPerson.get(input.email);
  if (owner !== undefined && owner !== input.personId) return "EMAIL_COLLISION";
  return "READY";
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
