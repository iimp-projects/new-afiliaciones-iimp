import { describe, expect, it, vi } from "vitest";
import type { AppleWalletConfig, WalletConfig } from "@/lib/config/wallet";
import type { CardWalletRepository, WalletPassRow } from "../Repositories/CardWalletRepository";
import { ApplePassKitService } from "../Services/ApplePassKitService";
import { deriveApplePassAuthenticationToken } from "../Services/walletIdentity";
import type { WalletCardState } from "../Services/walletState";

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
  apns: null,
};

const config: WalletConfig = {
  appBaseUrl: "https://portal.example",
  flags: { googleEnabled: false, appleEnabled: true },
  modes: { google: "REAL", apple: "SIMULATION" },
  google: null,
  apple,
  emissionAllowlist: { allowedPersonIds: [], allowedAssociateCodePrefixes: [] },
};

const SERIAL = "iimp-card-card_abc";
const TOKEN = deriveApplePassAuthenticationToken(apple.authenticationSecret, SERIAL);

const pass: WalletPassRow = {
  id: "pass-apple",
  cardId: "card_abc",
  provider: "APPLE",
  externalPassId: SERIAL,
  syncStatus: "SYNCED",
  version: 2,
  lastErrorCode: null,
  lastSyncedAt: new Date("2026-11-24T10:00:00Z"),
  revokedAt: null,
  updatedAt: new Date("2026-11-24T10:00:00Z"),
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
  snapshot: {
    personId: 1,
    cardId: "card_abc",
    fullName: "Ana Pérez",
    associateCode: "A-1",
    membershipType: "Asociado Activo",
    membershipStatus: "Vigente",
    issuedAt: "20/11/2026",
    verificationUrl: "https://portal.example/verificar-carnet/token",
    revoked: false,
  },
};

function repo(overrides: Partial<Record<keyof CardWalletRepository, unknown>> = {}): CardWalletRepository {
  return {
    findPass: vi.fn(),
    findPassByExternalId: vi.fn(async () => pass),
    getCardPersonId: vi.fn(async () => 1),
    listPasses: vi.fn(async () => []),
    ensurePass: vi.fn(),
    markSynced: vi.fn(),
    markFailed: vi.fn(),
    markRevoked: vi.fn(),
    addRegistration: vi.fn(async () => undefined),
    removeRegistration: vi.fn(async () => true),
    listRegistrations: vi.fn(async () => []),
    listDeviceRegistrations: vi.fn(async () => []),
    deleteRegistration: vi.fn(),
    ...overrides,
  } as unknown as CardWalletRepository;
}

function makeService(r: CardWalletRepository, build = vi.fn(async () => Buffer.from("pkpass")), audit = vi.fn(async () => undefined)) {
  return new ApplePassKitService({
    repo: r,
    getConfig: () => config,
    makeBuilder: () => ({ build }),
    audit,
    loadCard: async () => state,
  });
}

describe("ApplePassKitService", () => {
  it("registra un dispositivo con token válido", async () => {
    const r = repo();
    const result = await makeService(r).register({
      passTypeIdentifier: "pass.iimp",
      serialNumber: SERIAL,
      deviceLibraryIdentifier: "device-1",
      pushToken: "push-token",
      authenticationToken: TOKEN,
    });
    expect(result).toBe("created");
    expect(r.addRegistration).toHaveBeenCalledWith("pass-apple", "device-1", "push-token");
  });

  it("rechaza un token de pase inválido", async () => {
    const r = repo();
    await expect(
      makeService(r).register({
        passTypeIdentifier: "pass.iimp",
        serialNumber: SERIAL,
        deviceLibraryIdentifier: "device-1",
        pushToken: "push-token",
        authenticationToken: "invalido",
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(r.addRegistration).not.toHaveBeenCalled();
  });

  it("devuelve 304 lógico cuando el pase no cambió", async () => {
    const r = repo();
    const result = await makeService(r).latestPass({
      passTypeIdentifier: "pass.iimp",
      serialNumber: SERIAL,
      authenticationToken: TOKEN,
      ifModifiedSince: new Date("2026-11-25T00:00:00Z").toUTCString(),
    });
    expect(result.notModified).toBe(true);
  });

  it("genera la versión vigente del pase para PassKit", async () => {
    const r = repo();
    const build = vi.fn(async () => Buffer.from("pkpass"));
    const result = await makeService(r, build).latestPass({
      passTypeIdentifier: "pass.iimp",
      serialNumber: SERIAL,
      authenticationToken: TOKEN,
      ifModifiedSince: null,
    });
    expect(result.notModified).toBe(false);
    expect(result.buffer?.toString()).toBe("pkpass");
    expect(build).toHaveBeenCalledWith(expect.objectContaining({ serialNumber: SERIAL, authenticationToken: TOKEN }));
  });

  it("acepta pases instalados con la versión previa del secreto tras rotar", async () => {
    const previousSecret = "p".repeat(40);
    const rotated = {
      ...config,
      apple: {
        ...apple,
        authenticationSecret: "n".repeat(40),
        authenticationSecretVersion: 2,
        previousAuthenticationSecret: previousSecret,
        previousAuthenticationSecretVersion: 1,
      },
    } as WalletConfig;
    const previousToken = deriveApplePassAuthenticationToken(previousSecret, SERIAL, 1);
    const r = repo();
    const service = new ApplePassKitService({
      repo: r,
      getConfig: () => rotated,
      makeBuilder: () => ({ build: vi.fn(async () => Buffer.from("pkpass")) }),
      audit: vi.fn(async () => undefined),
      loadCard: async () => state,
    });
    await expect(
      service.register({
        passTypeIdentifier: "pass.iimp",
        serialNumber: SERIAL,
        deviceLibraryIdentifier: "device-1",
        pushToken: "push-token",
        authenticationToken: previousToken,
      }),
    ).resolves.toBe("created");

    const latest = await service.latestPass({
      passTypeIdentifier: "pass.iimp",
      serialNumber: SERIAL,
      authenticationToken: previousToken,
      ifModifiedSince: null,
    });
    expect(latest.notModified).toBe(false);
  });

  it("lista solo los pases actualizados del dispositivo", async () => {
    const r = repo({
      listDeviceRegistrations: vi.fn(async () => [{ pass, registration: { id: "reg", passId: pass.id, deviceLibraryIdentifier: "device-1", pushToken: "push", updatedAt: pass.updatedAt } }]),
    });
    const updates = await makeService(r).listUpdates({
      passTypeIdentifier: "pass.iimp",
      deviceLibraryIdentifier: "device-1",
      authenticationToken: TOKEN,
      updatedSince: "2026-11-20T00:00:00.000Z",
    });
    expect(updates?.serialNumbers).toEqual([SERIAL]);
    const none = await makeService(r).listUpdates({
      passTypeIdentifier: "pass.iimp",
      deviceLibraryIdentifier: "device-1",
      authenticationToken: TOKEN,
      updatedSince: "2026-11-25T00:00:00.000Z",
    });
    expect(none).toBeNull();
  });
});
