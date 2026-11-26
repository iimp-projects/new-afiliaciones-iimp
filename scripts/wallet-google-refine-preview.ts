import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getWalletConfig } from "@/lib/config/wallet";
import { GoogleWalletClient, buildGenericObjectPayload } from "@/modules/afiliaciones/carnet/wallet/Google/GoogleWalletClient";
import {
  buildWalletBrand,
  resolveWalletAsset,
  type WalletBrandVariant,
} from "@/modules/afiliaciones/carnet/wallet/Google/walletBranding";
import type { WalletCardSnapshot } from "@/modules/afiliaciones/carnet/wallet/Types/wallet";

/**
 * Refina SOLO los atributos visuales de los GenericObject existentes:
 * `cardTitle`, `header`, `subheader`, `hexBackgroundColor`, `logo`, `wideLogo`
 * y `heroImage`. No toca IDs, estado, barcode, firma JWT ni credenciales.
 *
 * Salvaguardas:
 * - Aborta si el destino parece LOCAL (clase `*_local` o prefijo `iimp_card_`).
 * - Aborta si el origen no es HTTPS, porque Google no podría descargar los PNG.
 * - Verifica por HEAD/GET que los tres recursos sean PNG accesibles.
 * - Respalda el objeto remoto antes de cada PATCH.
 * - Relee el objeto y compara los campos aplicados.
 *
 * Uso (solo QA):
 *   npm run wallet:google:refine -- --variant champagne [--object <id>] [--print-link]
 *   Variantes: champagne (prioritaria), soft-gold, ivory, gold.
 */
const VISUAL_FIELDS = [
  "cardTitle",
  "header",
  "subheader",
  "hexBackgroundColor",
  "logo",
  "wideLogo",
  "heroImage",
] as const;

type VisualField = (typeof VISUAL_FIELDS)[number];

interface LocalizedValue {
  defaultValue?: { language?: string; value?: string };
}

interface RemoteImage {
  sourceUri?: { uri?: string; description?: string };
}

interface RemoteObject {
  id: string;
  state?: string;
  cardTitle?: LocalizedValue;
  header?: LocalizedValue;
  subheader?: LocalizedValue;
  hexBackgroundColor?: string;
  logo?: RemoteImage;
  wideLogo?: RemoteImage;
  heroImage?: RemoteImage;
  barcode?: { value?: string; alternateText?: string };
  textModulesData?: Array<{ id?: string; body?: string }>;
}

function argValue(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag);
}

function moduleBody(object: RemoteObject, id: string): string | undefined {
  return object.textModulesData?.find((module) => module.id === id)?.body;
}

function snapshotFrom(object: RemoteObject, objectPrefix: string): WalletCardSnapshot {
  const idSuffix = object.id.split(objectPrefix).pop() ?? object.id;
  return {
    personId: 0,
    cardId: idSuffix,
    fullName: object.header?.defaultValue?.value ?? "-",
    associateCode: object.barcode?.alternateText ?? moduleBody(object, "associate_code") ?? "-",
    membershipType: object.subheader?.defaultValue?.value ?? moduleBody(object, "membership_type") ?? "-",
    membershipStatus: moduleBody(object, "membership_status") ?? "Vigente",
    issuedAt: moduleBody(object, "issued_at") ?? "-",
    verificationUrl: object.barcode?.value ?? "",
    revoked: object.state === "INACTIVE",
  };
}

function pickVisual(source: Record<string, unknown>): Partial<Record<VisualField, unknown>> {
  const visual: Partial<Record<VisualField, unknown>> = {};
  for (const field of VISUAL_FIELDS) {
    if (source[field] !== undefined) visual[field] = source[field];
  }
  return visual;
}

function localizedValue(field: unknown): string | undefined {
  return (field as LocalizedValue | undefined)?.defaultValue?.value;
}

function imageUri(field: unknown): string | undefined {
  return (field as RemoteImage | undefined)?.sourceUri?.uri;
}

async function checkAsset(url: string | null, label: string): Promise<boolean> {
  if (!url) {
    console.error(`ASSET ${label}: FAIL (origen no HTTPS)`);
    return false;
  }
  let response = await fetch(url, { method: "HEAD", signal: AbortSignal.timeout(12_000) }).catch(() => null);
  if (!response || response.status === 405 || response.status === 501) {
    response = await fetch(url, {
      method: "GET",
      headers: { range: "bytes=0-0" },
      signal: AbortSignal.timeout(12_000),
    }).catch(() => null);
  }
  if (!response || !response.ok) {
    console.error(`ASSET ${label}: FAIL HTTP ${response?.status ?? "network"}`);
    return false;
  }
  const contentType = (response.headers.get("content-type") ?? "").toLowerCase();
  if (!contentType.startsWith("image/png")) {
    console.error(`ASSET ${label}: FAIL content-type ${contentType || "unknown"}`);
    return false;
  }
  console.info(`ASSET ${label}: OK`);
  return true;
}

export async function runGoogleWalletRefine(): Promise<number> {
  const config = getWalletConfig();
  if (!config.flags.googleEnabled) {
    console.error("Google Wallet feature flag: DISABLED");
    return 1;
  }
  if (config.modes.google !== "REAL") {
    console.error("Google Wallet configuration: SIMULATION (se esperaba REAL)");
    return 1;
  }
  const google = config.google;
  if (!google) {
    console.error("Google Wallet configuration: INCOMPLETE");
    return 1;
  }

  const variantArg = (argValue("--variant") ?? "champagne").toLowerCase();
  const validVariants: readonly WalletBrandVariant[] = ["champagne", "soft-gold", "ivory", "gold"];
  if (!validVariants.includes(variantArg as WalletBrandVariant)) {
    console.error(`Variante no válida: ${variantArg}. Use champagne, soft-gold, ivory o gold.`);
    return 1;
  }
  const variant = variantArg as WalletBrandVariant;
  const allowLocal = hasFlag("--allow-local");
  const printLink = hasFlag("--print-link");

  const looksLocal = google.classId.endsWith("_local") || google.objectPrefix === "iimp_card_";
  if (looksLocal && !allowLocal) {
    console.error(
      "ABORT: el destino parece LOCAL. Esta tarea solo modifica QA. Use --allow-local solo con autorización explícita.",
    );
    return 1;
  }
  if (!config.appBaseUrl.startsWith("https://")) {
    console.error(
      "ABORT: appBaseUrl no es HTTPS; el builder omitiría los PNG y el PATCH borraría los recursos. Configure el origen HTTPS de QA.",
    );
    return 1;
  }

  const brand = buildWalletBrand(variant);
  const assets = {
    logo: resolveWalletAsset(config.appBaseUrl, brand.assets.logo),
    wideLogo: resolveWalletAsset(config.appBaseUrl, brand.assets.wideLogo),
    hero: resolveWalletAsset(config.appBaseUrl, brand.assets.hero),
  };
  const assetsOk = (
    await Promise.all([
      checkAsset(assets.logo, "logo"),
      checkAsset(assets.wideLogo, "wideLogo"),
      checkAsset(assets.hero, "heroImage"),
    ])
  ).every(Boolean);
  if (!assetsOk) {
    console.error("ABORT: recursos no accesibles por HTTPS. No se modifica ningún objeto.");
    return 1;
  }

  const client = new GoogleWalletClient(google, config.appBaseUrl);
  const targetId = argValue("--object");
  let targets: RemoteObject[];
  if (targetId) {
    const single = await client.getObjectJson(targetId);
    if (single.status !== 200 || !single.body) {
      console.error(`GET ${targetId}: FAIL HTTP ${single.status}`);
      return 1;
    }
    targets = [single.body as RemoteObject];
  } else {
    const listed = await client.listObjects(50);
    if (listed.status !== 200 || !listed.body) {
      console.error(`Object list failed: HTTP ${listed.status}`);
      return 1;
    }
    targets = ((listed.body as { resources?: RemoteObject[] }).resources ?? []).filter(
      (object) => typeof object.id === "string" && object.id.length > 0,
    );
  }
  if (targets.length === 0) {
    console.error("No hay objetos en la clase configurada. No se crea ningún objeto.");
    return 1;
  }

  const backupDir = join(tmpdir(), "afiliaciones-wallet-refine");
  mkdirSync(backupDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const expectedPrefix = `${google.issuerId}.${google.objectPrefix}`;
  let failures = 0;
  let skipped = 0;

  for (const before of targets) {
    // Objetos de diagnóstico/legado de la misma clase pero fuera del namespace
    // del ambiente no se tocan: protege contra cambios cruzados.
    if (!before.id.startsWith(expectedPrefix)) {
      console.info(`SKIP ${before.id}: fuera del namespace ${expectedPrefix} (no se modifica)`);
      skipped += 1;
      continue;
    }
    const objectId = before.id;
    const safeId = objectId.replace(/[^a-zA-Z0-9._-]/g, "_");
    const backupFile = join(backupDir, `${safeId}-visual-backup-${stamp}.json`);
    writeFileSync(
      backupFile,
      JSON.stringify({ variant, brandVersion: brand.version, object: before }, null, 2),
      "utf8",
    );

    const snapshot = snapshotFrom(before, google.objectPrefix);
    const payload = buildGenericObjectPayload({
      config: google,
      snapshot,
      appBaseUrl: config.appBaseUrl,
      brand,
    });
    const visual = pickVisual(payload as unknown as Record<string, unknown>);

    const patched = await client.patchObject(objectId, visual as Record<string, unknown>);
    if (!patched.ok) {
      console.error(`PATCH ${objectId}: FAIL HTTP ${patched.status}`);
      failures += 1;
      continue;
    }

    const after = await client.getObjectJson(objectId);
    if (after.status !== 200 || !after.body) {
      console.error(`GET ${objectId}: FAIL HTTP ${after.status}`);
      failures += 1;
      continue;
    }
    const remote = after.body as RemoteObject;
    const checks: Array<[string, boolean]> = [
      ["cardTitle", localizedValue(remote.cardTitle) === brand.cardTitle],
      ["header", localizedValue(remote.header) === snapshot.fullName],
      ["subheader", localizedValue(remote.subheader) === snapshot.membershipType],
      ["hexBackgroundColor", (remote.hexBackgroundColor ?? "").toUpperCase() === brand.palette.background.toUpperCase()],
      ["logo", imageUri(remote.logo) === imageUri(visual.logo)],
      ["wideLogo", imageUri(remote.wideLogo) === imageUri(visual.wideLogo)],
      ["heroImage", imageUri(remote.heroImage) === imageUri(visual.heroImage)],
    ];
    const failed = checks.filter(([, ok]) => !ok).map(([name]) => name);
    if (failed.length > 0) {
      console.error(`VERIFY ${objectId}: FAIL (${failed.join(", ")}) | backup ${backupFile}`);
      failures += 1;
      continue;
    }

    const link = client.buildSaveLink(objectId);
    const linkFile = join(backupDir, `${safeId}-save-link-${stamp}.txt`);
    writeFileSync(linkFile, link.link, "utf8");
    console.info(`UPDATED ${objectId} | variant=${variant} | verified=${checks.length}/${checks.length}`);
    console.info(`BACKUP ${backupFile}`);
    if (printLink) console.info(`SAVE_LINK ${link.link}`);
    else console.info(`SAVE_LINK_FILE ${linkFile}`);
  }

  console.info(
    `Objects refined: ${targets.length - failures - skipped}/${targets.length} (skipped=${skipped}, failed=${failures})`,
  );
  return failures === 0 ? 0 : 1;
}

if (process.argv[1] && process.argv[1].includes("wallet-google-refine-preview")) {
  void runGoogleWalletRefine()
    .then((code) => {
      process.exitCode = code;
    })
    .catch((error: unknown) => {
      console.error("Refine preview failed:", error instanceof Error ? error.message : "UnknownError");
      process.exitCode = 1;
    });
}
