import { readFileSync } from "node:fs";
import { Client } from "pg";
import { AssociatesApiClient } from "../modules/afiliaciones/associates-integration/Clients/AssociatesApiClient";
import { getAssociatesApiConfig } from "../modules/afiliaciones/associates-integration/Config/AssociatesApiConfig";
import { mapSieDocumentType } from "../modules/afiliaciones/associates-integration/Mappers/SieAssociateListMapper";
import { areNameMultisetsEqual } from "../modules/afiliaciones/associates-integration/Services/SieNameReconciliation";

const AE = new Set(["A", "E"]);
const PAGE_SIZE = 500;

async function main(): Promise<void> {
  const ca = readFileSync(process.env.RDS_CA_PATH ?? "", "utf8");
  const db = new Client({ connectionString: process.env.DATABASE_URL, ssl: { ca, rejectUnauthorized: true, checkServerIdentity: () => undefined } });
  await db.connect();

  // 1) SIE (PROD).
  const client = new AssociatesApiClient(getAssociatesApiConfig());
  const first = await client.listAssociates({ pagina: 1, tamanioPagina: PAGE_SIZE });
  const pages = [first];
  for (let p = 2; p <= (first.totalPaginas || 1); p++) pages.push(await client.listAssociates({ pagina: p, tamanioPagina: PAGE_SIZE }));
  const records = pages.flatMap((p) => p.associates);

  // 2) PROD: personas, SIE records, usuarios, postulaciones, categorías.
  const persons = await db.query("SELECT id, document_type, document_number, first_name, paternal_last_name, maternal_last_name, deleted_at FROM persons");
  const sieRecs = await db.query("SELECT external_code, person_id, link_status FROM sie_associate_records WHERE provider='SIE'");
  const users = await db.query("SELECT person_id, status FROM auth_users");
  const apps = await db.query("SELECT \"personId\" AS person_id, status FROM membership_applications WHERE status='COMPLETED' AND \"deletedAt\" IS NULL");
  const cats = await db.query("SELECT id, mapped_affiliate_type FROM membership_categories");

  const personByDoc = new Map<string, Array<{ id: number; firstName: string; paternalLastName: string; maternalLastName: string | null }>>();
  for (const p of persons.rows) {
    const key = `${p.document_type}|${p.document_number}`;
    if (!personByDoc.has(key)) personByDoc.set(key, []);
    personByDoc.get(key)!.push({ id: p.id, firstName: p.first_name, paternalLastName: p.paternal_last_name, maternalLastName: p.maternal_last_name });
  }

  const linkedPersonIds = new Set<number>();
  const codeByPerson = new Map<number, string[]>();
  for (const s of sieRecs.rows) {
    if (s.link_status === "LINKED" && s.person_id != null) {
      linkedPersonIds.add(s.person_id);
      const arr = codeByPerson.get(s.person_id) ?? [];
      arr.push(s.external_code);
      codeByPerson.set(s.person_id, arr);
    }
  }

  const activeUserPersonIds = new Set<number>();
  for (const u of users.rows) if (u.status === "ACTIVE") activeUserPersonIds.add(u.person_id);

  const completedPersonIds = new Set<number>();
  for (const a of apps.rows) completedPersonIds.add(a.person_id);

  const mappedCatIds = new Set<number>();
  for (const c of cats.rows) if (c.mapped_affiliate_type) mappedCatIds.add(c.id);

  // Duplicados de documento en SIE.
  const docFreq = new Map<string, number>();
  for (const r of records) {
    const dt = mapSieDocumentType(r.documentType);
    if (!dt || !r.documentNumber) continue;
    const key = `${dt}|${r.documentNumber}`;
    docFreq.set(key, (docFreq.get(key) ?? 0) + 1);
  }

  const counts = {
    SIE_TOTAL: records.length,
    SIE_AE_TOTAL: 0,
    ALREADY_IN_V2: 0,
    HISTORICAL_ALREADY_LINKED: 0,
    SAFE_MATCH_ADDITIONAL: 0,
    MANUAL_REVIEW: 0,
    EXCLUDED_BY_CATEGORY: 0,
    DUPLICATES: 0,
    UNRESOLVED: 0,
  };

  for (const r of records) {
    if (!AE.has(r.sourceType)) {
      counts.EXCLUDED_BY_CATEGORY += 1;
      continue;
    }
    counts.SIE_AE_TOTAL += 1;

    const dt = mapSieDocumentType(r.documentType);
    if (!dt || !r.documentNumber) {
      counts.MANUAL_REVIEW += 1;
      continue;
    }
    const docKey = `${dt}|${r.documentNumber}`;
    if ((docFreq.get(docKey) ?? 0) > 1) {
      counts.DUPLICATES += 1;
      continue;
    }
    const candidates = personByDoc.get(docKey) ?? [];
    if (candidates.length === 0) {
      counts.UNRESOLVED += 1;
      continue;
    }
    if (candidates.length > 1) {
      counts.MANUAL_REVIEW += 1;
      continue;
    }
    const person = candidates[0];

    if (completedPersonIds.has(person.id) || activeUserPersonIds.has(person.id)) {
      counts.ALREADY_IN_V2 += 1;
      continue;
    }
    if (linkedPersonIds.has(person.id)) {
      counts.HISTORICAL_ALREADY_LINKED += 1;
      continue;
    }

    // Candidato único sin vínculo: intentar SAFE_MATCH por multiconjunto de nombres.
    const namesMatch = areNameMultisetsEqual(
      { nombres: r.nombres ?? null, apellidoPaterno: r.apellidoPaterno ?? null, apellidoMaterno: r.apellidoMaterno ?? null },
      { firstName: person.firstName, paternalLastName: person.paternalLastName, maternalLastName: person.maternalLastName },
    );
    if (namesMatch) counts.SAFE_MATCH_ADDITIONAL += 1;
    else counts.MANUAL_REVIEW += 1;
  }

  console.log(JSON.stringify(counts, null, 2));
  await db.end();
}

main().catch((e) => { console.error("FATAL:", e.message); process.exit(1); });
