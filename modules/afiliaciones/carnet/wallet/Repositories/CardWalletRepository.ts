import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { WalletProvider, WalletSyncStatus } from "../Types/wallet";

export interface WalletPassRow {
  readonly id: string;
  readonly cardId: string;
  readonly provider: WalletProvider;
  readonly externalPassId: string;
  readonly syncStatus: WalletSyncStatus;
  readonly version: number;
  readonly lastErrorCode: string | null;
  readonly lastSyncedAt: Date | null;
  readonly revokedAt: Date | null;
  readonly updatedAt: Date;
}

export interface WalletPassWithCount extends WalletPassRow {
  readonly deviceCount: number;
}

export interface AppleRegistrationRow {
  readonly id: string;
  readonly passId: string;
  readonly deviceLibraryIdentifier: string;
  readonly pushToken: string;
  readonly updatedAt: Date;
}

export interface CardWalletRepository {
  findPass(cardId: string, provider: WalletProvider): Promise<WalletPassRow | null>;
  findPassByExternalId(provider: WalletProvider, externalPassId: string): Promise<WalletPassRow | null>;
  getCardPersonId(cardId: string): Promise<number | null>;
  listPasses(cardId: string): Promise<WalletPassWithCount[]>;
  ensurePass(
    cardId: string,
    provider: WalletProvider,
    externalPassId: string,
    options?: { adoptSimulated?: boolean },
  ): Promise<WalletPassRow>;
  markSynced(id: string, at: Date): Promise<void>;
  markFailed(id: string, errorCode: string): Promise<void>;
  markRevoked(id: string, at: Date): Promise<void>;
  addRegistration(passId: string, deviceLibraryIdentifier: string, pushToken: string): Promise<void>;
  removeRegistration(passId: string, deviceLibraryIdentifier: string): Promise<boolean>;
  listRegistrations(passId: string): Promise<AppleRegistrationRow[]>;
  listDeviceRegistrations(deviceLibraryIdentifier: string, provider: WalletProvider): Promise<Array<{ pass: WalletPassRow; registration: AppleRegistrationRow }>>;
  deleteRegistration(id: string): Promise<void>;
}

function toPassRow(row: {
  id: string;
  cardId: string;
  provider: string;
  externalPassId: string;
  syncStatus: string;
  version: number;
  lastErrorCode: string | null;
  lastSyncedAt: Date | null;
  revokedAt: Date | null;
  updatedAt: Date;
}): WalletPassRow {
  return {
    id: row.id,
    cardId: row.cardId,
    provider: row.provider as WalletProvider,
    externalPassId: row.externalPassId,
    syncStatus: row.syncStatus as WalletSyncStatus,
    version: row.version,
    lastErrorCode: row.lastErrorCode,
    lastSyncedAt: row.lastSyncedAt,
    revokedAt: row.revokedAt,
    updatedAt: row.updatedAt,
  };
}

export class PrismaCardWalletRepository implements CardWalletRepository {
  async findPass(cardId: string, provider: WalletProvider): Promise<WalletPassRow | null> {
    const row = await prisma.cardWalletPass.findUnique({ where: { cardId_provider: { cardId, provider } } });
    return row ? toPassRow(row) : null;
  }

  async findPassByExternalId(provider: WalletProvider, externalPassId: string): Promise<WalletPassRow | null> {
    const row = await prisma.cardWalletPass.findUnique({ where: { provider_externalPassId: { provider, externalPassId } } });
    return row ? toPassRow(row) : null;
  }

  async getCardPersonId(cardId: string): Promise<number | null> {
    const card = await prisma.associateCard.findUnique({ where: { id: cardId }, select: { personId: true } });
    return card?.personId ?? null;
  }

  async listPasses(cardId: string): Promise<WalletPassWithCount[]> {
    const rows = await prisma.cardWalletPass.findMany({
      where: { cardId },
      include: { _count: { select: { appleRegistrations: true } } },
      orderBy: { createdAt: "asc" },
    });
    return rows.map((row) => ({ ...toPassRow(row), deviceCount: row._count.appleRegistrations }));
  }

  async ensurePass(
    cardId: string,
    provider: WalletProvider,
    externalPassId: string,
    options: { adoptSimulated?: boolean } = {},
  ): Promise<WalletPassRow> {
    try {
      // Transición controlada SOLO de un pase simulado local hacia su
      // identificador real estable. Un pase real existente no se sobrescribe.
      if (options.adoptSimulated) {
        const existing = await prisma.cardWalletPass.findUnique({ where: { cardId_provider: { cardId, provider } } });
        if (existing && existing.externalPassId !== externalPassId && existing.externalPassId.startsWith("SIMULATED-")) {
          const updated = await prisma.cardWalletPass.update({
            where: { id: existing.id },
            data: { externalPassId, syncStatus: "PENDING", lastErrorCode: null, revokedAt: null },
          });
          return toPassRow(updated);
        }
      }
      const row = await prisma.cardWalletPass.upsert({
        where: { cardId_provider: { cardId, provider } },
        create: { cardId, provider, externalPassId },
        update: {},
      });
      return toPassRow(row);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const row = await prisma.cardWalletPass.findUnique({ where: { cardId_provider: { cardId, provider } } });
        if (row) return toPassRow(row);
      }
      throw error;
    }
  }

  async markSynced(id: string, at: Date): Promise<void> {
    await prisma.cardWalletPass.update({
      where: { id },
      data: { syncStatus: "SYNCED", version: { increment: 1 }, lastSyncedAt: at, lastErrorCode: null, revokedAt: null },
    });
  }

  async markFailed(id: string, errorCode: string): Promise<void> {
    await prisma.cardWalletPass.update({
      where: { id },
      data: { syncStatus: "FAILED", lastErrorCode: errorCode.slice(0, 80) },
    });
  }

  async markRevoked(id: string, at: Date): Promise<void> {
    await prisma.cardWalletPass.update({
      where: { id },
      data: { syncStatus: "REVOKED", revokedAt: at, lastErrorCode: null },
    });
  }

  async addRegistration(passId: string, deviceLibraryIdentifier: string, pushToken: string): Promise<void> {
    await prisma.applePassRegistration.upsert({
      where: { passId_deviceLibraryIdentifier: { passId, deviceLibraryIdentifier } },
      create: { passId, deviceLibraryIdentifier, pushToken },
      update: { pushToken },
    });
  }

  async removeRegistration(passId: string, deviceLibraryIdentifier: string): Promise<boolean> {
    const deleted = await prisma.applePassRegistration.deleteMany({ where: { passId, deviceLibraryIdentifier } });
    return deleted.count > 0;
  }

  async listRegistrations(passId: string): Promise<AppleRegistrationRow[]> {
    const rows = await prisma.applePassRegistration.findMany({ where: { passId }, orderBy: { createdAt: "asc" } });
    return rows.map((row) => ({
      id: row.id,
      passId: row.passId,
      deviceLibraryIdentifier: row.deviceLibraryIdentifier,
      pushToken: row.pushToken,
      updatedAt: row.updatedAt,
    }));
  }

  async listDeviceRegistrations(deviceLibraryIdentifier: string, provider: WalletProvider) {
    const rows = await prisma.applePassRegistration.findMany({
      where: { deviceLibraryIdentifier, pass: { provider } },
      include: { pass: true },
      orderBy: { createdAt: "asc" },
    });
    return rows.map((row) => ({
      pass: toPassRow(row.pass),
      registration: {
        id: row.id,
        passId: row.passId,
        deviceLibraryIdentifier: row.deviceLibraryIdentifier,
        pushToken: row.pushToken,
        updatedAt: row.updatedAt,
      },
    }));
  }

  async deleteRegistration(id: string): Promise<void> {
    await prisma.applePassRegistration.delete({ where: { id } });
  }
}
