// modules/shared/database/prisma.client.ts
import { PrismaClient } from "@/app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// Se utiliza globalThis para prevenir múltiples instancias de PrismaClient en desarrollo 
// debido al HMR (Hot Module Replacement) de Next.js.
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

const createPrismaClient = () => {
  // Solo crear la instancia si no existe globalmente
  if (globalForPrisma.prisma) {
    return globalForPrisma.prisma;
  }

  // Se mantiene exactamente tu configuración original del adapter
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL as string });
  const client = new PrismaClient({ adapter });

  // Si no estamos en producción, guardamos la instancia en el objeto global
  if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prisma = client;
  }

  return client;
};

export const prisma = createPrismaClient();