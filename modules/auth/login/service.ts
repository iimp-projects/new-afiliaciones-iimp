import bcrypt from "bcryptjs";
import { LoginRepository } from "./repository";
import type { LoginResult } from "./types";

export const LoginService = {
  async validateCredentials(email: string, passwordPlain: string): Promise<LoginResult | null> {
    console.log("🔍 [LoginService] Intentando validar usuario:", email);
    
    // 1. Delegamos el acceso a datos exclusivamente al Repositorio
    const user = await LoginRepository.findUserByEmail(email);

    // 2. Regla de Negocio: El usuario debe existir y estar activo
    if (!user || !user.isActive) {
      console.log("❌ [LoginService] Usuario no encontrado o inactivo");
      return null;
    }

    // 3. Regla de Negocio: La contraseña debe ser válida
    const isPasswordValid = await bcrypt.compare(passwordPlain, user.password);
    if (!isPasswordValid) {
      console.log("❌ [LoginService] Contraseña incorrecta");
      return null;
    }

    // 4. Formateo de Reglas de Autorización empaquetadas en la sesión
    const permissions = user.role?.rolePermissions.map(
      rp => `${rp.permission.action}:${rp.permission.subject}`
    ) || [];

    console.log("✅ [LoginService] Login exitoso para:", email);
    
    return {
      id: user.id.toString(),
      email: user.email,
      name: user.person ? `${user.person.firstName} ${user.person.paternalLastName}` : user.email,
      role: user.role?.slug || "POSTULANTE",
      permissions: permissions,
    };
  }
};