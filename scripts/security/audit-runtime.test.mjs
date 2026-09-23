import { describe, expect, it } from "vitest";
import { evaluateAudit, extractAdvisoryId, resolveAdvisories, validateExceptions } from "./audit-runtime.mjs";

const NOW = new Date("2026-09-20T00:00:00Z");
const NODEMAILER_HIGH = "GHSA-p6gq-j5cr-w38f";
const NODEMAILER_HIGH_2 = "GHSA-2x7j-588g-ccc2";
const UNKNOWN_HIGH = "GHSA-aaaa-bbbb-cccc";
const UNKNOWN_HIGH_2 = "GHSA-dddd-eeee-ffff";
const UNKNOWN_CRITICAL = "GHSA-1111-2222-3333";
const UNKNOWN_MODERATE = "GHSA-5555-6666-7777";

function advisory(id, severity, pkg = "nodemailer", title = "fixture") {
  return { source: 1, name: pkg, dependency: pkg, title, url: `https://github.com/advisories/${id}`, severity, range: "*" };
}

function packageEntry(severity, via) {
  return { name: "fixture", severity, isDirect: false, via, range: "*", nodes: [], fixAvailable: true };
}

function auditWith(vulnerabilities) {
  return { auditReportVersion: 2, vulnerabilities };
}

function exception(advisoryId, pkg, expiresAt = "2026-12-19") {
  return {
    advisory: advisoryId,
    package: pkg,
    affectedVersion: "7.0.13",
    reason: "fixture",
    classification: "NOT_REACHABLE",
    owner: "backend/security",
    createdAt: "2026-09-20",
    expiresAt,
    invalidatedBy: ["fixture"],
  };
}

function exceptionsDocument(...entries) {
  return { version: 1, exceptions: entries };
}

const nodemailerRuntimeTree = auditWith({
  nodemailer: packageEntry("high", [
    advisory(NODEMAILER_HIGH, "high"),
    advisory(NODEMAILER_HIGH_2, "high"),
    advisory("GHSA-wqvq-jvpq-h66f", "moderate"),
  ]),
  "@auth/core": packageEntry("high", ["nodemailer"]),
  "next-auth": packageEntry("high", ["@auth/core", "nodemailer"]),
  "@auth/prisma-adapter": packageEntry("high", ["@auth/core"]),
});

const approvedNodemailerExceptions = exceptionsDocument(
  exception(NODEMAILER_HIGH, "nodemailer"),
  exception(NODEMAILER_HIGH_2, "nodemailer"),
);

describe("extractAdvisoryId", () => {
  it("extrae el GHSA desde la url del advisory", () => {
    expect(extractAdvisoryId(advisory(UNKNOWN_HIGH, "high"))).toBe(UNKNOWN_HIGH);
    expect(extractAdvisoryId({ url: "https://example.test/no-advisory" })).toBeNull();
  });
});

describe("resolveAdvisories", () => {
  it("propaga advisories a través de referencias string (via paquete)", () => {
    const resolved = resolveAdvisories(nodemailerRuntimeTree.vulnerabilities);
    const ids = new Set(resolved.map((entry) => entry.id));
    expect(ids.has(NODEMAILER_HIGH)).toBe(true);
    expect(ids.has(NODEMAILER_HIGH_2)).toBe(true);
  });
});

describe("validateExceptions", () => {
  it("acepta un documento válido", () => {
    expect(validateExceptions(approvedNodemailerExceptions).valid).toBe(true);
  });

  it("rechaza un documento inválido", () => {
    expect(validateExceptions({ version: 1, exceptions: [{ advisory: "no-es-ghsa" }] }).valid).toBe(false);
  });
});

describe("evaluateAudit", () => {
  it("1. audit limpio -> PASS", () => {
    const result = evaluateAudit(auditWith({}), exceptionsDocument(), NOW);
    expect(result.ok).toBe(true);
    expect(result.blocking).toEqual([]);
  });

  it("2. HIGH desconocido -> FAIL", () => {
    const result = evaluateAudit(auditWith({ foo: packageEntry("high", [advisory(UNKNOWN_HIGH, "high", "foo")]) }), exceptionsDocument(), NOW);
    expect(result.ok).toBe(false);
    expect(result.blocking.map((entry) => entry.id)).toContain(UNKNOWN_HIGH);
  });

  it("3. CRITICAL desconocido -> FAIL", () => {
    const result = evaluateAudit(auditWith({ foo: packageEntry("critical", [advisory(UNKNOWN_CRITICAL, "critical", "foo")]) }), exceptionsDocument(), NOW);
    expect(result.ok).toBe(false);
    expect(result.blocking.map((entry) => entry.id)).toContain(UNKNOWN_CRITICAL);
  });

  it("4. HIGH incluido exactamente en exceptions -> PASS", () => {
    const audit = auditWith({ foo: packageEntry("high", [advisory(UNKNOWN_HIGH, "high", "foo")]) });
    const result = evaluateAudit(audit, exceptionsDocument(exception(UNKNOWN_HIGH, "foo")), NOW);
    expect(result.ok).toBe(true);
    expect(result.excepted.map((entry) => entry.id)).toContain(UNKNOWN_HIGH);
  });

  it("5. excepción expirada -> FAIL", () => {
    const audit = auditWith({ foo: packageEntry("high", [advisory(UNKNOWN_HIGH, "high", "foo")]) });
    const result = evaluateAudit(audit, exceptionsDocument(exception(UNKNOWN_HIGH, "foo", "2026-01-01")), NOW);
    expect(result.ok).toBe(false);
    expect(result.expired.length).toBe(1);
  });

  it("6. excepción con advisory diferente -> FAIL", () => {
    const audit = auditWith({ foo: packageEntry("high", [advisory(UNKNOWN_HIGH, "high", "foo")]) });
    const result = evaluateAudit(audit, exceptionsDocument(exception(UNKNOWN_HIGH_2, "foo")), NOW);
    expect(result.ok).toBe(false);
    expect(result.blocking.map((entry) => entry.id)).toContain(UNKNOWN_HIGH);
  });

  it("7. mismo paquete pero advisory diferente -> FAIL", () => {
    const audit = auditWith({ nodemailer: packageEntry("high", [advisory(NODEMAILER_HIGH_2, "high")]) });
    const result = evaluateAudit(audit, exceptionsDocument(exception(NODEMAILER_HIGH, "nodemailer")), NOW);
    expect(result.ok).toBe(false);
  });

  it("8. JSON inválido -> FAIL", () => {
    expect(evaluateAudit(null, exceptionsDocument(), NOW).ok).toBe(false);
    expect(evaluateAudit({}, exceptionsDocument(), NOW).ok).toBe(false);
    expect(evaluateAudit("no-json", exceptionsDocument(), NOW).ok).toBe(false);
  });

  it("9. MODERATE desconocido -> REPORT + PASS", () => {
    const audit = auditWith({ foo: packageEntry("moderate", [advisory(UNKNOWN_MODERATE, "moderate", "foo")]) });
    const result = evaluateAudit(audit, exceptionsDocument(), NOW);
    expect(result.ok).toBe(true);
    expect(result.blocking).toEqual([]);
    expect(result.reports.map((entry) => entry.id)).toContain(UNKNOWN_MODERATE);
  });

  it("10. múltiples HIGH donde solo uno está exceptuado -> FAIL", () => {
    const audit = auditWith({
      foo: packageEntry("high", [advisory(UNKNOWN_HIGH, "high", "foo")]),
      bar: packageEntry("high", [advisory(UNKNOWN_HIGH_2, "high", "bar")]),
    });
    const result = evaluateAudit(audit, exceptionsDocument(exception(UNKNOWN_HIGH, "foo")), NOW);
    expect(result.ok).toBe(false);
    expect(result.blocking.map((entry) => entry.id)).toEqual([UNKNOWN_HIGH_2]);
  });

  it("11. advisory Nodemailer permitido -> PASS", () => {
    const result = evaluateAudit(nodemailerRuntimeTree, approvedNodemailerExceptions, NOW);
    expect(result.ok).toBe(true);
    expect(result.blocking).toEqual([]);
    expect(result.excepted.map((entry) => entry.id).sort()).toEqual([NODEMAILER_HIGH, NODEMAILER_HIGH_2].sort());
  });

  it("12. exception file inválido -> FAIL", () => {
    const result = evaluateAudit(auditWith({}), { version: 1, exceptions: [{ advisory: "no-es-ghsa" }] }, NOW);
    expect(result.ok).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("13. HIGH propio de next-auth no exceptuado (Nodemailer exceptuado) -> FAIL", () => {
    const nextAuthOwnHigh = "GHSA-nnnn-nnnn-nnnn";
    const audit = auditWith({
      nodemailer: packageEntry("high", [advisory(NODEMAILER_HIGH, "high"), advisory(NODEMAILER_HIGH_2, "high")]),
      "@auth/core": packageEntry("high", ["nodemailer"]),
      "next-auth": packageEntry("high", ["@auth/core", "nodemailer", advisory(nextAuthOwnHigh, "high", "next-auth")]),
      "@auth/prisma-adapter": packageEntry("high", ["@auth/core"]),
    });
    const result = evaluateAudit(audit, approvedNodemailerExceptions, NOW);
    expect(result.ok).toBe(false);
    expect(result.blocking.map((entry) => entry.id)).toEqual([nextAuthOwnHigh]);
    expect(result.blocking.every((entry) => entry.package === "next-auth")).toBe(true);
  });
});
