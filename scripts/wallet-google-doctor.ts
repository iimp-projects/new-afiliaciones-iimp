import "dotenv/config";
import { getWalletConfig } from "@/lib/config/wallet";
import { GoogleWalletClient } from "@/modules/afiliaciones/carnet/wallet/Google/GoogleWalletClient";

/**
 * Diagnóstico sanitizado de Google Wallet. Nunca imprime access tokens, JWT,
 * claves privadas ni el JSON de credenciales. `--create` garantiza la clase
 * local de forma idempotente (consulta y, si falta, la crea).
 */
export async function runGoogleWalletDoctor(createClass = false, objectId?: string): Promise<number> {
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
    console.error("Google Wallet configuration: INCOMPLETE (credenciales o issuer/class ausentes)");
    return 1;
  }

  console.info("Google Wallet configuration: OK");
  console.info("Service account credentials: OK");
  console.info(`Issuer ID: ${config.google.issuerId}`);
  console.info(`Class ID: ${config.google.classId}`);

  const client = new GoogleWalletClient(config.google, config.appBaseUrl);
  const result = await client.doctor({ createClass });

  console.info(`OAuth authentication: ${result.auth}`);
  console.info(`Google Wallet API connectivity: ${result.api}`);
  console.info(`Issuer access: ${result.issuerAccess}`);
  console.info(`Class exists: ${result.classExists}`);
  if (result.classOperation) console.info(`Class operation: ${result.classOperation}`);
  if (result.classCreateError) {
    console.info(`Class create result: FAILED (${result.classCreateError.status ?? "sin estado"}) ${result.classCreateError.message ?? ""}`.trim());
  }
  console.info(`Object query: ${result.objectQuery}`);
  if (result.objectCount !== undefined) console.info(`Objects in class: ${result.objectCount}`);
  if (result.status !== undefined) console.info(`Last HTTP status: ${result.status}`);

  if (objectId) {
    const inspected = await client.inspectObject(objectId);
    console.info(`Object found: ${inspected.found ? "YES" : "NO"}`);
    if (inspected.found) {
      console.info(`Object state: ${inspected.state ?? "UNKNOWN"}`);
      console.info(`Object class matches: ${inspected.classId === config.google.classId ? "OK" : "MISMATCH"}`);
      console.info(`Object barcode: ${inspected.hasBarcode ? "PRESENT" : "MISSING"}`);
      console.info(`Object text modules: ${inspected.textModules ?? 0}`);
    } else if (inspected.status !== undefined) {
      console.info(`Object HTTP status: ${inspected.status}`);
    }
  }

  const ok = result.auth === "OK" && result.api === "OK" && result.issuerAccess === "OK" && result.objectQuery === "OK";
  return ok ? 0 : 1;
}

if (process.argv[1] && process.argv[1].includes("wallet-google-doctor")) {
  const createClass = process.argv.includes("--create");
  const objectArgIndex = process.argv.indexOf("--object");
  const objectId = objectArgIndex >= 0 ? process.argv[objectArgIndex + 1] : undefined;
  void runGoogleWalletDoctor(createClass, objectId)
    .then((code) => {
      process.exitCode = code;
    })
    .catch((error: unknown) => {
      console.error("Google Wallet doctor failed:", error instanceof Error ? error.name : "UnknownError");
      process.exitCode = 1;
    });
}
