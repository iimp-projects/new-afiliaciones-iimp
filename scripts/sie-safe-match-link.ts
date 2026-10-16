import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { Client } from "pg";
import { AssociatesApiClient } from "../modules/afiliaciones/associates-integration/Clients/AssociatesApiClient";
import { getAssociatesApiConfig } from "../modules/afiliaciones/associates-integration/Config/AssociatesApiConfig";
import { mapSieDocumentType } from "../modules/afiliaciones/associates-integration/Mappers/SieAssociateListMapper";
import { areNameMultisetsEqual } from "../modules/afiliaciones/associates-integration/Services/SieNameReconciliation";

const AE = new Set(["A", "E"]);
const PAGE_SIZE = 500;

type Candidate = {
  externalCode: string;
  documentNumber: string;
  documentType: string;
  sourceType: string;
  sourceDescription: string | null;
  personId: number;
  categoryId: number;
};

async function main(): Promise<void> {
  const mode = process.argv[2] === "execute" ? "execute" : "dry-run";
  const ca = readFileSync(process.env.RDS_CA_PATH ?? "", "utf8");
  const db = new Client({ connectionString: process.env.DATABASE_URL, ssl: { ca, rejectUnauthorized: true, checkServerIdentity: () => undefined } });
  await db.connect();

  // 1) SIE (PROD).
  const client = new AssociatesApiClient(getAssociatesApiConfig());
  const first = await client.listAssociates({ pagina: 1, tamanioPagina: PAGE_SIZE });
  const pages = [first];
  for (let p = 2; p <= (first.totalPaginas || 1); p++) pages.push(await client.listAssociates({ pagina: p, tamanioPagina: PAGE_SIZE }));
  const records = pages.flatMap((p) => p.associates).filter((r) => AE.has(r.sourceType));

  // 2) PROD: personas, registros SIE existentes, usuarios, postulaciones, categorías.
  const persons = await db.query("SELECT id, document_type, document_number, first_name, paternal_last_name, maternal_last_name FROM persons");
  const sie = await db.query("SELECT external_code, person_id, link_status FROM sie_associate_records WHERE provider='SIE'");
  const users = await db.query("SELECT person_id FROM auth_users WHERE status='ACTIVE' AND deleted_at IS NULL");
  const apps = await db.query("SELECT \"personId\" AS person_id FROM membership_applications WHERE status='COMPLETED' AND \"deletedAt\" IS NULL");
  const cats = await db.query("SELECT id, code FROM membership_categories WHERE code IN ('A','E')");

  const personByDoc = new Map<string, Array<{ id: number; firstName: string; paternalLastName: string; maternalLastName: string | null }>>();
  for (const p of persons.rows) {
    const key = `${p.document_type}|${p.document_number}`;
    if (!personByDoc.has(key)) personByDoc.set(key, []);
    personByDoc.get(key)!.push({ id: p.id, firstName: p.first_name, paternalLastName: p.paternal_last_name, maternalLastName: p.maternal_last_name });
  }
  const linkedCodes = new Set<string>();
  const linkedPersonIds = new Set<number>();
  for (const s of sie.rows) {
    linkedCodes.add(s.external_code);
    if (s.link_status === "LINKED" && s.person_id != null) linkedPersonIds.add(s.person_id);
  }
  const activeUsers = new Set<number>(users.rows.map((u) => u.person_id));
  const completedApps = new Set<number>(apps.rows.map((a) => a.person_id));
  const catByCode = new Map<string, number>(cats.rows.map((c) => [c.code, c.id]));

  // 3) Identificar SAFE_MATCH.
  const candidates: Candidate[] = [];
  for (const r of records) {
    const dt = mapSieDocumentType(r.documentType);
    if (!dt || !r.documentNumber) continue;
    if (linkedCodes.has(r.externalCode)) continue; // ya tiene registro
    const key = `${dt}|${r.documentNumber}`;
    const people = personByDoc.get(key) ?? [];
    if (people.length !== 1) continue; // candidato único
    const person = people[0];
    if (completedApps.has(person.id) || activeUsers.has(person.id)) continue; // ya en V2
    if (linkedPersonIds.has(person.id)) continue; // persona ya vinculada a otro código
    const nameMatch = areNameMultisetsEqual(
      { nombres: r.nombres ?? null, apellidoPaterno: r.apellidoPaterno ?? null, apellidoMaterno: r.apellidoMaterno ?? null },
      { firstName: person.firstName, paternalLastName: person.paternalLastName, maternalLastName: person.maternalLastName },
    );
    if (!nameMatch) continue;
    const categoryId = catByCode.get(r.sourceType);
    if (!categoryId) continue;
    candidates.push({ externalCode: r.externalCode, documentNumber: r.documentNumber, documentType: dt, sourceType: r.sourceType, sourceDescription: r.sourceDescription ?? null, personId: person.id, categoryId });
  }

  console.log(JSON.stringify({ mode, safe_match_total: candidates.length, candidates: candidates.map((c) => ({ externalCode: c.externalCode, documentNumber: c.documentNumber, sourceType: c.sourceType, personId: c.personId })) }, null, 2));

  if (mode === "dry-run") {
    console.log("DRY-RUN: sin escrituras.");
    await db.end();
    return;
  }

  // 4) Vincular (transaccional, revalidando).
  const runId = `sie-safe-match-${randomUUID()}`;
  let linked = 0;
  const skipped: string[] = [];
  for (const c of candidates) {
    await db.query("BEGIN");
    try {
      const recheck = await db.query(
        "SELECT id, link_status FROM sie_associate_records WHERE provider='SIE' AND external_code=$1 FOR UPDATE",
        [c.externalCode],
      );
      if (recheck.rows.length > 0 && recheck.rows[0].link_status === "LINKED") {
        skipped.push(`${c.externalCode}:ALREADY_LINKED`);
        await db.query("ROLLBACK");
        continue;
      }
      const ambiguous = await db.query(
        "SELECT count(*)::int AS n FROM sie_associate_records WHERE provider='SIE' AND person_id=$1 AND link_status='LINKED'",
        [c.personId],
      );
      if (ambiguous.rows[0].n > 0) {
        skipped.push(`${c.externalCode}:PERSON_ALREADY_LINKED`);
        await db.query("ROLLBACK");
        continue;
      }
      await db.query(
        `INSERT INTO sie_associate_records (provider, external_code, source_document_type, document_number, source_type, source_description, person_id, category_id, link_status, last_synced_at, created_at, updated_at)
         VALUES ('SIE', $1, $2, $3, $4, $5, $6, $7, 'LINKED', now(), now(), now())`,
        [c.externalCode, c.documentType, c.documentNumber, c.sourceType, c.sourceDescription, c.personId, c.categoryId],
      );
      await db.query(
        `INSERT INTO sys_audit_logs (id, trace_id, action, entity, entity_id, new_values, created_at)
         VALUES (gen_random_uuid(), $1::varchar, 'SIE_SAFE_MATCH_LINK', 'sie_associate_records', $2::varchar, jsonb_build_object('external_code', $2::text, 'person_id', $3::int, 'source_type', $4::text), now())`,
        [runId, c.externalCode, c.personId, c.sourceType],
      );
      await db.query("COMMIT");
      linked += 1;
    } catch (e) {
      await db.query("ROLLBACK");
      skipped.push(`${c.externalCode}:ERROR:${e instanceof Error ? e.message : String(e)}`);
    }
  }

  console.log(JSON.stringify({ mode, runId, linked, skipped }, null, 2));
  await db.end();
}

main().catch((e) => { console.error("FATAL:", e.message); process.exit(1); });
