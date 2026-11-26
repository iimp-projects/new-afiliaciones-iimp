import "dotenv/config";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import JSZip from "jszip";
import { getAppleWalletConfig } from "@/lib/config/wallet";
import { ApplePassBuilder, loadApplePassAssets } from "@/modules/afiliaciones/carnet/wallet/Apple/ApplePassBuilder";
import { OpenSslPassSigner } from "@/modules/afiliaciones/carnet/wallet/Apple/OpenSslPassSigner";
import type { WalletCardSnapshot } from "@/modules/afiliaciones/carnet/wallet/Types/wallet";

/**
 * Genera un `.pkpass` de PRUEBA con datos sintéticos (sin PII) usando los
 * certificados institucionales. Pensado para la primera instalación manual en
 * un iPhone. No contacta Apple, no envía APNs y no toca la base de datos.
 *
 * Uso:
 *   npx tsx scripts/wallet-apple-generate-static-pass.ts
 *   npx tsx scripts/wallet-apple-generate-static-pass.ts --out .tmp/apple-wallet
 *
 * Requiere APPLE_WALLET_PASS_KEY_PASSPHRASE configurada manualmente si la key
 * está cifrada. La passphrase nunca se imprime ni se pasa por argumentos.
 */

const TEST_SERIAL = "iimp-local-static-test-0001";

const SYNTHETIC_SNAPSHOT: WalletCardSnapshot = {
  personId: 0,
  cardId: "local-static-test",
  fullName: "Asociado de Prueba",
  associateCode: "TEST-0001",
  membershipType: "Asociado Activo (Prueba)",
  membershipStatus: "Vigente (Prueba)",
  issuedAt: "01/01/2026",
  verificationUrl: "https://www.iimp.org.pe/verificar-carnet/TEST-SYNTHETIC-0001",
  revoked: false,
};

function argValue(flag: string): string | null {
  const index = process.argv.indexOf(flag);
  if (index === -1) return null;
  const value = process.argv[index + 1];
  return value && !value.startsWith("--") ? value : null;
}

function fail(message: string): never {
  console.error(`[apple-static-pass] ${message}`);
  process.exit(1);
}

export async function run(): Promise<number> {
  const config = getAppleWalletConfig();
  if (!config) fail("Apple Wallet no está configurado (revisa APPLE_WALLET_* y las credenciales).");
  if (!config.updatesEnabled && config.webServiceUrl) {
    fail("Configuración inconsistente: actualizaciones deshabilitadas pero con webServiceUrl.");
  }
  if (config.updatesEnabled) {
    fail("Este script emite un pase estático. Define APPLE_WALLET_UPDATES_ENABLED=false para la prueba LOCAL.");
  }
  if (config.privateKeyPem.includes("ENCRYPTED PRIVATE KEY") && !config.keyPassphrase) {
    fail("La clave privada está cifrada. Define APPLE_WALLET_PASS_KEY_PASSPHRASE manualmente (no se solicita por chat).");
  }

  const outputDir = path.resolve(argValue("--out") ?? path.join(".tmp", "apple-wallet"));
  await mkdir(outputDir, { recursive: true });

  const builder = new ApplePassBuilder(
    new OpenSslPassSigner(config),
    () => loadApplePassAssets(),
  );
  const buffer = await builder.build({
    serialNumber: TEST_SERIAL,
    authenticationToken: "",
    snapshot: SYNTHETIC_SNAPSHOT,
    config,
  });

  const fileName = "carne-virtual-iimp-local-static-test.pkpass";
  const outputPath = path.join(outputDir, fileName);
  await writeFile(outputPath, buffer);

  const zip = await JSZip.loadAsync(buffer);
  const required = ["pass.json", "manifest.json", "signature", "icon.png", "icon@2x.png", "icon@3x.png", "logo.png", "logo@2x.png"];
  const missing = required.filter((name) => !zip.file(name));
  if (missing.length > 0) fail(`El pase generado no contiene: ${missing.join(", ")}`);

  const pass = JSON.parse(await zip.file("pass.json")!.async("string"));
  if (pass.webServiceURL !== undefined || pass.authenticationToken !== undefined) {
    fail("El pase estático no debe incluir webServiceURL ni authenticationToken.");
  }
  if (pass.passTypeIdentifier !== config.passTypeIdentifier) fail("passTypeIdentifier no coincide con la configuración.");
  if (pass.teamIdentifier !== config.teamIdentifier) fail("teamIdentifier no coincide con la configuración.");

  console.info("[apple-static-pass] PASE SINTÉTICO DE PRUEBA generado.");
  console.info(`[apple-static-pass] Ruta: ${outputPath}`);
  console.info(`[apple-static-pass] serialNumber: ${TEST_SERIAL}`);
  console.info(`[apple-static-pass] passTypeIdentifier: ${config.passTypeIdentifier}`);
  console.info(`[apple-static-pass] teamIdentifier: ${config.teamIdentifier}`);
  console.info("[apple-static-pass] Instala manualmente en iPhone (AirDrop/Correo). No se declara funcional hasta verificar en dispositivo.");
  return 0;
}

if (process.argv[1] && process.argv[1].replace(/\\/g, "/").endsWith("wallet-apple-generate-static-pass.ts")) {
  run().then((code) => process.exit(code)).catch((error) => {
    console.error(`[apple-static-pass] Error: ${(error as Error).message}`);
    process.exit(1);
  });
}
