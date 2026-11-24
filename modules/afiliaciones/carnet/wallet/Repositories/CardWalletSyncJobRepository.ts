import { randomUUID } from "node:crypto";
import { Prisma, type PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { WalletProvider } from "../Types/wallet";

export type SyncDatabase = Prisma.TransactionClient | PrismaClient;

export type SyncOperation = "SYNC" | "REVOKE";
export type SyncJobStatus = "PENDING" | "PROCESSING" | "COMPLETED" | "RETRY" | "FAILED" | "SUPERSEDED";

export interface SyncJobRow {
  readonly id: string;
  readonly cardId: string;
  readonly walletPassId: string;
  readonly provider: WalletProvider;
  readonly operation: SyncOperation;
  readonly status: SyncJobStatus;
  readonly targetVersion: number;
  readonly attemptCount: number;
  readonly maxAttempts: number;
  readonly nextAttemptAt: Date;
  readonly lastErrorCode: string | null;
  readonly updatedAt: Date;
}

export interface SyncMetrics {
  readonly pending: number;
  readonly processing: number;
  readonly retry: number;
  readonly failed: number;
  readonly completed: number;
  readonly oldestPendingSeconds: number | null;
}

export interface CardWalletSyncJobRepository {
  enqueueForCard(db: SyncDatabase, cardId: string, operation: SyncOperation, maxAttempts: number): Promise<number>;
  claimBatch(workerId: string, limit: number, leaseSeconds: number): Promise<SyncJobRow[]>;
  recoverExpired(leaseSeconds: number): Promise<number>;
  reconcileStale(limit: number, maxAttempts: number, ageHours: number): Promise<number>;
  complete(id: string, workerId: string, claimedUpdatedAt: Date, expectedOperation: SyncOperation): Promise<boolean>;
  renewLeases(ids: readonly string[], workerId: string, leaseSeconds: number): Promise<number>;
  retry(id: string, workerId: string, nextAttemptAt: Date, code: string, message: string): Promise<boolean>;
  fail(id: string, workerId: string, code: string, message: string): Promise<boolean>;
  requeueForCard(cardId: string): Promise<number>;
  listByCard(cardId: string): Promise<SyncJobRow[]>;
  metrics(): Promise<SyncMetrics>;
}

const ENQUEUE_CONFLICT = Prisma.sql`
  ON CONFLICT ("wallet_pass_id") DO UPDATE SET
    "provider" = EXCLUDED."provider",
    "operation" = EXCLUDED."operation",
    "status" = CASE
      WHEN "card_wallet_sync_jobs"."status" = 'PROCESSING'::"CardWalletSyncJobStatus" THEN "card_wallet_sync_jobs"."status"
      ELSE 'PENDING'::"CardWalletSyncJobStatus"
    END,
    "target_version" = GREATEST("card_wallet_sync_jobs"."target_version", EXCLUDED."target_version"),
    "max_attempts" = EXCLUDED."max_attempts",
    "next_attempt_at" = now(),
    "attempt_count" = CASE
      WHEN "card_wallet_sync_jobs"."status" = 'PROCESSING'::"CardWalletSyncJobStatus" THEN "card_wallet_sync_jobs"."attempt_count"
      ELSE 0
    END,
    "locked_at" = CASE
      WHEN "card_wallet_sync_jobs"."status" = 'PROCESSING'::"CardWalletSyncJobStatus" THEN "card_wallet_sync_jobs"."locked_at"
      ELSE NULL
    END,
    "locked_by" = CASE
      WHEN "card_wallet_sync_jobs"."status" = 'PROCESSING'::"CardWalletSyncJobStatus" THEN "card_wallet_sync_jobs"."locked_by"
      ELSE NULL
    END,
    "lease_expires_at" = CASE
      WHEN "card_wallet_sync_jobs"."status" = 'PROCESSING'::"CardWalletSyncJobStatus" THEN "card_wallet_sync_jobs"."lease_expires_at"
      ELSE NULL
    END,
    "last_error_code" = CASE
      WHEN "card_wallet_sync_jobs"."status" = 'PROCESSING'::"CardWalletSyncJobStatus" THEN "card_wallet_sync_jobs"."last_error_code"
      ELSE NULL
    END,
    "last_error_message" = CASE
      WHEN "card_wallet_sync_jobs"."status" = 'PROCESSING'::"CardWalletSyncJobStatus" THEN "card_wallet_sync_jobs"."last_error_message"
      ELSE NULL
    END,
    "completed_at" = CASE
      WHEN "card_wallet_sync_jobs"."status" = 'PROCESSING'::"CardWalletSyncJobStatus" THEN "card_wallet_sync_jobs"."completed_at"
      ELSE NULL
    END,
    "updated_at" = now()
`;

export class PrismaCardWalletSyncJobRepository implements CardWalletSyncJobRepository {
  async enqueueForCard(db: SyncDatabase, cardId: string, operation: SyncOperation, maxAttempts: number): Promise<number> {
    const passes = await db.$queryRaw<Array<{ id: string; provider: WalletProvider; version: number }>>(Prisma.sql`
      SELECT "id", "provider"::text AS "provider", "version"
      FROM "card_wallet_passes"
      WHERE "card_id" = ${cardId}
    `);
    for (const pass of passes) {
      await db.$executeRaw(Prisma.sql`
        INSERT INTO "card_wallet_sync_jobs"
          ("id", "card_id", "wallet_pass_id", "provider", "operation", "status", "target_version", "max_attempts", "next_attempt_at", "created_at", "updated_at")
        VALUES (
          ${randomUUID()}, ${cardId}, ${pass.id}, ${pass.provider}::"CardWalletProvider",
          ${operation}::"CardWalletSyncOperation", 'PENDING'::"CardWalletSyncJobStatus",
          ${pass.version + 1}, ${maxAttempts}, now(), now(), now()
        )
        ${ENQUEUE_CONFLICT}
      `);
    }
    return passes.length;
  }

  async claimBatch(workerId: string, limit: number, leaseSeconds: number): Promise<SyncJobRow[]> {
    const rows = await prisma.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`
      WITH "candidate" AS (
        SELECT "id"
        FROM "card_wallet_sync_jobs"
        WHERE "status" IN ('PENDING'::"CardWalletSyncJobStatus", 'RETRY'::"CardWalletSyncJobStatus")
          AND "next_attempt_at" <= now()
        ORDER BY "next_attempt_at" ASC, "created_at" ASC
        FOR UPDATE SKIP LOCKED
        LIMIT ${limit}
      )
      UPDATE "card_wallet_sync_jobs" AS "job"
      SET "status" = 'PROCESSING'::"CardWalletSyncJobStatus",
          "locked_at" = now(),
          "locked_by" = ${workerId},
          "lease_expires_at" = now() + (${leaseSeconds} * interval '1 second'),
          "updated_at" = now()
      FROM "candidate"
      WHERE "job"."id" = "candidate"."id"
      RETURNING
        "job"."id", "job"."card_id" AS "cardId", "job"."wallet_pass_id" AS "walletPassId",
        "job"."provider"::text AS "provider", "job"."operation"::text AS "operation",
        "job"."status"::text AS "status", "job"."target_version" AS "targetVersion",
        "job"."attempt_count" AS "attemptCount", "job"."max_attempts" AS "maxAttempts",
        "job"."next_attempt_at" AS "nextAttemptAt", "job"."last_error_code" AS "lastErrorCode", "job"."updated_at" AS "updatedAt"
    `);
    return rows.map((row) => ({
      id: String(row.id),
      cardId: String(row.cardId),
      walletPassId: String(row.walletPassId),
      provider: row.provider as WalletProvider,
      operation: row.operation as SyncOperation,
      status: row.status as SyncJobStatus,
      targetVersion: Number(row.targetVersion),
      attemptCount: Number(row.attemptCount),
      maxAttempts: Number(row.maxAttempts),
      nextAttemptAt: new Date(row.nextAttemptAt as string | Date),
      lastErrorCode: row.lastErrorCode ? String(row.lastErrorCode) : null,
      updatedAt: new Date(row.updatedAt as string | Date),
    }));
  }

  async recoverExpired(leaseSeconds: number): Promise<number> {
    const retried = await prisma.$executeRaw(Prisma.sql`
      UPDATE "card_wallet_sync_jobs"
      SET "status" = 'RETRY'::"CardWalletSyncJobStatus",
          "attempt_count" = "attempt_count" + 1,
          "next_attempt_at" = now() + (${Math.max(30, Math.floor(leaseSeconds / 2))} * interval '1 second'),
          "last_error_code" = 'LEASE_EXPIRED',
          "last_error_message" = 'El trabajador no renovó el lease.',
          "locked_at" = NULL,
          "locked_by" = NULL,
          "lease_expires_at" = NULL,
          "updated_at" = now()
      WHERE "status" = 'PROCESSING'::"CardWalletSyncJobStatus"
        AND "lease_expires_at" < now()
        AND "attempt_count" + 1 < "max_attempts"
    `);
    const failed = await prisma.$executeRaw(Prisma.sql`
      UPDATE "card_wallet_sync_jobs"
      SET "status" = 'FAILED'::"CardWalletSyncJobStatus",
          "attempt_count" = "attempt_count" + 1,
          "last_error_code" = 'LEASE_EXPIRED',
          "last_error_message" = 'El trabajador no renovó el lease y se agotaron los intentos.',
          "locked_at" = NULL,
          "locked_by" = NULL,
          "lease_expires_at" = NULL,
          "updated_at" = now()
      WHERE "status" = 'PROCESSING'::"CardWalletSyncJobStatus"
        AND "lease_expires_at" < now()
        AND "attempt_count" + 1 >= "max_attempts"
    `);
    return Number(retried) + Number(failed);
  }

  async reconcileStale(limit: number, maxAttempts: number, ageHours: number): Promise<number> {
    return Number(await prisma.$executeRaw(Prisma.sql`
      INSERT INTO "card_wallet_sync_jobs"
        ("id", "card_id", "wallet_pass_id", "provider", "operation", "status", "target_version", "max_attempts", "next_attempt_at", "created_at", "updated_at")
      SELECT
        md5(random()::text || clock_timestamp()::text),
        candidate."card_id", candidate."id", candidate."provider",
        CASE WHEN candidate."card_status" = 'REVOKED'::"AssociateCardStatus"
          THEN 'REVOKE'::"CardWalletSyncOperation"
          ELSE 'SYNC'::"CardWalletSyncOperation"
        END,
        'PENDING'::"CardWalletSyncJobStatus",
        candidate."version" + 1, ${maxAttempts}, now(), now(), now()
      FROM (
        SELECT p."id", p."card_id", p."provider", p."version", c."status" AS "card_status"
        FROM "card_wallet_passes" p
        JOIN "associate_cards" c ON c."id" = p."card_id"
        WHERE (
            (c."status" = 'REVOKED'::"AssociateCardStatus" AND p."sync_status" <> 'REVOKED'::"CardWalletSyncStatus")
            OR p."last_synced_at" IS NULL
            OR p."last_synced_at" < now() - (${ageHours} * interval '1 hour')
          )
          AND NOT EXISTS (
            SELECT 1 FROM "card_wallet_sync_jobs" active
            WHERE active."wallet_pass_id" = p."id"
              AND active."status" <> 'COMPLETED'::"CardWalletSyncJobStatus"
          )
        ORDER BY p."last_synced_at" ASC NULLS FIRST
        LIMIT ${limit}
      ) AS candidate
      ${ENQUEUE_CONFLICT}
    `));
  }

  async renewLeases(ids: readonly string[], workerId: string, leaseSeconds: number): Promise<number> {
    if (ids.length === 0) return 0;
    const count = await prisma.$executeRaw(Prisma.sql`
      UPDATE "card_wallet_sync_jobs"
      SET "lease_expires_at" = now() + (${leaseSeconds} * interval '1 second')
      WHERE "id" IN (${Prisma.join([...ids])})
        AND "status" = 'PROCESSING'::"CardWalletSyncJobStatus"
        AND "locked_by" = ${workerId}
    `);
    return Number(count);
  }

  async complete(id: string, workerId: string, claimedUpdatedAt: Date, expectedOperation: SyncOperation): Promise<boolean> {
    const rows = await prisma.$queryRaw<Array<{ status: string }>>(Prisma.sql`
      UPDATE "card_wallet_sync_jobs"
      SET "status" = CASE
            WHEN "updated_at" = ${claimedUpdatedAt} AND "operation" = ${expectedOperation}::"CardWalletSyncOperation" THEN 'COMPLETED'::"CardWalletSyncJobStatus"
            ELSE 'PENDING'::"CardWalletSyncJobStatus"
          END,
          "completed_at" = CASE WHEN "updated_at" = ${claimedUpdatedAt} THEN now() ELSE NULL END,
          "attempt_count" = CASE WHEN "updated_at" = ${claimedUpdatedAt} THEN "attempt_count" ELSE 0 END,
          "next_attempt_at" = CASE WHEN "updated_at" = ${claimedUpdatedAt} THEN "next_attempt_at" ELSE now() END,
          "last_error_code" = NULL,
          "last_error_message" = NULL,
          "locked_at" = NULL,
          "locked_by" = NULL,
          "lease_expires_at" = NULL,
          "updated_at" = now()
      WHERE "id" = ${id}
        AND "status" = 'PROCESSING'::"CardWalletSyncJobStatus"
        AND "locked_by" = ${workerId}
      RETURNING "status"::text AS "status"
    `);
    return rows[0]?.status === "COMPLETED";
  }

  async retry(id: string, workerId: string, nextAttemptAt: Date, code: string, message: string): Promise<boolean> {
    const count = await prisma.$executeRaw(Prisma.sql`
      UPDATE "card_wallet_sync_jobs"
      SET "status" = 'RETRY'::"CardWalletSyncJobStatus",
          "attempt_count" = "attempt_count" + 1,
          "next_attempt_at" = ${nextAttemptAt},
          "last_error_code" = ${code.slice(0, 80)},
          "last_error_message" = ${message.slice(0, 500)},
          "locked_at" = NULL,
          "locked_by" = NULL,
          "lease_expires_at" = NULL,
          "updated_at" = now()
      WHERE "id" = ${id}
        AND "status" = 'PROCESSING'::"CardWalletSyncJobStatus"
        AND "locked_by" = ${workerId}
    `);
    return Number(count) > 0;
  }

  async fail(id: string, workerId: string, code: string, message: string): Promise<boolean> {
    const count = await prisma.$executeRaw(Prisma.sql`
      UPDATE "card_wallet_sync_jobs"
      SET "status" = 'FAILED'::"CardWalletSyncJobStatus",
          "attempt_count" = "attempt_count" + 1,
          "last_error_code" = ${code.slice(0, 80)},
          "last_error_message" = ${message.slice(0, 500)},
          "locked_at" = NULL,
          "locked_by" = NULL,
          "lease_expires_at" = NULL,
          "updated_at" = now()
      WHERE "id" = ${id}
        AND "status" = 'PROCESSING'::"CardWalletSyncJobStatus"
        AND "locked_by" = ${workerId}
    `);
    return Number(count) > 0;
  }

  async requeueForCard(cardId: string): Promise<number> {
    const count = await prisma.$executeRaw(Prisma.sql`
      UPDATE "card_wallet_sync_jobs"
      SET "status" = 'PENDING'::"CardWalletSyncJobStatus",
          "attempt_count" = 0,
          "next_attempt_at" = now(),
          "last_error_code" = NULL,
          "last_error_message" = NULL,
          "completed_at" = NULL,
          "locked_at" = NULL,
          "locked_by" = NULL,
          "lease_expires_at" = NULL,
          "updated_at" = now()
      WHERE "card_id" = ${cardId}
        AND "status" <> 'PROCESSING'::"CardWalletSyncJobStatus"
    `);
    return Number(count);
  }

  async listByCard(cardId: string): Promise<SyncJobRow[]> {
    const rows = await prisma.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`
      SELECT "id", "card_id" AS "cardId", "wallet_pass_id" AS "walletPassId",
             "provider"::text AS "provider", "operation"::text AS "operation",
             "status"::text AS "status", "target_version" AS "targetVersion",
             "attempt_count" AS "attemptCount", "max_attempts" AS "maxAttempts",
             "next_attempt_at" AS "nextAttemptAt", "last_error_code" AS "lastErrorCode", "updated_at" AS "updatedAt"
      FROM "card_wallet_sync_jobs"
      WHERE "card_id" = ${cardId}
      ORDER BY "created_at" ASC
    `);
    return rows.map((row) => ({
      id: String(row.id),
      cardId: String(row.cardId),
      walletPassId: String(row.walletPassId),
      provider: row.provider as WalletProvider,
      operation: row.operation as SyncOperation,
      status: row.status as SyncJobStatus,
      targetVersion: Number(row.targetVersion),
      attemptCount: Number(row.attemptCount),
      maxAttempts: Number(row.maxAttempts),
      nextAttemptAt: new Date(row.nextAttemptAt as string | Date),
      lastErrorCode: row.lastErrorCode ? String(row.lastErrorCode) : null,
      updatedAt: new Date(row.updatedAt as string | Date),
    }));
  }

  async metrics(): Promise<SyncMetrics> {
    const rows = await prisma.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`
      SELECT
        count(*) FILTER (WHERE "status" = 'PENDING'::"CardWalletSyncJobStatus") AS "pending",
        count(*) FILTER (WHERE "status" = 'PROCESSING'::"CardWalletSyncJobStatus") AS "processing",
        count(*) FILTER (WHERE "status" = 'RETRY'::"CardWalletSyncJobStatus") AS "retry",
        count(*) FILTER (WHERE "status" = 'FAILED'::"CardWalletSyncJobStatus") AS "failed",
        count(*) FILTER (WHERE "status" = 'COMPLETED'::"CardWalletSyncJobStatus") AS "completed",
        EXTRACT(EPOCH FROM (now() - min("created_at") FILTER (
          WHERE "status" IN ('PENDING'::"CardWalletSyncJobStatus", 'RETRY'::"CardWalletSyncJobStatus")
        ))) AS "oldestPendingSeconds"
      FROM "card_wallet_sync_jobs"
    `);
    const row = rows[0] ?? {};
    const numberOrNull = (value: unknown): number | null => (value === null || value === undefined ? null : Number(value));
    return {
      pending: Number(row.pending ?? 0),
      processing: Number(row.processing ?? 0),
      retry: Number(row.retry ?? 0),
      failed: Number(row.failed ?? 0),
      completed: Number(row.completed ?? 0),
      oldestPendingSeconds: numberOrNull(row.oldestPendingSeconds),
    };
  }
}
