import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getWalletConfig } from "@/lib/config/wallet";
import { GoogleWalletClient } from "@/modules/afiliaciones/carnet/wallet/Google/GoogleWalletClient";

/**
 * Aplica el branding premium (plantillas/colores) a la GenericClass de QA.
 * Guarda un respaldo del JSON remoto antes de modificarlo. No imprime secretos.
 * Los objetos se actualizan con el mismo builder al sincronizarse/emitirse.
 */
export async function runGoogleWalletBranding(): Promise<number> {
  const config = getWalletConfig();
  if (!config.flags.googleEnabled) {
    console.error("Google Wallet feature flag: DISABLED");
    return 1;
  }
  if (config.modes.google !== "REAL") {
    console.error("Google Wallet configuration: SIMULATION (se esperaba REAL)");
    return 1;
  }
  if (!config.google) {
    console.error("Google Wallet configuration: INCOMPLETE");
    return 1;
  }

  const client = new GoogleWalletClient(config.google, config.appBaseUrl);
  const before = await client.getClassJson();
  if (before.body) {
    const dir = join(tmpdir(), "afiliaciones-wallet-branding");
    mkdirSync(dir, { recursive: true });
    const file = join(dir, `${config.google.classId.replace(/[^a-zA-Z0-9._-]/g, "_")}-backup-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
    writeFileSync(file, JSON.stringify(before.body, null, 2), "utf8");
    console.info(`Class backup: ${file}`);
  }

  const result = await client.applyClassBranding();
  console.info(`Class branding: ${result.operation} (HTTP ${result.status})`);
  console.info(`Class ID: ${config.google.classId}`);
  return 0;
}

if (process.argv[1] && process.argv[1].includes("wallet-google-branding")) {
  void runGoogleWalletBranding()
    .then((code) => {
      process.exitCode = code;
    })
    .catch((error: unknown) => {
      console.error("Google Wallet branding failed:", error instanceof Error ? error.message : "UnknownError");
      process.exitCode = 1;
    });
}
