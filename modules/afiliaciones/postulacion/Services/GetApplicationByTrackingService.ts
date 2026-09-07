import { Application } from "../Entities/Application";
import { IApplicationRepository } from "../Repositories/Interfaces/IApplicationRepository";
import { ApplicationAccessService } from "./ApplicationAccessService";
import { ApplicationFlowError } from "./Exceptions/ApplicationFlowError";

export class GetApplicationByTrackingService {

  constructor(
    private readonly repository: IApplicationRepository
  ) {}

  async execute(trackingCode: string, token?: string): Promise<Application> {

    const application =
      await this.repository.findByTrackingCode(trackingCode);

    if (!application) {
      throw new Error("La postulación no existe.");
    }

    new ApplicationAccessService().require(Number(application.id), token);
    if (application.status !== "DRAFT") throw new ApplicationFlowError("APPLICATION_NOT_EDITABLE", "Tu solicitud ya fue enviada. Puedes revisarla desde Consultar.");
    return application;

  }

}
