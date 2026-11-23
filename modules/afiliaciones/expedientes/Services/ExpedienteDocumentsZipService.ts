import { S3StorageService } from "@/modules/shared/Services/S3StorageService";
import type { ExpedienteFilters } from "../Repositories/ExpedienteRepository";
import { ExportExpedientesService } from "./ExportExpedientesService";
import { buildCurrentExpedienteDocuments } from "./ExpedienteDocumentCatalog";
import { buildDocumentsZip, type DocumentsZipResult } from "./DocumentsZipBuilder";

type ExportFilters = Omit<ExpedienteFilters, "page" | "pageSize">;
type StorageReader = Pick<S3StorageService, "getObjectBuffer">;

export type ExpedienteDocumentsZipResult = DocumentsZipResult;

export class ExpedienteDocumentsZipService {
  constructor(
    private readonly exportService: ExportExpedientesService,
    private readonly storage?: StorageReader,
  ) {}

  async execute(
    filters: ExportFilters,
    options: { isComite: boolean } = { isComite: false },
  ): Promise<ExpedienteDocumentsZipResult> {
    const records = await this.exportService.getRecords(filters, options);
    const excelBuffer = await this.exportService.buildBuffer(records);

    return buildDocumentsZip({
      items: records.map((record) => ({
        code: record.trackingCode || record.applicationCode || String(record.id),
        documents: buildCurrentExpedienteDocuments(record),
      })),
      excelBuffer,
      excelFileName: "Expedientes.xlsx",
      rootPrefix: "Expedientes_Documentos",
      storage: this.storage,
      excelLabel: "expedientes",
    });
  }
}
