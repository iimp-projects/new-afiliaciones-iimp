import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { accountActivationService } from "../modules/auth/account-activation/service";
import { loginService } from "../modules/auth/login/service";

const prisma = new PrismaClient();

type Result = { step: string; status: "PASS" | "FAIL" | "NOT_VERIFIED"; detail?: string };
const results: Result[] = [];
function record(step: string, status: Result["status"], detail?: string) {
  results.push({ step, status, detail });
}

const PASSWORD = "E2e-Secure-Pass-2026!";
const createdIds: { userId: number; personId: number }[] = [];

async function createSynthetic(roleSlug: "ASOCIADO_ACTIVO" | "ASOCIADO_ESTUDIANTE", email: string, doc: string) {
  const role = await prisma.role.findUnique({ where: { slug: roleSlug } });
  if (!role) throw new Error(`role ${roleSlug} missing`);
  const person = await prisma.person.create({
    data: { documentType: "DNI", documentNumber: doc, firstName: "E2E", paternalLastName: roleSlug === "ASOCIADO_ACTIVO" ? "Activo" : "Estudiante" },
  });
  const user = await prisma.user.create({
    data: { email, personId: person.id, roleId: role.id, type: "AFFILIATE", status: "PENDING" },
  });
  createdIds.push({ userId: user.id, personId: person.id });
  return { user, person };
}

async function runE2E(roleSlug: "ASOCIADO_ACTIVO" | "ASOCIADO_ESTUDIANTE", email: string, doc: string, label: string) {
  const { user } = await createSynthetic(roleSlug, email, doc);

  // 1. sin credencial
  const credBefore = await prisma.credential.findMany({ where: { userId: user.id } });
  record(`${label}: sin credencial inicial`, credBefore.length === 0 ? "PASS" : "FAIL");

  // 2. login PENDING rechazado
  try {
    await loginService.authenticate({ email, password: PASSWORD }, { ipAddress: "127.0.0.1" });
    record(`${label}: login PENDING rechazado`, "FAIL", "no rechazó");
  } catch {
    record(`${label}: login PENDING rechazado`, "PASS");
  }

  // 3. token de activación (sin correo)
  const activation = await accountActivationService.createActivationUrl(user.id);
  if (!activation) { record(`${label}: token de activación`, "FAIL", "createActivationUrl devolvió null"); return; }
  const token = new URL(activation.url).searchParams.get("token");
  record(`${label}: token de activación (sin correo)`, token ? "PASS" : "FAIL");

  // 4. consumir activación (contraseña)
  await accountActivationService.consumeActivation(token!, PASSWORD);
  const after = await prisma.user.findUnique({ where: { id: user.id }, include: { credentials: true } });
  record(`${label}: PENDING -> ACTIVE`, after?.status === "ACTIVE" ? "PASS" : "FAIL");
  record(`${label}: email_verified`, after?.emailVerified != null ? "PASS" : "FAIL");
  record(`${label}: credencial bcrypt creada`, after?.credentials?.length === 1 ? "PASS" : "FAIL");

  // 5. token reutilizado rechazado
  try {
    await accountActivationService.consumeActivation(token!, PASSWORD);
    record(`${label}: token reutilizado rechazado`, "FAIL", "no rechazó");
  } catch {
    record(`${label}: token reutilizado rechazado`, "PASS");
  }

  // 6. login posterior a activación
  try {
    const login = await loginService.authenticate({ email, password: PASSWORD }, { ipAddress: "127.0.0.1" });
    record(`${label}: login posterior a activación`, login ? "PASS" : "FAIL");
  } catch {
    record(`${label}: login posterior a activación`, "FAIL", "login rechazado");
  }

  // 7. rol correcto
  const u = await prisma.user.findUnique({ where: { id: user.id }, include: { role: true } });
  record(`${label}: rol correcto (${roleSlug})`, u?.role?.slug === roleSlug ? "PASS" : "FAIL");
}

async function cleanup() {
  for (const { userId, personId } of createdIds) {
    await prisma.credential.deleteMany({ where: { userId } }).catch(() => undefined);
    await prisma.user.deleteMany({ where: { id: userId } }).catch(() => undefined);
    await prisma.person.deleteMany({ where: { id: personId } }).catch(() => undefined);
  }
}

async function main() {
  try {
    await runE2E("ASOCIADO_ACTIVO", "e2e.activo@test.local", "99999991", "ACTIVO");
    await runE2E("ASOCIADO_ESTUDIANTE", "e2e.estudiante@test.local", "99999992", "ESTUDIANTE");
  } finally {
    await cleanup();
  }
  console.log(JSON.stringify(results, null, 2));
  const fails = results.filter((r) => r.status === "FAIL").length;
  console.log(`E2E_SUMMARY: ${results.length} checks, ${fails} FAIL, ${results.filter((r) => r.status === "NOT_VERIFIED").length} NOT_VERIFIED`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
