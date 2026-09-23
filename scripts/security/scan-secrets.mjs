import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = process.cwd();
const excludedDirectories = new Set([".git", ".next", ".agents", ".codex", "node_modules", "coverage", "dist", "build"]);
const excludedFiles = new Set([".env"]);
const scannedExtensions = new Set([".ts", ".tsx", ".js", ".mjs", ".json", ".md", ".yml", ".yaml", ".prisma"]);

/**
 * Allowlist estricta para fixtures explícitamente falsos.
 *
 * Solo se aplica al patrón `hardcoded-secret` y se evalúa contra el literal
 * detectado (nunca contra el resto de la línea, para que un comentario no
 * silencie un secreto real). El valor debe comenzar por uno de estos marcadores
 * seguido de `-`, `_` o el final: `test-endorsement-secret` es dummy, mientras
 * que `testingProdKey1234` NO lo es.
 *
 * Las claves privadas, las access keys de AWS y las URLs con credenciales no se
 * silencian por convención de nombre: son hallazgos estructurales.
 */
export const DUMMY_LITERAL_PATTERN =
  /^(?:dummy|example|fake|placeholder|sample|test|changeme|replace_me|your_|not-a-real|redacted)(?:[-_]|$)/i;

export const secretPatterns = [
  { name: "private-key", expression: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
  { name: "aws-access-key", expression: /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/ },
  { name: "credentialed-database-url", expression: /\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?):\/\/[^\s:@/]+:[^\s@/]+@/i },
  {
    name: "hardcoded-secret",
    expression: /\b(?:api[_-]?key|access[_-]?token|password|secret|token)\b\s*[:=]\s*["']([^"'\s${}]{16,})["']/i,
    allowDummyLiteral: true,
  },
];

export function isDummyLiteral(value) {
  return DUMMY_LITERAL_PATTERN.test(value);
}

export function scanLine(line) {
  const findings = [];
  for (const pattern of secretPatterns) {
    const match = pattern.expression.exec(line);
    if (!match) continue;
    if (pattern.allowDummyLiteral && match[1] && isDummyLiteral(match[1])) continue;
    findings.push(pattern.name);
  }
  return findings;
}

export function scanContent(content, relativePath = "<memory>") {
  const findings = [];
  content.split(/\r?\n/).forEach((line, index) => {
    for (const name of scanLine(line)) findings.push(`${relativePath}:${index + 1} [${name}]`);
  });
  return findings;
}

async function filesUnder(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (!excludedDirectories.has(entry.name)) files.push(...await filesUnder(path.join(directory, entry.name)));
      continue;
    }
    if (excludedFiles.has(entry.name)) continue;
    if (scannedExtensions.has(path.extname(entry.name)) || entry.name === ".env.example") files.push(path.join(directory, entry.name));
  }
  return files;
}

export async function scanForSecrets(baseDirectory = root) {
  const findings = [];
  for (const file of await filesUnder(baseDirectory)) {
    const relative = path.relative(baseDirectory, file).replaceAll("\\", "/");
    if (relative === "scripts/security/scan-secrets.mjs") continue;
    findings.push(...scanContent(await readFile(file, "utf8"), relative));
  }
  return findings;
}

async function main() {
  const findings = await scanForSecrets();
  if (findings.length) {
    console.error("Posibles secretos detectados:\n" + findings.join("\n"));
    process.exitCode = 1;
  } else {
    console.info("Escaneo local de secretos: sin coincidencias de alta confianza.");
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
