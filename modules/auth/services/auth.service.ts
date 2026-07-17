// modules/auth/services/auth.service.ts
import { PrismaClient } from "@/app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL as string });
const prisma = new PrismaClient({ adapter });

export const AuthService = { // <-- AQUÍ ESTÁ EL "NAMED EXPORT"
  async validateUserCredentials(email: string, passwordPlain: string) {
    console.log("🔍 [AuthService] Intentando validar usuario:", email);
    
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        role: { include: { rolePermissions: { include: { permission: true } } } },
        person: true
      }
    });

    if (!user || !user.isActive) {
      console.log("❌ [AuthService] Usuario no encontrado o inactivo");
      return null;
    }

    const isPasswordValid = await bcrypt.compare(passwordPlain, user.password);
    if (!isPasswordValid) {
      console.log("❌ [AuthService] Contraseña incorrecta");
      return null;
    }

    const permissions = user.role?.rolePermissions.map(
      rp => `${rp.permission.action}:${rp.permission.subject}`
    ) || [];

    console.log("✅ [AuthService] Login exitoso para:", email);
    return {
      id: user.id.toString(),
      email: user.email,
      name: user.person ? `${user.person.firstName} ${user.person.paternalLastName}` : user.email,
      role: user.role?.slug || "POSTULANTE",
      permissions: permissions,
    };
  }
};