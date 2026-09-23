import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

/**
 * SECURITY_RUNTIME_GATE
 *
 * Analiza `npm audit --omit=dev --omit=optional --json` (el árbol realmente
 * desplegable) y bloquea CRITICAL/HIGH no exceptuados. Las excepciones se
 * identifican por advisory (GHSA) + paquete exactos en audit-exceptions.json.
 * Los MODERATE/LOW se reportan pero no bloquean. El audit completo del árbol
 * sigue disponible en `npm run security:dependencies`.
 */

export const DEFAULT_EXCEPTIONS_PATH = fileURLToPath(new URL("./audit-exceptions.json", import.meta.url));
export const RUNTIME_AUDIT_ARGS = ["audit", "--omit=dev", "--omit=optional", "--json"];
const BLOCKING_SEVERITIES = new Set(["critical", "high"]);
const ADVISORY_ID_PATTERN = /GHSA-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}/i;
const REQUIRED_EXCEPTION_FIELDS = ["advisory", "package", "affectedVersion", "reason", "classification", "owner", "createdAt", "expiresAt", "invalidatedBy"];

export function extractAdvisoryId(advisory) {
  if (!advisory || typeof advisory !== "object") return null;
  const url = typeof advisory.url === "string" ? advisory.url : "";
  const match = ADVISORY_ID_PATTERN.exec(url);
  return match ? match[0] : null;
}

function isValidDateString(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

function toDateString(now) {
  return new Date(now).toISOString().slice(0, 10);
}

/**
 * Resuelve todas las advisories del árbol. Un `via` string referencia a otro
 * paquete (propagación) y se resuelve recursivamente; un `via` objeto es una
 * advisory concreta. La identidad canónica es el GHSA extraído de `url`.
 */
export function resolveAdvisories(vulnerabilities) {
  const result = new Map();
  const visiting = new Set();

  function walk(packageName) {
    if (visiting.has(packageName)) return;
    const entry = vulnerabilities[packageName];
    if (!entry || !Array.isArray(entry.via)) return;
    visiting.add(packageName);
    for (const via of entry.via) {
      if (typeof via === "string") {
        walk(via);
        continue;
      }
      const advisoryId = extractAdvisoryId(via);
      const ownerPackage = typeof via.name === "string" ? via.name : packageName;
      const severity = typeof via.severity === "string" ? via.severity : (typeof entry.severity === "string" ? entry.severity : "unknown");
      const key = `${advisoryId ?? "UNIDENTIFIED"}::${ownerPackage}`;
      if (!result.has(key)) {
        result.set(key, { id: advisoryId, package: ownerPackage, severity, title: typeof via.title === "string" ? via.title : "", url: typeof via.url === "string" ? via.url : "" });
      }
    }
    visiting.delete(packageName);
  }

  for (const packageName of Object.keys(vulnerabilities)) walk(packageName);
  return [...result.values()];
}

export function validateExceptions(document) {
  const errors = [];
  if (!document || typeof document !== "object") return { valid: false, errors: ["El archivo de excepciones no es un objeto JSON."] };
  if (!Array.isArray(document.exceptions)) return { valid: false, errors: ["El archivo de excepciones no contiene el arreglo 'exceptions'."] };
  const seen = new Set();
  document.exceptions.forEach((exception, index) => {
    const label = `exceptions[${index}]`;
    if (!exception || typeof exception !== "object") {
      errors.push(`${label} no es un objeto.`);
      return;
    }
    for (const field of REQUIRED_EXCEPTION_FIELDS) {
      if (!(field in exception)) errors.push(`${label} no define '${field}'.`);
    }
    if (typeof exception.advisory !== "string" || !ADVISORY_ID_PATTERN.test(exception.advisory)) errors.push(`${label}.advisory no es un GHSA válido.`);
    if (typeof exception.package !== "string" || !exception.package) errors.push(`${label}.package inválido.`);
    if (!isValidDateString(exception.createdAt)) errors.push(`${label}.createdAt inválido.`);
    if (!isValidDateString(exception.expiresAt)) errors.push(`${label}.expiresAt inválido.`);
    if (!Array.isArray(exception.invalidatedBy) || exception.invalidatedBy.length === 0) errors.push(`${label}.invalidatedBy debe ser un arreglo no vacío.`);
    if (typeof exception.advisory === "string" && typeof exception.package === "string") {
      const key = `${exception.advisory}::${exception.package}`;
      if (seen.has(key)) errors.push(`${label} duplica la excepción ${key}.`);
      seen.add(key);
    }
  });
  return { valid: errors.length === 0, errors };
}

function emptyCounts() {
  return { info: 0, low: 0, moderate: 0, high: 0, critical: 0, total: 0 };
}

function computeCountsFromAdvisories(advisories) {
  const counts = emptyCounts();
  for (const advisory of advisories) {
    if (advisory.severity in counts) counts[advisory.severity] += 1;
  }
  counts.total = counts.info + counts.low + counts.moderate + counts.high + counts.critical;
  return counts;
}

function normalizeCounts(metadataCounts, advisories) {
  if (metadataCounts && typeof metadataCounts === "object" && typeof metadataCounts.total === "number") {
    return { ...emptyCounts(), ...metadataCounts };
  }
  return computeCountsFromAdvisories(advisories);
}

/**
 * Evalúa un reporte de `npm audit` contra el registro de excepciones.
 * Devuelve un resultado determinista (sin I/O) para poder testearlo.
 */
export function evaluateAudit(auditJson, exceptionsDocument, now = new Date()) {
  const errors = [];
  const validation = validateExceptions(exceptionsDocument);
  if (!validation.valid) errors.push(...validation.errors);

  if (!auditJson || typeof auditJson !== "object" || typeof auditJson.vulnerabilities !== "object" || auditJson.vulnerabilities === null) {
    return { ok: false, errors: [...errors, "JSON de npm audit inválido o sin 'vulnerabilities'."], blocking: [], excepted: [], expired: [], reports: [], counts: emptyCounts() };
  }

  const today = toDateString(now);
  const exceptions = Array.isArray(exceptionsDocument?.exceptions) ? exceptionsDocument.exceptions : [];
  const expired = exceptions.filter((exception) => isValidDateString(exception.expiresAt) && exception.expiresAt < today);
  const activeKeys = new Set(
    exceptions
      .filter((exception) => isValidDateString(exception.expiresAt) && exception.expiresAt >= today && typeof exception.advisory === "string" && typeof exception.package === "string")
      .map((exception) => `${exception.advisory}::${exception.package}`),
  );

  const advisories = resolveAdvisories(auditJson.vulnerabilities);
  const blocking = [];
  const excepted = [];
  const reports = [];
  const unidentified = [];

  for (const advisory of advisories) {
    if (!BLOCKING_SEVERITIES.has(advisory.severity)) {
      reports.push(advisory);
      continue;
    }
    if (!advisory.id) {
      unidentified.push(advisory);
      blocking.push(advisory);
      continue;
    }
    if (activeKeys.has(`${advisory.id}::${advisory.package}`)) excepted.push(advisory);
    else blocking.push(advisory);
  }

  if (expired.length) errors.push(...expired.map((exception) => `Excepción expirada: ${exception.advisory} (${exception.package}) expiró el ${exception.expiresAt}.`));
  if (unidentified.length) errors.push(`${unidentified.length} advisory(s) CRITICAL/HIGH sin GHSA identificable en 'url'.`);

  const counts = normalizeCounts(auditJson.metadata?.vulnerabilities, advisories);
  return { ok: errors.length === 0 && blocking.length === 0, errors, blocking, excepted, expired, reports, counts };
}

export function loadExceptions(filePath = DEFAULT_EXCEPTIONS_PATH) {
  const raw = readFileSync(filePath, "utf8");
  return JSON.parse(raw);
}

function runNpmAudit() {
  // `shell: true` es necesario en Windows para invocar npm.cmd (Node >= 22 lanza EINVAL sin shell).
  const result = spawnSync("npm", RUNTIME_AUDIT_ARGS, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024, shell: true });
  if (result.error) throw result.error;
  return result.stdout ?? "";
}

function parseArguments(argv) {
  const options = { input: null, exceptions: DEFAULT_EXCEPTIONS_PATH, now: new Date() };
  for (const argument of argv) {
    if (argument.startsWith("--input=")) options.input = argument.slice("--input=".length);
    else if (argument.startsWith("--exceptions=")) options.exceptions = argument.slice("--exceptions=".length);
    else if (argument.startsWith("--now=")) options.now = new Date(argument.slice("--now=".length));
  }
  return options;
}

function describe(advisory) {
  return `${advisory.id ?? "SIN-ID"} [${advisory.severity}] ${advisory.package}${advisory.title ? ` — ${advisory.title}` : ""}`;
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  let auditJson;
  try {
    const raw = options.input ? readFileSync(options.input, "utf8") : runNpmAudit();
    auditJson = JSON.parse(raw);
  } catch (error) {
    console.error("SECURITY_RUNTIME_GATE: no se pudo obtener/parsear el JSON de npm audit:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
    return;
  }

  let exceptionsDocument;
  try {
    exceptionsDocument = loadExceptions(options.exceptions);
  } catch (error) {
    console.error(`SECURITY_RUNTIME_GATE: no se pudo leer ${options.exceptions}:`, error instanceof Error ? error.message : error);
    process.exitCode = 1;
    return;
  }

  const result = evaluateAudit(auditJson, exceptionsDocument, options.now);
  const { counts } = result;

  console.info("SECURITY_RUNTIME_GATE — árbol de producción (npm audit --omit=dev --omit=optional)");
  console.info(`  CRITICAL: ${counts.critical}  HIGH: ${counts.high}  MODERATE: ${counts.moderate}  LOW: ${counts.low}  INFO: ${counts.info}`);
  if (result.excepted.length) {
    console.info("  Excepciones vigentes aplicadas:");
    for (const advisory of result.excepted) console.info(`    - ${describe(advisory)}`);
  }
  if (result.reports.length) {
    console.info(`  Reportadas (no bloquean): ${result.reports.length}`);
    for (const advisory of result.reports) console.info(`    - ${describe(advisory)}`);
  }
  if (result.errors.length) {
    console.error("  Errores:");
    for (const error of result.errors) console.error(`    - ${error}`);
  }
  if (result.blocking.length) {
    console.error("  CRITICAL/HIGH sin excepción vigente:");
    for (const advisory of result.blocking) console.error(`    - ${describe(advisory)}`);
  }

  if (result.ok) {
    console.info("SECURITY_RUNTIME_GATE: PASS");
  } else {
    console.error("SECURITY_RUNTIME_GATE: FAIL");
    process.exitCode = 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
