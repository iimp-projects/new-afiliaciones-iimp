import { S3StorageService } from "@/modules/shared/Services/S3StorageService";
import { buildCurrentExpedienteDocuments } from "@/modules/afiliaciones/expedientes/Services/ExpedienteDocumentCatalog";
import {
  buildDocumentsZip,
  type DocumentsZipResult,
} from "@/modules/afiliaciones/expedientes/Services/DocumentsZipBuilder";
import { ExportAsociadosService, type ExportAsociadosFilters } from "./ExportAsociadosService";

type StorageReader = Pick<S3StorageService, "getObjectBuffer">;

export type AsociadosDocumentsZipResult = DocumentsZipResult;

export class AsociadosDocumentsZipService {
  constructor(
    private readonly exportService: ExportAsociadosService,
    private readonly storage?: StorageReader,
  ) {}

  async execute(filters: ExportAsociadosFilters): Promise<AsociadosDocumentsZipResult> {
    const records = await this.exportService.getRecords(filters);
    const excelBuffer = await this.exportService.buildBuffer(records);

    return buildDocumentsZip({
      items: records.map((record) => ({
        code: String(
          record.values["Código Institucional"] ||
            record.values["N° Documento"] ||
            record.values["Nombres y Apellidos"] ||
            "",
        ),
        documents: record.application
          ? buildCurrentExpedienteDocuments(record.application)
          : [],
      })),
      excelBuffer,
      excelFileName: "Asociados.xlsx",
      rootPrefix: "Asociados_Documentos",
      storage: this.storage,
      excelLabel: "asociados",
    });
  }
}
