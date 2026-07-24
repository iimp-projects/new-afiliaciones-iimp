import { Application } from "../../Entities/Application";
import { UpdateDraftDTO } from "../../DTOs/update-draft.dto";

/**
 * Contrato del repositorio de postulaciones.
 *
 * Define las operaciones disponibles para acceder
 * a las postulaciones sin importar la tecnología
 * utilizada para persistir los datos.
 */
export interface IApplicationRepository {
  /**
   * Busca un borrador mediante el número de documento.
   */
  findDraftByDocument(documentNumber: string): Promise<Application | null>;

  /**
   * Busca una postulación por su código.
   */
  findByApplicationCode(applicationCode: string): Promise<Application | null>;

  /**
   * Crea una nueva postulación.
   */
  create(application: Partial<Application>): Promise<Application>;

  /**
   * Actualiza una postulación.
   */
  update(id: number, application: Partial<Application>): Promise<Application>;

  findByTrackingCode(trackingCode: string): Promise<Application | null>;

  updateDraft(trackingCode: string, dto: UpdateDraftDTO): Promise<Application>;

  submitApplication(trackingCode: string): Promise<Application>;
}
