import crypto from "crypto";
import { ResetPasswordRepository } from "./repository";

export const ResetPasswordService = {
  async executeReset(email: string, rawToken: string, newPasswordPlain: string, ipAddress: string): Promise<void> {
    
    // Rate Limiting para evitar ataques de fuerza bruta al token
    const isAllowed = await ResetPasswordRepository.checkRateLimit(`RESET_PW_${ipAddress}`, 5, 15);
    if (!isAllowed) {
      throw new Error("RATE_LIMIT_EXCEEDED");
    }

    // 1. Hashear el token recibido en la URL
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");

    // 2. Verificar existencia y expiración
    const validToken = await ResetPasswordRepository.findValidToken(email, tokenHash);
    
    if (!validToken) {
      throw new Error("INVALID_TOKEN");
    }

    // 3. Ejecutar actualización segura
    await ResetPasswordRepository.updatePassword(email, newPasswordPlain);

    // 4. Invalidar token utilizado
    await ResetPasswordRepository.deleteTokenById(validToken.id);
  },
};