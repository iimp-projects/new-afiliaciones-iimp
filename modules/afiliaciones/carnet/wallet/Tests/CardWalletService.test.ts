import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppleWalletConfig, GoogleWalletConfig, WalletConfig } from "@/lib/config/wallet";
import type { CardWalletRepository, WalletPassRow } from "../Repositories/CardWalletRepository";
import type { WalletCardSnapshot } from "../Types/wallet";
import { CardWalletService } from "../Services/CardWalletService";
import type { WalletCardState } from "../Services/walletState";

const mocks = vi.hoisted(() => ({
  getCardRecord: vi.fn(),
  resolveCardData: vi.fn(),
}));

vi.mock("@/modules/afiliaciones/carnet/Services/cardData", () => mocks);

import { getCardRecord } from "@/modules/afiliaciones/carnet/Services/cardData";

const google: GoogleWalletConfig = {
  issuerId: "3388",
  classId: "3388.class",
  objectPrefix: "iimp_card_",
  serviceAccount: { clientEmail: "wallet@example.com", privateKey: "-----BEGIN TEST KEY-----\nkey\n-----END TEST KEY-----" },
  classAutoCreate: true,
  allowedPersonIds: [],
  allowedAssociateCodePrefixes: [],
};

const apple: AppleWalletConfig = {
  teamIdentifier: "TEAM",
  passTypeIdentifier: "pass.iimp",
  organizationName: "IIMP",
  updatesEnabled: true,
  webServiceUrl: "https://portal.example/api/afiliaciones/carnet/wallet/apple",
  certificatePem: "cert",
  privateKeyPem: "key",
  wwdrCertificatePem: "wwdr",
  keyPassphrase: null,
  opensslPath: null,
  authenticationSecret: "s".repeat(40),
  authenticationSecretVersion: 1,
  previousAuthenticationSecret: null,
  previousAuthenticationSecretVersion: null,
  apns: { keyId: "K", teamId: "TEAM", privateKeyPem: "p8" },
};

function walletConfig(enabled = true): WalletConfig {
  return {
    appBaseUrl: "https://portal.example",
    flags: { googleEnabled: enabled, appleEnabled: enabled },
    modes: { google: "REAL", apple: "SIMULATION" },
    google,
    apple,
    emissionAllowlist: { allowedPersonIds: [], allowedAssociateCodePrefixes: [] },
  };
}

const snapshot: WalletCardSnapshot = {
  personId: 1,
  cardId: "card_abc",
  fullName: "Ana Pérez",
  associateCode: "A-1",
  membershipType: "Asociado Activo",
  membershipStatus: "Vigente",
  issuedAt: "20/11/2026",
  verificationUrl: "https://portal.example/verificar-carnet/token",
  revoked: false,
};

const state: WalletCardState = {
  card: {
    id: "card_abc",
    personId: 1,
    verificationToken: "token",
    status: "ISSUED",
    issuedAt: new Date("2026-11-20T00:00:00Z"),
    revokedAt: null,
    revokedReason: null,
    updatedAt: new Date("2026-11-20T00:00:00Z"),
  },
  data: {
    firstName: "Ana",
    paternalLastName: "Pérez",
    maternalLastName: null,
    name: "Ana Pérez",
    code: "A-1",
    category: "Asociado Activo",
    photoUrl: null,
    source: "NEW",
    eligible: true,
    reason: null,
  },
  eligible: true,
  snapshot,
};

function pass(provider: "GOOGLE" | "APPLE"): WalletPassRow {
  return {
    id: `pass-${provider}`,
    cardId: "card_abc",
    provider,
    externalPassId: provider === "APPLE" ? "iimp-card-card_abc" : "3388.iimp_card_card_abc",
    syncStatus: "SYNCED",
    version: 1,
    lastErrorCode: null,
    lastSyncedAt: new Date("2026-11-20T00:00:00Z"),
    revokedAt: null,
    updatedAt: new Date("2026-11-20T00:00:00Z"),
  };
}

function repository(overrides: Partial<Record<keyof CardWalletRepository, unknown>> = {}): CardWalletRepository {
  return {
    findPass: vi.fn(async () => null),
    findPassByExternalId: vi.fn(async () => null),
    getCardPersonId: vi.fn(async () => 1),
    listPasses: vi.fn(async () => []),
    ensurePass: vi.fn(async (cardId: string, provider: "GOOGLE" | "APPLE", externalPassId: string) => ({
      ...pass(provider),
      cardId,
      externalPassId,
    })),
    markSynced: vi.fn(async () => undefined),
    markFailed: vi.fn(async () => undefined),
    markRevoked: vi.fn(async () => undefined),
    addRegistration: vi.fn(async () => undefined),
    removeRegistration: vi.fn(async () => true),
    listRegistrations: vi.fn(async () => []),
    listDeviceRegistrations: vi.fn(async () => []),
    deleteRegistration: vi.fn(async () => undefined),
    ...overrides,
  } as unknown as CardWalletRepository;
}

function service(overrides: {
  repo?: CardWalletRepository;
  config?: WalletConfig;
  loadCard?: typeof import("../Services/walletState").loadWalletCard;
  googleClient?: { createSaveLink: ReturnType<typeof vi.fn>; syncObject: ReturnType<typeof vi.fn> };
  push?: { notify: ReturnType<typeof vi.fn> };
  audit?: ReturnType<typeof vi.fn>;
  simulation?: boolean;
} = {}) {
  const audit = overrides.audit ?? vi.fn(async () => undefined);
  const googleClient = overrides.googleClient ?? {
    createSaveLink: vi.fn(async () => ({ link: "https://pay.google.com/gp/v/save/jwt", created: true, objectId: "3388.iimp_card_card_abc", status: "LINK_READY" })),
    syncObject: vi.fn(async () => undefined),
  };
  return {
    audit,
    googleClient,
    service: new CardWalletService({
      repo: overrides.repo ?? repository(),
      getConfig: () => overrides.config ?? walletConfig(),
      simulation: () => overrides.simulation ?? false,
      loadCard: overrides.loadCard ?? (async () => state),
      makeGoogleClient: () => googleClient as never,
      makeAppleBuilder: () => ({ build: vi.fn(async () => Buffer.from("pkpass")) }),
      makePush: () => (overrides.push ?? null) as never,
      audit: audit as never,
      now: () => new Date("2026-11-24T12:00:00Z"),
    }),
  };
}

beforeEach(() => {
  mocks.getCardRecord.mockReset();
  mocks.resolveCardData.mockReset();
});

describe("CardWalletService", () => {
  it("rechaza Google Wallet cuando el feature flag está deshabilitado", async () => {
    const { service: wallet } = service({ config: walletConfig(false) });
    await expect(wallet.getGoogleLink(1, 9)).rejects.toMatchObject({ code: "PROVIDER_DISABLED" });
  });

  it("crea el enlace de Google y registra el pase sincronizado", async () => {
    const repo = repository();
    const { service: wallet, audit, googleClient } = service({ repo });
    const result = await wallet.getGoogleLink(1, 9);
    expect(result.status).toBe("LINK_READY");
    expect(googleClient.createSaveLink).toHaveBeenCalledWith(snapshot);
    expect(repo.ensurePass).toHaveBeenCalledWith("card_abc", "GOOGLE", "3388.iimp_card_card_abc", { adoptSimulated: true });
    expect(repo.markSynced).toHaveBeenCalled();
    expect(audit).toHaveBeenCalledWith(expect.objectContaining({ action: "CARD_WALLET_GOOGLE_LINK_READY", outcome: "SUCCESS" }));
  });

  it("usa el namespace configurado en el identificador del objeto", async () => {
    const base = walletConfig();
    const qa: WalletConfig = { ...base, google: { ...base.google!, objectPrefix: "iimp_qa_card_" } };
    const repo = repository();
    const { service: wallet } = service({ repo, config: qa });
    await wallet.getGoogleLink(1, 9);
    expect(repo.ensurePass).toHaveBeenCalledWith("card_abc", "GOOGLE", "3388.iimp_qa_card_card_abc", { adoptSimulated: true });
  });

  it("bloquea la emisión real fuera de la allowlist sintética", async () => {
    const base = walletConfig();
    const restricted: WalletConfig = {
      ...base,
      emissionAllowlist: { allowedPersonIds: [], allowedAssociateCodePrefixes: ["QA-TEST-"] },
    };
    const { service: wallet, googleClient, audit } = service({ config: restricted });
    await expect(wallet.getGoogleLink(1, 9)).rejects.toMatchObject({ code: "NOT_ELIGIBLE" });
    expect(googleClient.createSaveLink).not.toHaveBeenCalled();
    expect(audit).toHaveBeenCalledWith(expect.objectContaining({ code: "ALLOWLIST_BLOCKED" }));
  });

  it("marca el error del proveedor sin romper la operación institucional", async () => {
    const repo = repository();
    const googleClient = {
      createSaveLink: vi.fn(async () => { throw new Error("boom"); }),
      syncObject: vi.fn(async () => undefined),
    };
    const { service: wallet } = service({ repo, googleClient });
    await expect(wallet.getGoogleLink(1, 9)).rejects.toMatchObject({ code: "PROVIDER_ERROR" });
    expect(repo.markFailed).toHaveBeenCalled();
  });

  it("propaga revocación a ambos proveedores y elimina push tokens inválidos", async () => {
    mocks.getCardRecord.mockResolvedValue(state.card);
    const repo = repository({
      listPasses: vi.fn(async () => [
        { ...pass("GOOGLE"), deviceCount: 0 },
        { ...pass("APPLE"), deviceCount: 1 },
      ]),
      listRegistrations: vi.fn(async () => [{ id: "reg-1", passId: "pass-APPLE", deviceLibraryIdentifier: "device", pushToken: "push", updatedAt: new Date() }]),
    });
    const googleClient = { createSaveLink: vi.fn(), syncObject: vi.fn(async () => undefined) };
    const push = { notify: vi.fn(async () => "unregistered" as const) };
    const { service: wallet } = service({
      repo,
      googleClient,
      push,
      loadCard: async () => ({ ...state, snapshot: { ...snapshot, revoked: true, membershipStatus: "Revocado" } }),
    });

    const results = await wallet.sync(1, 9);
    expect(results).toEqual([
      { provider: "GOOGLE", status: "REVOKED" },
      { provider: "APPLE", status: "REVOKED" },
    ]);
    expect(googleClient.syncObject).toHaveBeenCalledWith(expect.objectContaining({ revoked: true }));
    expect(repo.markRevoked).toHaveBeenCalledTimes(2);
    expect(push.notify).toHaveBeenCalledWith("push");
    expect(repo.deleteRegistration).toHaveBeenCalledWith("reg-1");
  });

  it("permite revocar un pase emitido aunque el asociado esté fuera de la allowlist", async () => {
    mocks.getCardRecord.mockResolvedValue(state.card);
    const base = walletConfig();
    const restricted: WalletConfig = { ...base, google: { ...base.google!, allowedAssociateCodePrefixes: ["QA-TEST-"] } };
    const repo = repository({ findPass: vi.fn(async () => pass("GOOGLE")) });
    const googleClient = { createSaveLink: vi.fn(), syncObject: vi.fn(async () => undefined) };
    const { service: wallet } = service({
      repo,
      config: restricted,
      googleClient,
      loadCard: async () => ({ ...state, snapshot: { ...snapshot, revoked: true, membershipStatus: "Revocado" } }),
    });
    const result = await wallet.syncProvider(1, "GOOGLE");
    expect(result).toEqual({ provider: "GOOGLE", status: "REVOKED" });
    expect(googleClient.syncObject).toHaveBeenCalledWith(expect.objectContaining({ revoked: true }));
    expect(repo.markRevoked).toHaveBeenCalled();
    expect(repo.markFailed).not.toHaveBeenCalledWith("pass-GOOGLE", "ALLOWLIST_BLOCKED");
  });

  it("actualiza un pase existente fuera de la allowlist sin bloquearlo", async () => {
    mocks.getCardRecord.mockResolvedValue(state.card);
    const base = walletConfig();
    const restricted: WalletConfig = { ...base, google: { ...base.google!, allowedAssociateCodePrefixes: ["QA-TEST-"] } };
    const repo = repository({ findPass: vi.fn(async () => pass("GOOGLE")) });
    const googleClient = { createSaveLink: vi.fn(), syncObject: vi.fn(async () => undefined) };
    const { service: wallet } = service({ repo, config: restricted, googleClient });
    const result = await wallet.syncProvider(1, "GOOGLE");
    expect(result).toEqual({ provider: "GOOGLE", status: "SYNCED" });
    expect(googleClient.syncObject).toHaveBeenCalled();
    expect(repo.markSynced).toHaveBeenCalled();
  });

  it("no lanza si falla un proveedor durante la sincronización", async () => {
    mocks.getCardRecord.mockResolvedValue(state.card);
    const repo = repository({
      listPasses: vi.fn(async () => [
        { ...pass("GOOGLE"), deviceCount: 0 },
        { ...pass("APPLE"), deviceCount: 0 },
      ]),
    });
    const googleClient = { createSaveLink: vi.fn(), syncObject: vi.fn(async () => { throw new Error("google down"); }) };
    const { service: wallet } = service({ repo, googleClient });
    const results = await wallet.sync(1, 9);
    expect(results[0]).toMatchObject({ provider: "GOOGLE", status: "FAILED" });
    expect(results[1]).toMatchObject({ provider: "APPLE", status: "SYNCED" });
    expect(repo.markFailed).toHaveBeenCalled();
  });

  it("genera enlaces de simulación local sin llamar proveedores", async () => {
    const repo = repository();
    const { service: wallet, audit, googleClient } = service({ repo, simulation: true, config: walletConfig(false) });
    const google = await wallet.getGoogleLink(1, 9);
    expect(google.link).toBe("/intranet/mi-cuenta/carnet/simulacion/google");
    expect(googleClient.createSaveLink).not.toHaveBeenCalled();
    const apple = await wallet.getAppleSimulationLink(1, 9);
    expect(apple.link).toBe("/intranet/mi-cuenta/carnet/simulacion/apple");
    expect(audit).toHaveBeenCalledWith(expect.objectContaining({ code: "LOCAL_SIMULATION" }));
  });

  it("sincroniza pases simulados sin llamadas externas y rechaza pases reales", async () => {
    mocks.getCardRecord.mockResolvedValue(state.card);
    const simulatedPass = { ...pass("GOOGLE"), externalPassId: "SIMULATED-GOOGLE-card_abc" };
    const repo = repository({ findPass: vi.fn(async () => simulatedPass), listPasses: vi.fn(async () => [{ ...simulatedPass, deviceCount: 0 }]) });
    const googleClient = { createSaveLink: vi.fn(), syncObject: vi.fn() };
    const { service: wallet } = service({ repo, googleClient, simulation: true });
    const result = await wallet.syncProvider(1, "GOOGLE");
    expect(result.status).toBe("SYNCED");
    expect(googleClient.syncObject).not.toHaveBeenCalled();
    expect(repo.markSynced).toHaveBeenCalled();

    const realRepo = repository({ findPass: vi.fn(async () => pass("GOOGLE")) });
    const real = service({ repo: realRepo, googleClient, simulation: true });
    await expect(real.service.syncProvider(1, "GOOGLE")).resolves.toMatchObject({ status: "FAILED", code: "LOCAL_SIMULATION" });
    expect(googleClient.syncObject).not.toHaveBeenCalled();
  });

  it("genera el pase Apple sin exponer el token en auditoría", async () => {
    const repo = repository();
    const { service: wallet, audit } = service({ repo });
    const result = await wallet.createApplePass(1, 9);
    expect(result.fileName).toBe("carne-virtual-iimp.pkpass");
    expect(result.buffer.toString()).toBe("pkpass");
    expect(audit).toHaveBeenCalledWith(expect.objectContaining({ action: "CARD_WALLET_APPLE_PASS_GENERATED", outcome: "SUCCESS" }));
    expect(JSON.stringify(audit.mock.calls)).not.toContain("token");
  });

  it("bloquea la emisión Apple fuera de la allowlist compartida", async () => {
    const base = walletConfig();
    const restricted: WalletConfig = {
      ...base,
      emissionAllowlist: { allowedPersonIds: [], allowedAssociateCodePrefixes: ["QA-TEST-"] },
    };
    const { service: wallet, audit } = service({ config: restricted });
    await expect(wallet.createApplePass(1, 9)).rejects.toMatchObject({ code: "NOT_ELIGIBLE" });
    expect(audit).toHaveBeenCalledWith(expect.objectContaining({
      action: "CARD_WALLET_APPLE_PASS_GENERATED",
      outcome: "FAILURE",
      code: "ALLOWLIST_BLOCKED",
    }));
  });

  it("permite la emisión Apple para un personId autorizado", async () => {
    const base = walletConfig();
    const allowed: WalletConfig = {
      ...base,
      emissionAllowlist: { allowedPersonIds: [1], allowedAssociateCodePrefixes: [] },
    };
    const { service: wallet } = service({ config: allowed });
    const result = await wallet.createApplePass(1, 9);
    expect(result.buffer.toString()).toBe("pkpass");
  });

  it("emite un pase Apple estático sin marcarlo como sincronizado", async () => {
    const base = walletConfig();
    const staticConfig: WalletConfig = {
      ...base,
      apple: { ...base.apple!, updatesEnabled: false, webServiceUrl: null, authenticationSecret: "", apns: null },
    };
    const repo = repository();
    const { service: wallet, audit } = service({ repo, config: staticConfig });
    const result = await wallet.createApplePass(1, 9);
    expect(result.buffer.toString()).toBe("pkpass");
    expect(repo.markSynced).not.toHaveBeenCalled();
    expect(audit).toHaveBeenCalledWith(expect.objectContaining({ action: "CARD_WALLET_APPLE_PASS_GENERATED", outcome: "SUCCESS" }));
  });

  it("omite la sincronización de Apple cuando las actualizaciones están deshabilitadas", async () => {
    mocks.getCardRecord.mockResolvedValue(state.card);
    const base = walletConfig();
    const staticConfig: WalletConfig = {
      ...base,
      apple: { ...base.apple!, updatesEnabled: false, webServiceUrl: null, authenticationSecret: "", apns: null },
    };
    const repo = repository({ findPass: vi.fn(async () => pass("APPLE")) });
    const push = { notify: vi.fn() };
    const { service: wallet } = service({ repo, config: staticConfig, push });
    const result = await wallet.syncProvider(1, "APPLE");
    expect(result).toEqual({ provider: "APPLE", status: "SKIPPED", code: "UPDATES_DISABLED" });
    expect(repo.markSynced).not.toHaveBeenCalled();
    expect(repo.markRevoked).not.toHaveBeenCalled();
    expect(push.notify).not.toHaveBeenCalled();
  });
});
