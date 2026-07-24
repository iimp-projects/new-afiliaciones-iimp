import { Application } from "../Entities/Application";
import { IApplicationRepository } from "../Repositories/Interfaces/IApplicationRepository";

export class GetApplicationByTrackingService {

  constructor(
    private readonly repository: IApplicationRepository
  ) {}

  async execute(trackingCode: string): Promise<Application> {

    const application =
      await this.repository.findByTrackingCode(trackingCode);

    if (!application) {
      throw new Error("La postulación no existe.");
    }

    return application;

  }

}