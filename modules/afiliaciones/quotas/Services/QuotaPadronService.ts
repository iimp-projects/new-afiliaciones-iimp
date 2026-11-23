import { mapSieDocumentType } from "@/modules/afiliaciones/associates-integration/Mappers/SieAssociateListMapper";
import type { SanitizedSieAssociate } from "@/modules/afiliaciones/associates-integration/Models/SieAssociateList";
import type { DocumentType } from "@prisma/client";
import type { QuotaPadronFetcher, QuotaPadronReport, QuotaPadronSelection } from "../Models/QuotaPadron";
import type { IQuotaPadronRepository, PadronDocument } from "../Repositories/Interfaces/IQuotaPadronRepository";

export type QuotaPadronFetchOptions = {
  pageSize?: number;
  maxPages?: number;
  startPage?: number;
};

/**
 * Recupera el padrón SIE en modo lectura. No usa listAssociatesWithClave,
 * no lee ni persiste la Clave y no crea personas por sí mismo.
 */
export class QuotaPadronService {
  constructor(
    private readonly fetcher: QuotaPadronFetcher,
    private readonly repository: IQuotaPadronRepository,
  ) {}

  async fetch(options: QuotaPadronFetchOptions = {}): Promise<QuotaPadronSelection> {
    const pageSize = Math.max(1, Math.min(500, Math.trunc(options.pageSize ?? 500)));
    const startPage = Math.max(1, Math.trunc(options.startPage ?? 1));
    const maxPages = options.maxPages == null ? Number.POSITIVE_INFINITY : Math.max(1, Math.trunc(options.maxPages));

    const firstPage = await this.fetcher({ pagina: startPage, tamanioPagina: pageSize });
    const totalPages = Math.max(startPage, firstPage.totalPaginas || startPage);
    const lastAllowedPage = Math.min(totalPages, startPage + maxPages - 1);
    const pages = [firstPage];
    for (let page = startPage + 1; page <= lastAllowedPage; page += 1) {
      pages.push(await this.fetcher({ pagina: page, tamanioPagina: pageSize }));
    }

    const report: QuotaPadronReport = {
      pagesFetched: pages.length,
      totalRecords: 0,
      uniqueRecords: 0,
      duplicates: 0,
      byCategory: {},
      byDocumentType: {},
      validDocument: 0,
      unsupportedDocument: 0,
      missingDocument: 0,
      linkedToPerson: 0,
      unlinked: 0,
      checkpoint: { lastPage: pages[pages.length - 1]?.pagina ?? startPage, totalPages, pageSize },
    };

    const unique = new Map<string, SanitizedSieAssociate>();
    for (const page of pages) {
      for (const record of page.associates) {
        report.totalRecords += 1;
        const code = record.externalCode?.trim() ?? "";
        const documentType = record.documentType?.trim() ?? "";
        const documentNumber = record.documentNumber?.trim() ?? "";
        const key = code || (documentType && documentNumber ? `${documentType}|${documentNumber}` : "");
        if (!key) {
          report.missingDocument += 1;
          continue;
        }
        if (unique.has(key)) {
          report.duplicates += 1;
          continue;
        }
        unique.set(key, record);
      }
    }

    const documents: PadronDocument[] = [];
    const documentByKey = new Map<string, PadronDocument>();
    for (const record of unique.values()) {
      const category = record.sourceType?.trim() || "SIN_TIPO";
      report.byCategory[category] = (report.byCategory[category] ?? 0) + 1;
      report.byDocumentType[record.documentType || "SIN_TIPO"] = (report.byDocumentType[record.documentType || "SIN_TIPO"] ?? 0) + 1;

      const localType: DocumentType | null = mapSieDocumentType(record.documentType);
      const documentNumber = record.documentNumber?.trim() ?? "";
      if (!localType || !documentNumber) {
        if (!documentNumber) report.missingDocument += 1;
        else report.unsupportedDocument += 1;
        continue;
      }
      report.validDocument += 1;
      const key = `${localType}|${documentNumber}`;
      if (!documentByKey.has(key)) {
        const document = { documentType: localType, documentNumber };
        documentByKey.set(key, document);
        documents.push(document);
      }
    }

    const personByDocument = await this.repository.findPersonIdsByDocuments(documents);
    for (const [key] of documentByKey) {
      if (personByDocument.has(key)) report.linkedToPerson += 1;
      else report.unlinked += 1;
    }

    report.uniqueRecords = unique.size;
    return { records: [...unique.values()], personByDocument, report };
  }
}
