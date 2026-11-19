import type { QuotaUniverseCandidate, QuotaUniverseReport, QuotaUniverseSelection, SieDocumentType } from "../Models/QuotaUniverse";
import type { IQuotaUniverseRepository, UniversePerson, UniverseSieRecord } from "../Repositories/Interfaces/IQuotaUniverseRepository";

const SIE_DOCUMENT_TYPE_BY_VALUE: Readonly<Record<string, SieDocumentType>> = {
  "1": "1",
  "4": "4",
  "7": "7",
  DNI: "1",
  CE: "4",
  PASSPORT: "7",
};

export function toSieDocumentType(value: string | null | undefined): SieDocumentType | null {
  if (!value) return null;
  return SIE_DOCUMENT_TYPE_BY_VALUE[value.trim().toUpperCase()] ?? null;
}

export type QuotaUniverseOptions = {
  personIds?: readonly number[];
  limit?: number;
  offset?: number;
  full?: boolean;
};

/**
 * Resuelve el universo de asociados para cuotas.
 * Prioriza el padrón SIE local; si está vacío, usa postulaciones COMPLETED.
 * Nunca inventa asociados ni consulta el SIE.
 */
export class QuotaUniverseService {
  constructor(private readonly repository: IQuotaUniverseRepository) {}

  async resolve(options: QuotaUniverseOptions = {}): Promise<QuotaUniverseSelection> {
    const report: QuotaUniverseReport = {
      selected: 0,
      fromSieRecords: 0,
      fromApplications: 0,
      duplicates: 0,
      unsupportedDocument: 0,
      missingDocument: 0,
    };
    const candidates = new Map<string, QuotaUniverseCandidate>();

    const [sieRecords, applicationPersons] = await Promise.all([
      this.repository.listSieRecords(),
      options.personIds?.length ? Promise.resolve([] as UniversePerson[]) : this.repository.listCompletedApplicationPersons(),
    ]);

    const allowedPersonIds = options.personIds?.length ? new Set(options.personIds) : null;
    for (const record of sieRecords) {
      if (allowedPersonIds && (record.personId == null || !allowedPersonIds.has(record.personId))) continue;
      const candidate = this.fromSieRecord(record);
      if (!candidate) {
        if (!record.documentNumber?.trim()) report.missingDocument += 1;
        else report.unsupportedDocument += 1;
        continue;
      }
      report.fromSieRecords += 1;
      this.merge(candidates, candidate, report);
    }

    if (allowedPersonIds) {
      const persons = await this.repository.findPersonsByIds([...allowedPersonIds]);
      for (const person of persons) {
        const candidate = this.fromPerson(person, null, null);
        if (!candidate) {
          report.unsupportedDocument += 1;
          continue;
        }
        this.merge(candidates, candidate, report);
      }
    } else {
      for (const person of applicationPersons) {
        const candidate = this.fromPerson(person, null, null);
        if (!candidate) {
          report.unsupportedDocument += 1;
          continue;
        }
        report.fromApplications += 1;
        this.merge(candidates, candidate, report);
      }
    }

    let selected = [...candidates.values()];
    if (options.offset != null && options.offset > 0) selected = selected.slice(options.offset);
    if (!options.full && options.limit != null && options.limit >= 0) selected = selected.slice(0, options.limit);
    report.selected = selected.length;
    return { candidates: selected, report };
  }

  async resolveByInstitutionalCodes(codes: readonly string[]): Promise<QuotaUniverseSelection> {
    const requested = new Set(codes.map((code) => code.trim()).filter(Boolean));
    const report: QuotaUniverseReport = { selected: 0, fromSieRecords: 0, fromApplications: 0, duplicates: 0, unsupportedDocument: 0, missingDocument: 0 };
    const candidates = new Map<string, QuotaUniverseCandidate>();
    if (requested.size === 0) return { candidates: [], report };

    for (const record of await this.repository.listSieRecords()) {
      if (!requested.has(record.externalCode.trim())) continue;
      const candidate = this.fromSieRecord(record);
      if (!candidate) {
        if (!record.documentNumber?.trim()) report.missingDocument += 1;
        else report.unsupportedDocument += 1;
        continue;
      }
      report.fromSieRecords += 1;
      this.merge(candidates, candidate, report);
    }

    const selected = [...candidates.values()];
    report.selected = selected.length;
    return { candidates: selected, report };
  }

  private fromSieRecord(record: UniverseSieRecord): QuotaUniverseCandidate | null {
    const documentType = toSieDocumentType(record.sourceDocumentType);
    const documentNumber = record.documentNumber?.trim() ?? "";
    if (!documentType || !documentNumber) return null;
    return {
      personId: record.personId,
      documentType,
      documentNumber,
      institutionalCode: record.externalCode?.trim() || null,
      category: record.sourceType?.trim() || null,
    };
  }

  private fromPerson(person: UniversePerson, institutionalCode: string | null, category: string | null): QuotaUniverseCandidate | null {
    const documentType = toSieDocumentType(person.documentType);
    const documentNumber = person.documentNumber?.trim() ?? "";
    if (!documentType || !documentNumber) return null;
    return { personId: person.personId, documentType, documentNumber, institutionalCode, category };
  }

  private merge(map: Map<string, QuotaUniverseCandidate>, candidate: QuotaUniverseCandidate, report: QuotaUniverseReport): void {
    const key = `${candidate.documentType}|${candidate.documentNumber}`;
    const existing = map.get(key);
    if (!existing) {
      map.set(key, candidate);
      return;
    }
    report.duplicates += 1;
    map.set(key, {
      ...existing,
      personId: existing.personId ?? candidate.personId,
      institutionalCode: existing.institutionalCode ?? candidate.institutionalCode,
      category: existing.category ?? candidate.category,
    });
  }
}
