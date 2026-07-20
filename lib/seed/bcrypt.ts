import bcrypt from "bcryptjs";

const SALT_ROUNDS = 12;

/**
 * Helper criptográfico para Seeds.
 * Encapsula la lógica de hashing para desacoplar las implementaciones futuras.
 */
export const hashSeedPassword = async (plainTextPassword: string): Promise<string> => {
  return bcrypt.hash(plainTextPassword, SALT_ROUNDS);
};