import { execFile } from "node:child_process";
import { readFile, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { WalletError } from "../Types/wallet";
import type { PassManifestSigner } from "./ApplePassBuilder";

const execFileAsync = promisify(execFile);

export interface OpenSslPassSignerInput {
  readonly certificatePem: string;
  readonly privateKeyPem: string;
  readonly wwdrCertificatePem: string;
  readonly opensslPath?: string;
}

/**
 * Firma PKCS#7 detached del manifest PassKit usando el binario `openssl`
 * disponible en la imagen de producción. En entornos sin openssl la emisión
 * responde con un error controlado; nunca se registra material del certificado.
 */
export class OpenSslPassSigner implements PassManifestSigner {
  private readonly opensslPath: string;

  constructor(private readonly input: OpenSslPassSignerInput) {
    this.opensslPath = input.opensslPath ?? "openssl";
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

      await execFileAsync(
        this.opensslPath,
        [
          "smime",
          "-binary",
          "-sign",
          "-certfile",
          wwdrPath,
          "-signer",
          certificatePath,
          "-inkey",
          keyPath,
          "-in",
          manifestPath,
          "-outform",
          "DER",
          "-out",
          signaturePath,
        ],
        { timeout: 20_000, windowsHide: true },
      );

      return await readFile(signaturePath);
    } catch (error) {
      const code = (error as { code?: unknown }).code;
      if (code === "ENOENT") {
        throw new WalletError("PROVIDER_NOT_CONFIGURED", "La firma de Apple Wallet no está disponible en este entorno.");
      }
      throw new WalletError("PROVIDER_ERROR", "No pudimos generar el pase de Apple Wallet.", { cause: error });
    } finally {
      await rm(directory, { recursive: true, force: true }).catch(() => undefined);
    }
  }
}
