import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  copyFileSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import JSZip from "jszip";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { AppleWalletConfig } from "@/lib/config/wallet";
import { ApplePassBuilder, loadApplePassAssets } from "../Apple/ApplePassBuilder";
import {
  OpenSslPassSigner,
  PASSPHRASE_ENV_VAR,
  buildOpenSslSignArgs,
  buildSignerEnv,
  classifyOpenSslSignerError,
} from "../Apple/OpenSslPassSigner";
import type { WalletCardSnapshot } from "../Types/wallet";

const TEST_KEY_PASSPHRASE = "test-passphrase-123";
const WRONG_KEY_PASSPHRASE = "wrong-passphrase-456";
const WwdrFixture = readFileSync("modules/afiliaciones/carnet/wallet/Tests/fixtures/wwdr-cert.pem", "utf8");

function resolveOpenSsl(): string | null {
  const candidates = [
    process.env.APPLE_WALLET_OPENSSL_PATH,
    "C:/Program Files/Git/usr/bin/openssl.exe",
    "C:/xampp/apache/bin/openssl.exe",
    "openssl",
  ].filter((entry): entry is string => Boolean(entry));
  for (const candidate of candidates) {
    try {
      execFileSync(candidate, ["version"], { stdio: "ignore", timeout: 5000 });
      return candidate;
    } catch {
      // siguiente candidato
    }
  }
  return null;
}

const openSsl = resolveOpenSsl();
const suite = openSsl ? describe : describe.skip;

let workDir = "";
let certPem = "";
let plainKeyPem = "";
let encryptedKeyPem = "";
let spacedOpenSsl: string | null = null;

function countTempPassDirs(): number {
  return readdirSync(tmpdir(), { withFileTypes: true }).filter(
    (entry) => entry.isDirectory() && entry.name.startsWith("iimp-pass-"),
  ).length;
}

beforeAll(() => {
  if (!openSsl) return;
  workDir = mkdtempSync(path.join(tmpdir(), "iimp-signer-fixture-"));
  const plainKeyPath = path.join(workDir, "plain.key");
  const certPath = path.join(workDir, "cert.pem");
  const encryptedKeyPath = path.join(workDir, "encrypted.key");
  const genPassEnv = "IIMP_TEST_GEN_PASSPHRASE";

  execFileSync(
    openSsl,
    [
      "req", "-x509", "-newkey", "rsa:2048", "-keyout", plainKeyPath, "-out", certPath,
      "-days", "2", "-nodes", "-sha256", "-subj", "/CN=IIMP Signer Test",
      "-addext", "basicConstraints=critical,CA:TRUE",
    ],
    { stdio: "ignore", timeout: 60_000 },
  );
  execFileSync(
    openSsl,
    ["pkcs8", "-topk8", "-in", plainKeyPath, "-out", encryptedKeyPath, "-v2", "aes-256-cbc", "-passout", `env:${genPassEnv}`],
    { stdio: "ignore", timeout: 60_000, env: { ...process.env, [genPassEnv]: TEST_KEY_PASSPHRASE } },
  );

  certPem = readFileSync(certPath, "utf8");
  plainKeyPem = readFileSync(plainKeyPath, "utf8");
  encryptedKeyPem = readFileSync(encryptedKeyPath, "utf8");

  // Ejercita una ruta con espacios. Si el binario real ya contiene espacios
  // (p. ej. "Program Files" en Windows) se usa directamente; si no, se crea un
  // symlink/copia en un directorio con espacio.
  if (openSsl.includes(" ")) {
    spacedOpenSsl = openSsl;
  } else {
    try {
      const spacedDir = mkdtempSync(path.join(tmpdir(), "iimp space-"));
      const spacedTarget = path.join(spacedDir, process.platform === "win32" ? "openssl.exe" : "openssl");
      if (process.platform === "win32") copyFileSync(openSsl, spacedTarget);
      else symlinkSync(openSsl, spacedTarget);
      execFileSync(spacedTarget, ["version"], { stdio: "ignore", timeout: 5000 });
      spacedOpenSsl = spacedTarget;
    } catch {
      spacedOpenSsl = null;
    }
  }
});

afterAll(() => {
  if (workDir) rmSync(workDir, { recursive: true, force: true });
});

function signer(overrides: { key?: string; passphrase?: string | null; opensslPath?: string; timeoutMs?: number } = {}) {
  return new OpenSslPassSigner({
    certificatePem: certPem,
    privateKeyPem: overrides.key ?? encryptedKeyPem,
    wwdrCertificatePem: WwdrFixture,
    keyPassphrase: overrides.passphrase === undefined ? TEST_KEY_PASSPHRASE : overrides.passphrase,
    opensslPath: overrides.opensslPath ?? openSsl ?? "openssl",
    timeoutMs: overrides.timeoutMs,
  });
}

suite("OpenSslPassSigner", () => {
  it("firma con la passphrase correcta e incluye el certificado intermedio", async () => {
    const manifest = Buffer.from(JSON.stringify({ "pass.json": "abc" }), "utf8");
    const signature = await signer().sign(manifest);
    expect(signature.length).toBeGreaterThan(0);

    const sigPath = path.join(workDir, "signature.der");
    writeFileSync(sigPath, signature);
    const certs = execFileSync(openSsl!, ["pkcs7", "-inform", "DER", "-in", sigPath, "-print_certs", "-noout"], {
      encoding: "utf8",
      timeout: 20_000,
    });
    expect(certs).toContain("IIMP Signer Test");
    expect(certs).toContain("WWDR Test");

    const manifestPath = path.join(workDir, "manifest.json");
    const certPath = path.join(workDir, "verify-cert.pem");
    writeFileSync(manifestPath, manifest);
    writeFileSync(certPath, certPem);
    const verify = spawnSync(
      openSsl!,
      ["smime", "-verify", "-inform", "DER", "-in", sigPath, "-content", manifestPath, "-CAfile", certPath, "-purpose", "any"],
      { encoding: "utf8", timeout: 20_000 },
    );
    expect(verify.status).toBe(0);
    expect(`${verify.stdout}${verify.stderr}`).toContain("Verification successful");
  });

  it("rechaza una passphrase incorrecta sin filtrar el secreto", async () => {
    const error = await signer({ passphrase: WRONG_KEY_PASSPHRASE }).sign(Buffer.from("{}")).catch((e) => e);
    expect(error?.code).toBe("PROVIDER_ERROR");
    expect(String(error?.message)).not.toContain(WRONG_KEY_PASSPHRASE);
    expect(String(error?.message)).not.toContain(TEST_KEY_PASSPHRASE);
  });

  it("rechaza una clave cifrada cuando no se proporciona passphrase", async () => {
    const error = await signer({ passphrase: null, timeoutMs: 4000 }).sign(Buffer.from("{}")).catch((e) => e);
    expect(error?.code).toBe("PROVIDER_ERROR");
  });

  it("mantiene compatibilidad con claves no cifradas", async () => {
    const signature = await signer({ key: plainKeyPem, passphrase: null }).sign(Buffer.from("{}"));
    expect(signature.length).toBeGreaterThan(0);
  });

  it("soporta rutas de OpenSSL con espacios", async () => {
    if (!spacedOpenSsl) return;
    const signature = await signer({ opensslPath: spacedOpenSsl }).sign(Buffer.from("{}"));
    expect(signature.length).toBeGreaterThan(0);
  });

  it("falla de forma controlada si OpenSSL no existe", async () => {
    const missing = path.join(workDir, "no-existe", "openssl.exe");
    const error = await signer({ opensslPath: missing }).sign(Buffer.from("{}")).catch((e) => e);
    expect(error?.code).toBe("PROVIDER_NOT_CONFIGURED");
  });

  it("limpia los directorios temporales incluso ante error", async () => {
    const before = countTempPassDirs();
    await signer({ passphrase: WRONG_KEY_PASSPHRASE }).sign(Buffer.from("{}")).catch(() => undefined);
    const after = countTempPassDirs();
    expect(after).toBeLessThanOrEqual(before);
  });

  it("construye args y entorno seguros (passphrase solo por env)", () => {
    const withPass = buildOpenSslSignArgs({
      manifestPath: "m",
      certificatePath: "c",
      keyPath: "k",
      wwdrPath: "w",
      signaturePath: "s",
      hasPassphrase: true,
    });
    expect(withPass).toContain("-passin");
    expect(withPass).toContain(`env:${PASSPHRASE_ENV_VAR}`);
    expect(withPass.join(" ")).not.toContain(TEST_KEY_PASSPHRASE);

    const withoutPass = buildOpenSslSignArgs({
      manifestPath: "m",
      certificatePath: "c",
      keyPath: "k",
      wwdrPath: "w",
      signaturePath: "s",
      hasPassphrase: false,
    });
    expect(withoutPass).not.toContain("-passin");

    const env = buildSignerEnv({ PATH: "/bin", SECRET_TOKEN: "no-debe-pasar" }, TEST_KEY_PASSPHRASE);
    expect(env[PASSPHRASE_ENV_VAR]).toBe(TEST_KEY_PASSPHRASE);
    expect(env.PATH).toBe("/bin");
    expect(env.SECRET_TOKEN).toBeUndefined();
  });

  it("clasifica timeout y binario ausente", () => {
    expect(classifyOpenSslSignerError({ killed: true, signal: "SIGTERM" }).code).toBe("PROVIDER_ERROR");
    expect(classifyOpenSslSignerError({ code: "ENOENT" }).code).toBe("PROVIDER_NOT_CONFIGURED");
  });

  it("emite un .pkpass estático completo con fixtures sintéticos", async () => {
    const config: AppleWalletConfig = {
      teamIdentifier: "3U46BQMK52",
      passTypeIdentifier: "pass.pe.org.iimp.membership.local",
      organizationName: "IIMP",
      updatesEnabled: false,
      webServiceUrl: null,
      certificatePem: certPem,
      privateKeyPem: encryptedKeyPem,
      wwdrCertificatePem: WwdrFixture,
      keyPassphrase: TEST_KEY_PASSPHRASE,
      opensslPath: openSsl!,
      authenticationSecret: "",
      authenticationSecretVersion: 1,
      previousAuthenticationSecret: null,
      previousAuthenticationSecretVersion: null,
      apns: null,
    };
    const snapshot: WalletCardSnapshot = {
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
    const builder = new ApplePassBuilder(new OpenSslPassSigner(config), () => loadApplePassAssets());
    const buffer = await builder.build({ serialNumber: "iimp-local-static-test-0001", authenticationToken: "", snapshot, config });

    const zip = await JSZip.loadAsync(buffer);
    const required = ["pass.json", "manifest.json", "signature", "icon.png", "icon@2x.png", "icon@3x.png", "logo.png", "logo@2x.png"];
    for (const name of required) expect(zip.file(name)).not.toBeNull();
    for (const forbidden of ["pass.key", "wwdr.crt", "pass.crt"]) expect(zip.file(forbidden)).toBeNull();

    const pass = JSON.parse(await zip.file("pass.json")!.async("string"));
    expect(pass.webServiceURL).toBeUndefined();
    expect(pass.authenticationToken).toBeUndefined();
    expect(pass.passTypeIdentifier).toBe(config.passTypeIdentifier);
    expect(pass.teamIdentifier).toBe(config.teamIdentifier);
    expect(pass.voided).toBeUndefined();

    const manifest = JSON.parse(await zip.file("manifest.json")!.async("string"));
    for (const name of ["pass.json", "icon.png", "logo.png"]) {
      const content = await zip.file(name)!.async("nodebuffer");
      expect(manifest[name]).toBe(createHash("sha1").update(content).digest("hex"));
    }
    expect((await zip.file("signature")!.async("nodebuffer")).length).toBeGreaterThan(0);
  }, 30_000);
});
