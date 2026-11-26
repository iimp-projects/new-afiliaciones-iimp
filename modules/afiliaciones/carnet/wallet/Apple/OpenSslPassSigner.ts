import { execFile } from "node:child_process";
import { constants } from "node:fs";
import { access, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { WalletError } from "../Types/wallet";
import type { PassManifestSigner } from "./ApplePassBuilder";

const execFileAsync = promisify(execFile);

/** Nombre de la variable de entorno efímera con la que OpenSSL recibe la passphrase. */
export const PASSPHRASE_ENV_VAR = "IIMP_APPLE_PASS_KEY_PASSPHRASE";

/** Variables mínimas necesarias para ejecutar un proceso hijo sin filtrar secretos. */
const ALLOWED_ENV_KEYS = [
  "PATH",
  "Path",
  "SystemRoot",
  "SYSTEMROOT",
  "windir",
  "WINDIR",
  "TEMP",
  "TMP",
  "TMPDIR",
  "PATHEXT",
  "ComSpec",
  "COMSPEC",
  "HOME",
  "USERPROFILE",
  "LANG",
  "LC_ALL",
] as const;

export interface OpenSslPassSignerInput {
  readonly certificatePem: string;
  readonly privateKeyPem: string;
  readonly wwdrCertificatePem: string;
  readonly keyPassphrase?: string | null;
  readonly opensslPath?: string | null;
  readonly timeoutMs?: number;
}

export interface OpenSslSignArgsInput {
  readonly manifestPath: string;
  readonly certificatePath: string;
  readonly keyPath: string;
  readonly wwdrPath: string;
  readonly signaturePath: string;
  readonly hasPassphrase: boolean;
}

/**
 * Construye el entorno del proceso hijo con una allowlist mínima. Evita heredar
 * variables sensibles del servidor. La passphrase viaja solo por entorno del
 * proceso hijo, nunca por argumentos ni por shell.
 */
export function buildSignerEnv(
  source: Readonly<Record<string, string | undefined>>,
  passphrase: string | null,
): Record<string, string> {
  const env: Record<string, string> = {};
  for (const key of ALLOWED_ENV_KEYS) {
    const value = source[key];
    if (typeof value === "string" && value.length > 0) env[key] = value;
  }
  if (passphrase) env[PASSPHRASE_ENV_VAR] = passphrase;
  return env;
}

/** Args de `openssl smime`. La passphrase nunca se incluye aquí. */
export function buildOpenSslSignArgs(input: OpenSslSignArgsInput): string[] {
  const args = [
    "smime",
    "-binary",
    "-sign",
    "-certfile",
    input.wwdrPath,
    "-signer",
    input.certificatePath,
    "-inkey",
    input.keyPath,
  ];
  if (input.hasPassphrase) args.push("-passin", `env:${PASSPHRASE_ENV_VAR}`);
  args.push("-in", input.manifestPath, "-outform", "DER", "-out", input.signaturePath);
  return args;
}

function isExplicitPath(value: string): boolean {
  return /[\\/]/.test(value) || /^[A-Za-z]:/.test(value);
}

/**
 * Traduce el error del proceso OpenSSL a un error de wallet sanitizado. Nunca
 * propaga stderr ni la línea de comandos (pueden contener rutas o detalles).
 */
export function classifyOpenSslSignerError(error: unknown): WalletError {
  const candidate = error as { code?: unknown; killed?: unknown; signal?: unknown; name?: unknown };
  if (candidate?.code === "ENOENT") {
    return new WalletError("PROVIDER_NOT_CONFIGURED", "La firma de Apple Wallet no está disponible en este entorno.");
  }
  if (
    candidate?.killed === true ||
    candidate?.signal === "SIGTERM" ||
    candidate?.signal === "SIGKILL" ||
    candidate?.name === "TimeoutError"
  ) {
    return new WalletError("PROVIDER_ERROR", "La firma de Apple Wallet excedió el tiempo de espera.");
  }
  return new WalletError("PROVIDER_ERROR", "No pudimos generar el pase de Apple Wallet.");
}

/**
 * Firma PKCS#7 detached del manifest PassKit usando el binario `openssl`.
 *
 * - Ejecuta sin shell y con entorno mínimo (solo lo necesario para el proceso).
 * - Soporta claves PKCS#8 cifradas mediante `-passin env:<VAR>`.
 * - Aísla cada firma en un directorio temporal con permisos 0600 y lo limpia
 *   incluso ante error.
 */
export class OpenSslPassSigner implements PassManifestSigner {
  private readonly opensslPath: string;
  private readonly passphrase: string | null;
  private readonly timeoutMs: number;

  constructor(private readonly input: OpenSslPassSignerInput) {
    this.opensslPath = input.opensslPath?.trim() || "openssl";
    this.passphrase = input.keyPassphrase && input.keyPassphrase.length > 0
      ? input.keyPassphrase
      : null;
    this.timeoutMs = input.timeoutMs ?? 20_000;
  }

  async sign(manifest: Buffer): Promise<Buffer> {
    const directory = await mkdtemp(path.join(tmpdir(), "iimp-pass-"));
    try {
      const manifestPath = path.join(directory, "manifest.json");
      const certificatePath = path.join(directory, "pass.crt");
      const keyPath = path.join(directory, "pass.key");
      const wwdrPath = path.join(directory, "wwdr.crt");
      const signaturePath = path.join(directory, "signature");

      await Promise.all([
        writeFile(manifestPath, manifest, { mode: 0o600 }),
        writeFile(certificatePath, this.input.certificatePem, { mode: 0o600 }),
        writeFile(keyPath, this.input.privateKeyPem, { mode: 0o600 }),
        writeFile(wwdrPath, this.input.wwdrCertificatePem, { mode: 0o600 }),
      ]);

      if (isExplicitPath(this.opensslPath)) {
        try {
          await access(this.opensslPath, constants.F_OK);
        } catch {
          throw new WalletError("PROVIDER_NOT_CONFIGURED", "El ejecutable de OpenSSL configurado no está disponible.");
        }
      }

      const args = buildOpenSslSignArgs({
        manifestPath,
        certificatePath,
        keyPath,
        wwdrPath,
        signaturePath,
        hasPassphrase: this.passphrase !== null,
      });

      try {
        await execFileAsync(this.opensslPath, args, {
          timeout: this.timeoutMs,
          windowsHide: true,
          env: buildSignerEnv(process.env, this.passphrase) as NodeJS.ProcessEnv,
          maxBuffer: 1024 * 1024,
        });
      } catch (error) {
        throw classifyOpenSslSignerError(error);
      }

      return await readFile(signaturePath);
    } finally {
      // En Windows el proceso puede mantener el handle unos instantes tras el
      // timeout; reintentamos para no dejar material sensible en el temporal.
      await rm(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }).catch(() => undefined);
    }
  }
}
