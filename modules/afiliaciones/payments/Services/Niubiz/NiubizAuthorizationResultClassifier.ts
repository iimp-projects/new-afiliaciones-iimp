import type { NiubizAuthorizationResponse } from "../../DTOs/Niubiz/NiubizAuthorization.dto";
import { getNiubizActionCode, NIUBIZ_APPROVED_ACTION_CODES, type NiubizActionCodeDefinition } from "./NiubizActionCodes";

export type NiubizAuthorizationOutcome = "APPROVED" | "BUSINESS_DECLINED" | "TECHNICAL_UNCERTAIN";

export interface NiubizAuthorizationClassification {
  outcome: NiubizAuthorizationOutcome;
  actionCode?: string;
  action?: NiubizActionCodeDefinition;
}

export class NiubizAuthorizationResultClassifier {
  classify(response: NiubizAuthorizationResponse, httpStatus: number): NiubizAuthorizationClassification {
    const actionCode = this.actionCode(response);
    const action = getNiubizActionCode(actionCode);
    const authorized = (response.dataMap?.STATUS ?? response.data?.STATUS ?? response.STATUS) === "Authorized";
    const httpProcessed = httpStatus >= 200 && httpStatus < 300;
    const httpFunctionalDecline = httpStatus === 400;

    if (authorized) {
      return httpProcessed && actionCode && NIUBIZ_APPROVED_ACTION_CODES.has(actionCode)
        ? { outcome: "APPROVED", actionCode }
        : { outcome: "TECHNICAL_UNCERTAIN", ...(actionCode ? { actionCode } : {}) };
    }
    if ((httpProcessed || httpFunctionalDecline) && actionCode && action) return { outcome: "BUSINESS_DECLINED", actionCode, action };
    return { outcome: "TECHNICAL_UNCERTAIN", ...(actionCode ? { actionCode } : {}) };
  }

  actionCode(response: NiubizAuthorizationResponse): string | undefined {
    return this.nonEmptyString(response.order?.actionCode)
      ?? this.nonEmptyString(response.dataMap?.ACTION_CODE)
      ?? this.nonEmptyString(response.data?.ACTION_CODE)
      ?? this.nonEmptyString(response.ACTION_CODE);
  }

  responseCode(response: NiubizAuthorizationResponse): string | undefined {
    return this.actionCode(response) ?? this.gatewayErrorCode(response);
  }

  failureReason(response: NiubizAuthorizationResponse): string | undefined {
    return this.nonEmptyString(response.data?.ACTION_DESCRIPTION)
      ?? this.nonEmptyString(response.dataMap?.ACTION_DESCRIPTION)
      ?? this.nonEmptyString(response.ACTION_DESCRIPTION);
  }

  gatewayErrorCode(response: NiubizAuthorizationResponse): string | undefined {
    return this.codeString(response.errorCode);
  }

  private nonEmptyString(value: unknown): string | undefined {
    return typeof value === "string" && value.trim() ? value.trim() : undefined;
  }

  private codeString(value: unknown): string | undefined {
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
    return this.nonEmptyString(value);
  }
}
