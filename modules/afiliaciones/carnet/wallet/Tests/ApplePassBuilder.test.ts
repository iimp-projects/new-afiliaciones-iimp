import { createHash } from "node:crypto";
import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import type { AppleWalletConfig } from "@/lib/config/wallet";
import type { WalletCardSnapshot } from "../Types/wallet";
import { ApplePassBuilder, buildPassManifest, type ApplePassAssets } from "../Apple/ApplePassBuilder";

const config: AppleWalletConfig = {
  teamIdentifier: "TEAM123456",
  passTypeIdentifier: "pass.pe.org.iimp.carne",
  organizationName: "Instituto de Ingenieros de Minas del Perú",
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

const assets: ApplePassAssets = {
  "icon.png": Buffer.from("icon"),
  "icon@2x.png": Buffer.from("icon2"),
  "icon@3x.png": Buffer.from("icon3"),
  "logo.png": Buffer.from("logo"),
  "logo@2x.png": Buffer.from("logo2"),
};

describe("ApplePassBuilder", () => {
  it("genera un .pkpass con manifest y firma", async () => {
    const signature = Buffer.from("firma-der");
    const builder = new ApplePassBuilder({ sign: async () => signature }, async () => assets);
    const buffer = await builder.build({
      serialNumber: "iimp-card-card_abc",
      authenticationToken: "token-apple",
      snapshot,
      config,
    });

    const zip = await JSZip.loadAsync(buffer);
    const passBuffer = await zip.file("pass.json")!.async("nodebuffer");
    const pass = JSON.parse(passBuffer.toString("utf8"));
    const manifest = JSON.parse(await zip.file("manifest.json")!.async("string"));
    const sig = await zip.file("signature")!.async("nodebuffer");

    expect(pass.serialNumber).toBe("iimp-card-card_abc");
    expect(pass.authenticationToken).toBe("token-apple");
    expect(pass.webServiceURL).toBe(config.webServiceUrl);
    expect(pass.barcodes[0].message).toBe(snapshot.verificationUrl);
    expect(pass.voided).toBeUndefined();
    expect(manifest["pass.json"]).toBe(createHash("sha1").update(passBuffer).digest("hex"));
    expect(manifest["icon.png"]).toBe(createHash("sha1").update(assets["icon.png"]).digest("hex"));
    expect(sig.toString()).toBe("firma-der");
  });

  it("marca el pase como voided cuando el carné fue revocado", async () => {
    const builder = new ApplePassBuilder({ sign: async () => Buffer.from("firma") }, async () => assets);
    const buffer = await builder.build({
      serialNumber: "iimp-card-card_abc",
      authenticationToken: "token-apple",
      snapshot: { ...snapshot, revoked: true, membershipStatus: "Revocado" },
      config,
    });
    const zip = await JSZip.loadAsync(buffer);
    const pass = JSON.parse(await zip.file("pass.json")!.async("string"));
    expect(pass.voided).toBe(true);
  });

  it("omite el servicio web cuando no hay HTTPS configurado", async () => {
    const builder = new ApplePassBuilder({ sign: async () => Buffer.from("firma") }, async () => assets);
    const buffer = await builder.build({
      serialNumber: "iimp-card-card_abc",
      authenticationToken: "token-apple",
      snapshot,
      config: { ...config, webServiceUrl: null },
    });
    const zip = await JSZip.loadAsync(buffer);
    const pass = JSON.parse(await zip.file("pass.json")!.async("string"));
    expect(pass.webServiceURL).toBeUndefined();
    expect(pass.authenticationToken).toBeUndefined();
  });

  it("calcula el manifest con SHA-1 de cada recurso", () => {
    const manifest = JSON.parse(buildPassManifest({ "a.txt": Buffer.from("a"), "b.txt": Buffer.from("b") }).toString("utf8"));
    expect(manifest["a.txt"]).toBe(createHash("sha1").update("a").digest("hex"));
    expect(manifest["b.txt"]).toBe(createHash("sha1").update("b").digest("hex"));
  });
});
