import "dotenv/config";
import { writeFileSync } from "fs";
import { PrismaClient } from "@prisma/client";
import { accountActivationService } from "../modules/auth/account-activation/service";

const prisma = new PrismaClient();

async function main() {
  const cases = [
    { roleSlug: "ASOCIADO_ACTIVO", email: "e2e.activo@test.local", doc: "99999991", label: "ACTIVO" },
    { roleSlug: "ASOCIADO_ESTUDIANTE", email: "e2e.estudiante@test.local", doc: "99999992", label: "ESTUDIANTE" },
  ];
  const out: Array<{ label: string; email: string; password: string; token: string }> = [];

  for (const c of cases) {
    const role = await prisma.role.findUnique({ where: { slug: c.roleSlug } });
    if (!role) throw new Error(`role ${c.roleSlug} missing`);
    const person = await prisma.person.create({
      data: { documentType: "DNI", documentNumber: c.doc, firstName: "E2E", paternalLastName: c.label === "ACTIVO" ? "Activo" : "Estudiante" },
    });
    const user = await prisma.user.create({
      data: { email: c.email, personId: person.id, roleId: role.id, type: "AFFILIATE", status: "PENDING" },
    });
    const activation = await accountActivationService.createActivationUrl(user.id);
    if (!activation) throw new Error(`activation url null for ${c.email}`);
    const token = new URL(activation.url).searchParams.get("token");
    if (!token) throw new Error("token missing");
    out.push({ label: c.label, email: c.email, password: "E2e-Secure-Pass-2026!", token });
  }

  writeFileSync("C:\\Users\\maxic\\AppData\\Local\\Temp\\opencode\\e2e-accounts.json", JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out.map((o) => ({ label: o.label, email: o.email, tokenPresent: !!o.token })), null, 2));
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
