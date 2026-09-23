import { PaymentStatus, type Prisma } from "@prisma/client";
import type { NiubizAuthorizationResponse } from "../../DTOs/Niubiz/NiubizAuthorization.dto";
import type { PaymentGatewayResult } from "../../Repositories/Interfaces/IPaymentRepository";
import { NiubizAuthorizationResultClassifier } from "./NiubizAuthorizationResultClassifier";

export interface NiubizMappedAuthorizationResponse extends PaymentGatewayResult {
  gatewayPayload?: Prisma.InputJsonValue;
  gatewayAmount?: number;
  gatewayCurrency?: string;
  gatewayPurchaseNumber?: string;
}

export class NiubizResponseMapper {
  constructor(private readonly classifier = new NiubizAuthorizationResultClassifier()) {}

  mapAuthorization(response: NiubizAuthorizationResponse, paymentChannel?: string, httpStatus = 200): NiubizMappedAuthorizationResponse {
    const classification = this.classifier.classify(response, httpStatus);
    const responseCode = this.classifier.responseCode(response);
    const metadata = this.sanitizeMetadata(response);
    const transactionDate = this.parseTransactionDate(metadata.transactionDate);
    const cardBrand = metadata.brand;
    const maskedCard = metadata.maskedCard;
    const failureReason = this.classifier.failureReason(response) ?? classification.action?.label;
    const cardType = this.cardType(response);
    const traceNumber = this.nonEmptyString(response.order?.traceNumber)
      ?? this.nonEmptyString(response.dataMap?.TRACE_NUMBER)
      ?? this.nonEmptyString(response.data?.TRACE_NUMBER);

    return {
      status: classification.outcome === "APPROVED" ? PaymentStatus.PAID : classification.outcome === "BUSINESS_DECLINED" ? PaymentStatus.FAILED : PaymentStatus.PENDING,
      transactionId: this.nonEmptyString(response.order?.transactionId)
        ?? this.nonEmptyString(response.dataMap?.TRANSACTION_ID)
        ?? this.nonEmptyString(response.data?.TRANSACTION_ID)
        ?? this.nonEmptyString(response.transactionId),
      responseCode,
      ...(typeof response.order?.authorizedAmount === "number" ? { gatewayAmount: response.order.authorizedAmount } : typeof response.order?.amount === "number" ? { gatewayAmount: response.order.amount } : {}),
      ...(this.nonEmptyString(response.order?.currency) ? { gatewayCurrency: this.nonEmptyString(response.order?.currency) } : {}),
      ...(this.nonEmptyString(response.order?.purchaseNumber) ? { gatewayPurchaseNumber: this.nonEmptyString(response.order?.purchaseNumber) } : {}),
      authorizationCode: this.nonEmptyString(response.order?.authorizationCode)
        ?? this.nonEmptyString(response.authorizationCode)
        ?? this.nonEmptyString(response.dataMap?.AUTHORIZATION_CODE),
      ...(transactionDate ? { gatewayTransactionDate: transactionDate } : {}),
      ...(cardBrand ? { cardBrand } : {}),
      ...(maskedCard ? { maskedCard } : {}),
      ...(paymentChannel === "web" ? { paymentChannel } : {}),
      ...(classification.actionCode ? { actionCode: classification.actionCode } : {}),
      ...(cardType ? { cardType } : {}),
      ...(traceNumber ? { traceNumber } : {}),
      ...(classification.outcome === "BUSINESS_DECLINED" && classification.actionCode ? { failureCode: classification.actionCode } : {}),
      ...(classification.outcome === "BUSINESS_DECLINED" && failureReason ? { failureReason } : {}),
      ...(classification.outcome === "BUSINESS_DECLINED" && this.classifier.gatewayErrorCode(response) ? { gatewayErrorCode: this.classifier.gatewayErrorCode(response) } : {}),
      ...(Object.keys(metadata).length > 0 ? { gatewayPayload: metadata } : {}),
    };
  }

  /** Parses the Niubiz `yyMMddHHmmss` timestamp as UTC; invalid values are omitted. */
  parseTransactionDate(value: string | undefined): Date | undefined {
    if (!value || !/^\d{12}$/.test(value)) return undefined;
    const year = 2000 + Number(value.slice(0, 2));
    const month = Number(value.slice(2, 4));
    const day = Number(value.slice(4, 6));
    const hour = Number(value.slice(6, 8));
    const minute = Number(value.slice(8, 10));
    const second = Number(value.slice(10, 12));
    const date = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
    return date.getUTCFullYear() === year
      && date.getUTCMonth() === month - 1
      && date.getUTCDate() === day
      && date.getUTCHours() === hour
      && date.getUTCMinutes() === minute
      && date.getUTCSeconds() === second
      ? date
      : undefined;
  }

  private sanitizeMetadata(response: NiubizAuthorizationResponse): Record<string, string> {
    const metadata: Record<string, string> = {};
    const actionDescription = this.nonEmptyString(response.data?.ACTION_DESCRIPTION)
      ?? this.nonEmptyString(response.dataMap?.ACTION_DESCRIPTION)
      ?? this.nonEmptyString(response.ACTION_DESCRIPTION);
    const transactionDate = this.nonEmptyString(response.order?.transactionDate)
      ?? this.nonEmptyString(response.dataMap?.TRANSACTION_DATE)
      ?? this.nonEmptyString(response.data?.TRANSACTION_DATE)
      ?? this.nonEmptyString(response.TRANSACTION_DATE);
    const brand = this.nonEmptyString(response.dataMap?.BRAND)
      ?? this.nonEmptyString(response.data?.BRAND)
      ?? this.nonEmptyString(response.BRAND);
    const card = this.nonEmptyString(response.dataMap?.CARD)
      ?? this.nonEmptyString(response.data?.CARD)
      ?? this.nonEmptyString(response.CARD);

    if (actionDescription) metadata.actionDescription = actionDescription;
    if (transactionDate) metadata.transactionDate = transactionDate;
    if (brand) metadata.brand = brand;
    if (card && this.isMaskedCard(card)) metadata.maskedCard = card;

    return metadata;
  }

  private nonEmptyString(value: unknown): string | undefined {
    return typeof value === "string" && value.trim() ? value.trim() : undefined;
  }

  private cardType(response: NiubizAuthorizationResponse): "C" | "D" | undefined {
    const value = this.nonEmptyString(response.dataMap?.CARD_TYPE)
      ?? this.nonEmptyString(response.data?.CARD_TYPE)
      ?? this.nonEmptyString(response.CARD_TYPE);
    return value === "C" || value === "D" ? value : undefined;
  }

  private isMaskedCard(value: string): boolean {
    return /[xX*]/.test(value) && !/^\d{12,19}$/.test(value.replace(/[\s-]/g, ""));
  }
}
