import { getWalletConfig, getWalletProviderMode, getWalletSimulationFailure, isGoogleWalletEmissionAllowed, type AppleWalletConfig, type GoogleWalletConfig, type WalletConfig } from "@/lib/config/wallet";
import { getCardRecord, resolveCardData } from "@/modules/afiliaciones/carnet/Services/cardData";
import { ApplePassBuilder, loadApplePassAssets } from "../Apple/ApplePassBuilder";
import { ApplePushService } from "../Apple/ApplePushService";
import { OpenSslPassSigner } from "../Apple/OpenSslPassSigner";
import { GoogleWalletClient } from "../Google/GoogleWalletClient";
import { PrismaCardWalletRepository, type CardWalletRepository, type WalletPassRow } from "../Repositories/CardWalletRepository";
import { PrismaCardWalletSyncJobRepository, type CardWalletSyncJobRepository, type SyncJobRow } from "../Repositories/CardWalletSyncJobRepository";
import {
  WalletError,
  type ApplePassResult,
  type GoogleWalletLinkDto,
  type WalletPassSummary,
  type WalletProvider,
  type WalletProviderMode,
  type WalletSimulationLinkDto,
  type WalletStatusDto,
} from "../Types/wallet";
import { writeWalletAudit, type WalletAuditEvent } from "./walletAudit";
import { appleWalletSerialNumber, deriveApplePassAuthenticationToken, googleWalletObjectId } from "./walletIdentity";
import { loadWalletCard, type WalletCardState } from "./walletState";

export interface WalletSyncResult {
  readonly provider: WalletProvider;
  readonly status: "SYNCED" | "REVOKED" | "FAILED" | "SKIPPED";
  readonly code?: string;
}

interface GoogleClientLike {
  createSaveLink(snapshot: WalletCardState["snapshot"]): Promise<GoogleWalletLinkDto>;
  syncObject(snapshot: WalletCardState["snapshot"]): Promise<void>;
}

interface ApplePushLike {
  notify(pushToken: string): Promise<"delivered" | "unregistered" | "failed">;
}

export interface CardWalletServiceDeps {
  readonly repo?: CardWalletRepository;
  readonly jobRepo?: CardWalletSyncJobRepository;
  readonly getConfig?: () => WalletConfig;
  readonly simulation?: () => boolean;
  readonly providerMode?: (provider: WalletProvider) => WalletProviderMode;
  readonly simulationFailure?: () => WalletProvider | null;
  readonly makeGoogleClient?: (config: GoogleWalletConfig, appBaseUrl: string) => GoogleClientLike;
  readonly makeAppleBuilder?: (config: AppleWalletConfig) => Pick<ApplePassBuilder, "build">;
  readonly makePush?: (config: AppleWalletConfig) => ApplePushLike | null;
  readonly audit?: (event: WalletAuditEvent) => Promise<void>;
  readonly now?: () => Date;
  readonly loadCard?: typeof loadWalletCard;
}

function passSummary(
  provider: WalletProvider,
  row: { syncStatus: WalletPassSummary["syncStatus"]; lastSyncedAt: Date | null; lastErrorCode: string | null; revokedAt: Date | null },
  deviceCount: number,
  job: SyncJobRow | undefined,
): WalletPassSummary {
  return {
    provider,
    syncStatus: row.syncStatus,
    lastSyncedAt: row.lastSyncedAt ? row.lastSyncedAt.toISOString() : null,
    lastErrorCode: job?.lastErrorCode ?? row.lastErrorCode,
    revokedAt: row.revokedAt ? row.revokedAt.toISOString() : null,
    deviceCount,
    job: job
      ? {
          operation: job.operation,
          status: job.status,
          attemptCount: job.attemptCount,
          maxAttempts: job.maxAttempts,
          nextAttemptAt: job.nextAttemptAt ? new Date(job.nextAttemptAt).toISOString() : null,
          lastErrorCode: job.lastErrorCode,
        }
      : null,
  };
}

/**
 * Coordinador Wallet: proyecta el estado del carné institucional existente a
 * Google Wallet y Apple Wallet. Nunca crea, regenera ni revoca carnés.
 */
export class CardWalletService {
  private readonly repo: CardWalletRepository;
  private readonly jobRepo: CardWalletSyncJobRepository;
  private readonly config: () => WalletConfig;
  private readonly providerMode: (provider: WalletProvider) => WalletProviderMode;
  private readonly simulationFailure: () => WalletProvider | null;
  private readonly makeGoogleClient: NonNullable<CardWalletServiceDeps["makeGoogleClient"]>;
  private readonly makeAppleBuilder: NonNullable<CardWalletServiceDeps["makeAppleBuilder"]>;
  private readonly makePush: NonNullable<CardWalletServiceDeps["makePush"]>;
  private readonly audit: NonNullable<CardWalletServiceDeps["audit"]>;
  private readonly now: () => Date;
  private readonly loadCard: typeof loadWalletCard;

  constructor(deps: CardWalletServiceDeps = {}) {
    this.repo = deps.repo ?? new PrismaCardWalletRepository();
    this.jobRepo = deps.jobRepo ?? new PrismaCardWalletSyncJobRepository();
    this.config = deps.getConfig ?? (() => getWalletConfig());
    this.providerMode = deps.providerMode ?? ((provider) => {
      if (deps.simulation) return deps.simulation() ? "SIMULATION" : "REAL";
      return getWalletProviderMode(provider);
    });
    this.simulationFailure = deps.simulationFailure ?? (() => getWalletSimulationFailure());
    this.makeGoogleClient = deps.makeGoogleClient ?? ((config, appBaseUrl) => new GoogleWalletClient(config, appBaseUrl));
    this.makeAppleBuilder = deps.makeAppleBuilder ?? ((config) => new ApplePassBuilder(new OpenSslPassSigner(config), () => loadApplePassAssets()));
    this.makePush = deps.makePush ?? ((config) => (config.apns ? new ApplePushService(config.apns, config.passTypeIdentifier) : null));
    this.audit = deps.audit ?? writeWalletAudit;
    this.now = deps.now ?? (() => new Date());
    this.loadCard = deps.loadCard ?? loadWalletCard;
  }

  async getStatus(personId: number): Promise<WalletStatusDto> {
    const config = this.config();
    const modes = { google: this.providerMode("GOOGLE"), apple: this.providerMode("APPLE") };
    const card = await getCardRecord(personId);
    if (!card) {
      return {
        enabled: { google: config.flags.googleEnabled, apple: config.flags.appleEnabled },
        configured: { google: config.google !== null, apple: config.apple !== null },
        modes,
        simulation: modes.google === "SIMULATION" || modes.apple === "SIMULATION",
        card: { generated: false, status: null, eligible: false },
        passes: [],
      };
    }
    const data = await resolveCardData(personId, undefined, { includePhoto: false }).catch(() => null);
    const rows = await this.repo.listPasses(card.id).catch(() => []);
    const jobs = await this.jobRepo.listByCard(card.id).catch(() => []);
    const jobsByPass = new Map(jobs.map((job) => [job.walletPassId, job]));
    return {
      enabled: { google: config.flags.googleEnabled, apple: config.flags.appleEnabled },
      configured: { google: config.google !== null, apple: config.apple !== null },
      modes,
      simulation: modes.google === "SIMULATION" || modes.apple === "SIMULATION",
      card: { generated: true, status: card.status, eligible: Boolean(data?.eligible) },
      passes: rows.map((row) => passSummary(row.provider, row, row.deviceCount, jobsByPass.get(row.id))),
    };
  }

  async getGoogleLink(personId: number, actorUserId?: number): Promise<GoogleWalletLinkDto> {
    if (this.providerMode("GOOGLE") === "SIMULATION") {
      const simulated = await this.getSimulationLink(personId, "GOOGLE", actorUserId);
      return { link: simulated.link, created: false, objectId: simulated.externalPassId, status: "LINK_READY" };
    }
    const config = this.config();
    if (!config.flags.googleEnabled) {
      throw new WalletError("PROVIDER_DISABLED", "Google Wallet no está habilitado en este momento.");
    }
    if (!config.google) {
      throw new WalletError("PROVIDER_NOT_CONFIGURED", "Google Wallet aún no está configurado por el IIMP.");
    }
    const state = await this.loadCard(personId);
    if (!isGoogleWalletEmissionAllowed(config.google, { personId, associateCode: state.snapshot.associateCode })) {
      await this.audit({
        action: "CARD_WALLET_GOOGLE_LINK_READY",
        personId,
        actorUserId,
        provider: "GOOGLE",
        outcome: "FAILURE",
        code: "ALLOWLIST_BLOCKED",
      });
      throw new WalletError("NOT_ELIGIBLE", "La emisión de Google Wallet no está autorizada para este asociado en este entorno.");
    }
    const objectId = googleWalletObjectId(config.google.issuerId, state.card.id, config.google.objectPrefix);
    const pass = await this.repo.ensurePass(state.card.id, "GOOGLE", objectId, { adoptSimulated: true }).catch((error) => {
      throw new WalletError("PROVIDER_ERROR", "No pudimos preparar tu billetera digital.", { cause: error });
    });
    try {
      const client = this.makeGoogleClient(config.google, config.appBaseUrl);
      const link = await client.createSaveLink(state.snapshot);
      await this.repo.markSynced(pass.id, this.now());
      await this.audit({ action: "CARD_WALLET_GOOGLE_LINK_READY", personId, actorUserId, provider: "GOOGLE", outcome: "SUCCESS" });
      return link;
    } catch (error) {
      await this.repo.markFailed(pass.id, error instanceof WalletError ? error.code : "GOOGLE_ERROR").catch(() => undefined);
      await this.audit({
        action: "CARD_WALLET_GOOGLE_LINK_READY",
        personId,
        actorUserId,
        provider: "GOOGLE",
        outcome: "FAILURE",
        code: error instanceof WalletError ? error.code : "GOOGLE_ERROR",
      });
      if (error instanceof WalletError) throw error;
      throw new WalletError("PROVIDER_ERROR", "No pudimos agregar tu carné a Google Wallet.", { cause: error });
    }
  }

  async getAppleSimulationLink(personId: number, actorUserId?: number): Promise<WalletSimulationLinkDto> {
    return this.getSimulationLink(personId, "APPLE", actorUserId);
  }

  private async getSimulationLink(personId: number, provider: WalletProvider, actorUserId?: number): Promise<WalletSimulationLinkDto> {
    const state = await this.loadCard(personId);
    const simulatedId = `SIMULATED-${provider}-${state.card.id}`;
    const existing = await this.repo.findPass(state.card.id, provider);
    let pass = existing;
    if (!pass || pass.externalPassId.startsWith("SIMULATED-")) {
      pass = await this.repo.ensurePass(state.card.id, provider, simulatedId);
      await this.repo.markSynced(pass.id, this.now());
    }
    await this.audit({
      action: provider === "GOOGLE" ? "CARD_WALLET_GOOGLE_LINK_READY" : "CARD_WALLET_APPLE_PASS_GENERATED",
      personId,
      actorUserId,
      provider,
      outcome: "SUCCESS",
      code: "LOCAL_SIMULATION",
    });
    return {
      link: `/intranet/mi-cuenta/carnet/simulacion/${provider.toLowerCase()}`,
      externalPassId: pass.externalPassId,
      provider,
    };
  }

  async createApplePass(personId: number, actorUserId?: number): Promise<ApplePassResult> {
    if (this.providerMode("APPLE") === "SIMULATION") {
      throw new WalletError("PROVIDER_DISABLED", "Apple Wallet está en modo de simulación local.");
    }
    const config = this.config();
    if (!config.flags.appleEnabled) {
      throw new WalletError("PROVIDER_DISABLED", "Apple Wallet no está habilitado en este momento.");
    }
    if (!config.apple) {
      throw new WalletError("PROVIDER_NOT_CONFIGURED", "Apple Wallet aún no está configurado por el IIMP.");
    }
    const state = await this.loadCard(personId);
    const serialNumber = appleWalletSerialNumber(state.card.id);
    const pass = await this.repo.ensurePass(state.card.id, "APPLE", serialNumber).catch((error) => {
      throw new WalletError("PROVIDER_ERROR", "No pudimos preparar tu billetera digital.", { cause: error });
    });
    try {
      const authenticationToken = deriveApplePassAuthenticationToken(
        config.apple.authenticationSecret,
        serialNumber,
        config.apple.authenticationSecretVersion,
      );
      const builder = this.makeAppleBuilder(config.apple);
      const buffer = await builder.build({ serialNumber, authenticationToken, snapshot: state.snapshot, config: config.apple });
      await this.repo.markSynced(pass.id, this.now());
      await this.audit({ action: "CARD_WALLET_APPLE_PASS_GENERATED", personId, actorUserId, provider: "APPLE", outcome: "SUCCESS" });
      return { buffer, fileName: "carne-virtual-iimp.pkpass", serialNumber };
    } catch (error) {
      await this.repo.markFailed(pass.id, error instanceof WalletError ? error.code : "APPLE_ERROR").catch(() => undefined);
      await this.audit({
        action: "CARD_WALLET_APPLE_PASS_GENERATED",
        personId,
        actorUserId,
        provider: "APPLE",
        outcome: "FAILURE",
        code: error instanceof WalletError ? error.code : "APPLE_ERROR",
      });
      if (error instanceof WalletError) throw error;
      throw new WalletError("PROVIDER_ERROR", "No pudimos generar tu pase de Apple Wallet.", { cause: error });
    }
  }

  /**
   * Sincroniza los pases existentes con el estado institucional actual. Es
   * best-effort: un fallo del proveedor nunca revierte la operación
   * institucional (emisión, revocación o regeneración del carné).
   */
  async sync(personId: number, actorUserId?: number): Promise<WalletSyncResult[]> {
    const config = this.config();
    const card = await getCardRecord(personId);
    if (!card) return [];
    const passes = await this.repo.listPasses(card.id);
    if (passes.length === 0) return [];

    let state: WalletCardState;
    try {
      state = await this.loadCard(personId, { allowRevoked: true, allowIneligible: true });
    } catch {
      return [];
    }

    const results: WalletSyncResult[] = [];
    for (const pass of passes) {
      results.push(await this.syncPass(state, pass, config, personId, actorUserId));
    }

    const failed = results.filter((result) => result.status === "FAILED");
    await this.audit({
      action: failed.length > 0 ? "CARD_WALLET_SYNC_FAILED" : "CARD_WALLET_SYNC_SUCCEEDED",
      personId,
      actorUserId,
      outcome: failed.length > 0 ? "FAILURE" : "SUCCESS",
      code: failed[0]?.code,
    });
    return results;
  }

  /**
   * Sincroniza un único proveedor. Relee el estado institucional vigente, de
   * modo que un trabajo antiguo nunca reactiva un carné revocado.
   */
  async syncProvider(personId: number, provider: WalletProvider, actorUserId?: number): Promise<WalletSyncResult> {
    const config = this.config();
    const card = await getCardRecord(personId);
    if (!card) throw new WalletError("CARD_NOT_ISSUED", "Aún no tienes un carné virtual emitido.");
    const pass = await this.repo.findPass(card.id, provider);
    if (!pass) return { provider, status: "SKIPPED" };
    const state = await this.loadCard(personId, { allowRevoked: true, allowIneligible: true });
    const result = await this.syncPass(state, pass, config, personId, actorUserId);
    await this.audit({
      action: result.status === "FAILED" ? "CARD_WALLET_SYNC_FAILED" : "CARD_WALLET_SYNC_SUCCEEDED",
      personId,
      actorUserId,
      provider,
      outcome: result.status === "FAILED" ? "FAILURE" : "SUCCESS",
      code: result.code,
    });
    return result;
  }

  private async syncPass(
    state: WalletCardState,
    pass: WalletPassRow,
    config: WalletConfig,
    personId: number,
    actorUserId?: number,
  ): Promise<WalletSyncResult> {
    if (this.providerMode(pass.provider) === "SIMULATION") {
      if (!pass.externalPassId.startsWith("SIMULATED-")) {
        return { provider: pass.provider, status: "FAILED", code: "LOCAL_SIMULATION" };
      }
      if (this.simulationFailure() === pass.provider) {
        await this.repo.markFailed(pass.id, "SIMULATED_TRANSIENT_ERROR").catch(() => undefined);
        return { provider: pass.provider, status: "FAILED", code: "SIMULATED_TRANSIENT_ERROR" };
      }
      if (state.snapshot.revoked) await this.repo.markRevoked(pass.id, this.now());
      else await this.repo.markSynced(pass.id, this.now());
      return { provider: pass.provider, status: state.snapshot.revoked ? "REVOKED" : "SYNCED" };
    }
    if (pass.provider === "GOOGLE") {
      if (!config.google) {
        await this.repo.markFailed(pass.id, "GOOGLE_NOT_CONFIGURED").catch(() => undefined);
        return { provider: "GOOGLE", status: "FAILED", code: "GOOGLE_NOT_CONFIGURED" };
      }
      if (!isGoogleWalletEmissionAllowed(config.google, { personId, associateCode: state.snapshot.associateCode })) {
        await this.repo.markFailed(pass.id, "ALLOWLIST_BLOCKED").catch(() => undefined);
        return { provider: "GOOGLE", status: "FAILED", code: "ALLOWLIST_BLOCKED" };
      }
      try {
        // Transición controlada de fixtures locales: si el pase estaba en modo
        // simulación, se adopta el identificador real estable antes de sincronizar.
        await this.repo
          .ensurePass(state.card.id, "GOOGLE", googleWalletObjectId(config.google.issuerId, state.card.id, config.google.objectPrefix), { adoptSimulated: true })
          .catch(() => undefined);
        const client = this.makeGoogleClient(config.google, config.appBaseUrl);
        await client.syncObject(state.snapshot);
        if (state.snapshot.revoked) await this.repo.markRevoked(pass.id, this.now());
        else await this.repo.markSynced(pass.id, this.now());
        return { provider: "GOOGLE", status: state.snapshot.revoked ? "REVOKED" : "SYNCED" };
      } catch (error) {
        const code = error instanceof WalletError ? error.code : "GOOGLE_SYNC_FAILED";
        await this.repo.markFailed(pass.id, code).catch(() => undefined);
        return { provider: "GOOGLE", status: "FAILED", code };
      }
    }

    if (!config.apple) {
      await this.repo.markFailed(pass.id, "APPLE_NOT_CONFIGURED").catch(() => undefined);
      return { provider: "APPLE", status: "FAILED", code: "APPLE_NOT_CONFIGURED" };
    }
    try {
      if (state.snapshot.revoked) await this.repo.markRevoked(pass.id, this.now());
      else await this.repo.markSynced(pass.id, this.now());
      const push = this.makePush(config.apple);
      if (push) {
        for (const registration of await this.repo.listRegistrations(pass.id)) {
          const result = await push.notify(registration.pushToken);
          if (result === "unregistered") await this.repo.deleteRegistration(registration.id);
        }
      }
      return { provider: "APPLE", status: state.snapshot.revoked ? "REVOKED" : "SYNCED" };
    } catch (error) {
      const code = error instanceof WalletError ? error.code : "APPLE_SYNC_FAILED";
      await this.repo.markFailed(pass.id, code).catch(() => undefined);
      return { provider: "APPLE", status: "FAILED", code };
    }
  }

  /** Variante heredada para acelerar la sincronización tras una operación institucional. */
  async syncSafely(personId: number, actorUserId?: number): Promise<void> {
    await this.sync(personId, actorUserId).catch(() => undefined);
  }
}
