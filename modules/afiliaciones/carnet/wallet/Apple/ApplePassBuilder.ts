import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import JSZip from "jszip";
import type { AppleWalletConfig } from "@/lib/config/wallet";
import { WalletError, type WalletCardSnapshot } from "../Types/wallet";

export interface PassManifestSigner {
  sign(manifest: Buffer): Promise<Buffer>;
}

export type ApplePassAssetName =
  | "icon.png"
  | "icon@2x.png"
  | "icon@3x.png"
  | "logo.png"
  | "logo@2x.png";

export type ApplePassAssets = Record<ApplePassAssetName, Buffer>;

export interface ApplePassBuildInput {
  readonly serialNumber: string;
  readonly authenticationToken: string;
  readonly snapshot: WalletCardSnapshot;
  readonly config: AppleWalletConfig;
}

export function buildApplePassJson(input: ApplePassBuildInput) {
  const { config, snapshot, serialNumber, authenticationToken } = input;
  const base = {
    formatVersion: 1,
    passTypeIdentifier: config.passTypeIdentifier,
    teamIdentifier: config.teamIdentifier,
    organizationName: config.organizationName,
    description: "Carné Virtual IIMP",
    serialNumber,
    logoText: "Instituto de Ingenieros de Minas del Perú",
    foregroundColor: "rgb(20, 35, 61)",
    backgroundColor: "rgb(255, 255, 255)",
    labelColor: "rgb(127, 86, 30)",
    generic: {
      primaryFields: [{ key: "member", label: "ASOCIADO", value: snapshot.fullName }],
      secondaryFields: [
        { key: "code", label: "CÓDIGO", value: snapshot.associateCode },
        { key: "membership", label: "MEMBRESÍA", value: snapshot.membershipType },
      ],
      auxiliaryFields: [
        { key: "status", label: "ESTADO", value: snapshot.membershipStatus },
        { key: "issued", label: "EMISIÓN", value: snapshot.issuedAt },
      ],
      backFields: [
        { key: "notice", label: "Vigencia", value: "La vigencia de la membresía se confirma al verificar el código QR." },
        { key: "verification_url", label: "Verificación", value: snapshot.verificationUrl },
      ],
    },
    barcodes: [
      {
        format: "PKBarcodeFormatQR",
        message: snapshot.verificationUrl,
        messageEncoding: "iso-8859-1",
        altText: snapshot.associateCode,
      },
    ],
  } as Record<string, unknown>;

  if (config.webServiceUrl) {
    base.webServiceURL = config.webServiceUrl;
    base.authenticationToken = authenticationToken;
  }
  if (snapshot.revoked) base.voided = true;
  return base;
}

export function buildPassManifest(files: Record<string, Buffer>): Buffer {
  const manifest: Record<string, string> = {};
  for (const [name, contents] of Object.entries(files)) {
    manifest[name] = createHash("sha1").update(contents).digest("hex");
  }
  return Buffer.from(JSON.stringify(manifest), "utf8");
}

export class ApplePassBuilder {
  constructor(
    private readonly signer: PassManifestSigner,
    private readonly loadAssets: () => Promise<ApplePassAssets>,
  ) {}

  async build(input: ApplePassBuildInput): Promise<Buffer> {
    const assets = await this.loadAssets();
    const passJson = Buffer.from(JSON.stringify(buildApplePassJson(input)), "utf8");
    const files: Record<string, Buffer> = {
      "pass.json": passJson,
      "icon.png": assets["icon.png"],
      "icon@2x.png": assets["icon@2x.png"],
      "icon@3x.png": assets["icon@3x.png"],
      "logo.png": assets["logo.png"],
      "logo@2x.png": assets["logo@2x.png"],
    };
    const manifest = buildPassManifest(files);
    const signature = await this.signer.sign(manifest);

    const zip = new JSZip();
    zip.file("pass.json", passJson);
    for (const [name, contents] of Object.entries(files)) {
      if (name !== "pass.json") zip.file(name, contents);
    }
    zip.file("manifest.json", manifest);
    zip.file("signature", signature);
    return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
  }
}

const ASSET_NAMES: ApplePassAssetName[] = ["icon.png", "icon@2x.png", "icon@3x.png", "logo.png", "logo@2x.png"];

export async function loadApplePassAssets(root = process.cwd()): Promise<ApplePassAssets> {
  const directory = path.join(root, "public", "wallet", "apple");
  try {
    const entries = await Promise.all(
      ASSET_NAMES.map(async (name) => [name, await readFile(path.join(directory, name))] as const),
    );
    return Object.fromEntries(entries) as ApplePassAssets;
  } catch {
    throw new WalletError("PROVIDER_NOT_CONFIGURED", "Los recursos del pase de Apple Wallet no están disponibles.");
  }
}
