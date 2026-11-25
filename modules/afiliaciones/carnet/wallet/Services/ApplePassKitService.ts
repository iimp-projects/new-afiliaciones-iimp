import { getWalletConfig, type AppleWalletConfig, type WalletConfig } from "@/lib/config/wallet";
import { ApplePassBuilder, loadApplePassAssets } from "../Apple/ApplePassBuilder";
import { OpenSslPassSigner } from "../Apple/OpenSslPassSigner";
import { PrismaCardWalletRepository, type CardWalletRepository, type WalletPassRow } from "../Repositories/CardWalletRepository";
import { WalletError } from "../Types/wallet";
import { writeWalletAudit, type WalletAuditEvent } from "./walletAudit";
import {
  appleAuthenticationSecrets,
  appleTokenVersion,
  deriveApplePassAuthenticationToken,
  resolveAppleTokenSecret,
  verifyApplePassAuthenticationToken,
} from "./walletIdentity";
import { loadWalletCard } from "./walletState";

export interface PassKitUpdateList {
  readonly serialNumbers: readonly string[];
  readonly lastUpdated: string;
}

export interface PassKitLatestPass {
  readonly notModified: boolean;
  readonly buffer?: Buffer;
  readonly lastModified?: Date;
}

export interface ApplePassKitServiceDeps {
  readonly repo?: CardWalletRepository;
  readonly getConfig?: () => WalletConfig;
  readonly makeBuilder?: (config: AppleWalletConfig) => Pick<ApplePassBuilder, "build">;
  readonly audit?: (event: WalletAuditEvent) => Promise<void>;
  readonly loadCard?: typeof loadWalletCard;
}

/** Protocolo oficial de actualización de pases de Apple (PassKit Web Service). */
export class ApplePassKitService {
  private readonly repo: CardWalletRepository;
  private readonly config: () => WalletConfig;
  private readonly makeBuilder: NonNullable<ApplePassKitServiceDeps["makeBuilder"]>;
  private readonly audit: NonNullable<ApplePassKitServiceDeps["audit"]>;
  private readonly loadCard: typeof loadWalletCard;

  constructor(deps: ApplePassKitServiceDeps = {}) {
    this.repo = deps.repo ?? new PrismaCardWalletRepository();
    this.config = deps.getConfig ?? (() => getWalletConfig());
    this.makeBuilder = deps.makeBuilder ?? ((config) => new ApplePassBuilder(new OpenSslPassSigner(config), () => loadApplePassAssets()));
    this.audit = deps.audit ?? writeWalletAudit;
    this.loadCard = deps.loadCard ?? loadWalletCard;
  }

  async register(input: {
    passTypeIdentifier: string;
    serialNumber: string;
    deviceLibraryIdentifier: string;
    pushToken: string;
    authenticationToken: string;
  }): Promise<"created" | "updated"> {
    const { pass } = await this.findAuthorizedPass(input);
    const existing = (await this.repo.listRegistrations(pass.id)).some(
      (registration) => registration.deviceLibraryIdentifier === input.deviceLibraryIdentifier,
    );
    await this.repo.addRegistration(pass.id, input.deviceLibraryIdentifier, input.pushToken);
    const personId = (await this.repo.getCardPersonId(pass.cardId)) ?? 0;
    await this.audit({
      action: "CARD_WALLET_PASSKIT_REGISTERED",
      personId,
      provider: "APPLE",
      outcome: "SUCCESS",
    });
    return existing ? "updated" : "created";
  }

  async unregister(input: {
    passTypeIdentifier: string;
    serialNumber: string;
    deviceLibraryIdentifier: string;
    authenticationToken: string;
  }): Promise<boolean> {
    const { pass } = await this.findAuthorizedPass(input);
    const removed = await this.repo.removeRegistration(pass.id, input.deviceLibraryIdentifier);
    const personId = (await this.repo.getCardPersonId(pass.cardId)) ?? 0;
    await this.audit({
      action: "CARD_WALLET_PASSKIT_UNREGISTERED",
      personId,
      provider: "APPLE",
      outcome: "SUCCESS",
    });
    return removed;
  }

  async listUpdates(input: {
    passTypeIdentifier: string;
    deviceLibraryIdentifier: string;
    authenticationToken: string;
    updatedSince: string | null;
  }): Promise<PassKitUpdateList | null> {
    const config = this.config();
    if (!config.apple) throw new WalletError("PROVIDER_NOT_CONFIGURED", "Apple Wallet no está configurado.");
    if (input.passTypeIdentifier !== config.apple.passTypeIdentifier) {
      throw new WalletError("NOT_FOUND", "Pase no encontrado.");
    }
    const registrations = await this.repo.listDeviceRegistrations(input.deviceLibraryIdentifier, "APPLE");
    if (registrations.length === 0) return null;
    const secrets = appleAuthenticationSecrets(config.apple);
    const authorized = registrations.some(({ pass }) =>
      verifyApplePassAuthenticationToken(secrets, pass.externalPassId, input.authenticationToken),
    );
    if (!authorized) throw new WalletError("FORBIDDEN", "Autorización del pase inválida.");

    const latest = registrations.reduce((max, { pass }) => (pass.updatedAt > max ? pass.updatedAt : max), registrations[0].pass.updatedAt);
    const lastUpdated = latest.toISOString();
    if (input.updatedSince && input.updatedSince >= lastUpdated) return null;
    return { serialNumbers: registrations.map(({ pass }) => pass.externalPassId), lastUpdated };
  }

  async latestPass(input: {
    passTypeIdentifier: string;
    serialNumber: string;
    authenticationToken: string;
    ifModifiedSince: string | null;
  }): Promise<PassKitLatestPass> {
    const { config, pass } = await this.findAuthorizedPass(input);
    if (input.ifModifiedSince) {
      const since = new Date(input.ifModifiedSince);
      if (!Number.isNaN(since.getTime()) && since >= pass.updatedAt) return { notModified: true };
    }
    const personId = await this.repo.getCardPersonId(pass.cardId);
    if (!personId) throw new WalletError("NOT_FOUND", "Pase no encontrado.");
    const state = await this.loadCard(personId, { allowRevoked: true, allowIneligible: true });
    const secrets = appleAuthenticationSecrets(config.apple!);
    const requestedVersion = appleTokenVersion(input.authenticationToken);
    const tokenVersion = requestedVersion && resolveAppleTokenSecret(secrets, requestedVersion)
      ? requestedVersion
      : config.apple!.authenticationSecretVersion;
    const tokenSecret = resolveAppleTokenSecret(secrets, tokenVersion);
    if (!tokenSecret) throw new WalletError("PROVIDER_NOT_CONFIGURED", "La versión del secreto del pase no está disponible.");
    const authenticationToken = deriveApplePassAuthenticationToken(tokenSecret, pass.externalPassId, tokenVersion);
    const builder = this.makeBuilder(config.apple!);
    const buffer = await builder.build({
      serialNumber: pass.externalPassId,
      authenticationToken,
      snapshot: state.snapshot,
      config: config.apple!,
    });
    return { notModified: false, buffer, lastModified: pass.updatedAt };
  }

  private async findAuthorizedPass(input: {
    passTypeIdentifier: string;
    serialNumber: string;
    authenticationToken: string;
  }): Promise<{ config: WalletConfig; pass: WalletPassRow }> {
    const config = this.config();
    if (!config.apple) throw new WalletError("PROVIDER_NOT_CONFIGURED", "Apple Wallet no está configurado.");
    if (input.passTypeIdentifier !== config.apple.passTypeIdentifier) {
      throw new WalletError("NOT_FOUND", "Pase no encontrado.");
    }
    const pass = await this.repo.findPassByExternalId("APPLE", input.serialNumber);
    if (!pass) throw new WalletError("NOT_FOUND", "Pase no encontrado.");
    const valid = verifyApplePassAuthenticationToken(
      appleAuthenticationSecrets(config.apple),
      pass.externalPassId,
      input.authenticationToken,
    );
    if (!valid) {
      const personId = (await this.repo.getCardPersonId(pass.cardId)) ?? 0;
      await this.audit({
        action: "CARD_WALLET_PASSKIT_AUTH_FAILED",
        personId,
        provider: "APPLE",
        outcome: "FAILURE",
      });
      throw new WalletError("FORBIDDEN", "Autorización del pase inválida.");
    }
    return { config, pass };
  }
}
