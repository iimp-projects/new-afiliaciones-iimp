import { randomUUID } from "crypto";

import { StartApplicationDto } from "../DTOs/start-application.dto";
import { Application } from "../Entities/Application";
import { IApplicationRepository } from "../Repositories/Interfaces/IApplicationRepository";

export class StartApplicationService {

  constructor(
    private readonly applicationRepository: IApplicationRepository,
  ) {}

  async execute(
    dto: StartApplicationDto,
  ): Promise<Application> {

    const draft =
      await this.applicationRepository.findDraftByDocument(
        dto.documentNumber,
      );

    if (draft) {
      return draft;
    }

    const applicationCode =
      this.generateApplicationCode();

    const trackingCode =
      this.generateTrackingCode();

    return await this.applicationRepository.create({

      applicationCode,

      trackingCode,

      affiliateType: dto.affiliateType,

      documentType: dto.documentType,

      documentNumber: dto.documentNumber,

      email: dto.email,

      phone: dto.phone,

      status: "DRAFT",

      currentStep: 1,

      draftData: {},

    });

  }

  private generateApplicationCode(): string {

    return `APP-${Date.now()}`;

  }

  private generateTrackingCode(): string {

    return randomUUID();

  }

}