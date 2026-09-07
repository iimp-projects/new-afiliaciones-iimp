import { randomUUID } from "crypto";

import { StartApplicationDto } from "../DTOs/start-application.dto";
import { Application } from "../Entities/Application";
import { IApplicationRepository } from "../Repositories/Interfaces/IApplicationRepository";
import { applicationIdentitySchema } from "./ApplicationLookupService";
import { z } from "zod";
import { ApplicationFlowError } from "./Exceptions/ApplicationFlowError";
import { queryAuthorization } from "@/modules/afiliaciones/consulta/Services/QueryAuthorizationService";

export class StartApplicationService {

  constructor(
    private readonly applicationRepository: IApplicationRepository,
  ) {}

  async execute(
    dto: StartApplicationDto,
    token?: string,
  ): Promise<Application> {

    const parsed = applicationIdentitySchema.extend({ affiliateType: z.enum(["ACTIVE", "STUDENT"]), email: z.string().trim().email(), phone: z.string().trim().min(6).max(30) }).safeParse(dto);
    if (!parsed.success) throw new ApplicationFlowError("INVALID_INPUT", "Revisa los datos de la postulación.", 400);
    dto = parsed.data;

    const applicationCode =
      this.generateApplicationCode();

    const trackingCode =
      this.generateTrackingCode();

    return await this.applicationRepository.createDraftIfAllowed({

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

    }, queryAuthorization.allowedIds(token));

  }

  private generateApplicationCode(): string {

    return `APP-${Date.now()}`;

  }

  private generateTrackingCode(): string {

    return randomUUID();

  }

}
