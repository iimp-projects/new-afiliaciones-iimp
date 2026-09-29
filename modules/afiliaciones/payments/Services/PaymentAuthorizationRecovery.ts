import type { ApplicationStatusData } from "@/modules/afiliaciones/consulta/Models/ApplicationStatus";
import type { CreatePaymentRequest } from "../Models/PaymentRequest";
import type { CreatePaymentResponse } from "../Models/PaymentResponse";
import { PAYMENT_AUTH_INVALID_OR_EXPIRED, PaymentApiError } from "./PaymentApi";

export class PaymentAuthorizationRecoveryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PaymentAuthorizationRecoveryError";
  }
}

interface PaymentAuthorizationRecoveryOptions {
  payload: CreatePaymentRequest;
  createPayment: (payload: CreatePaymentRequest) => Promise<CreatePaymentResponse>;
  refreshAuthorization: () => Promise<ApplicationStatusData>;
  onApplicationRefreshed: (application: ApplicationStatusData) => void;
  refreshBeforePost?: boolean;
}

/** Executes at most POST -> authorization refresh -> POST. */
export async function createPaymentWithAuthorizationRecovery({ payload, createPayment, refreshAuthorization, onApplicationRefreshed, refreshBeforePost = false }: PaymentAuthorizationRecoveryOptions): Promise<CreatePaymentResponse> {
  const refresh = async () => {
    const application = await refreshAuthorization();
    if (application.status !== "READY_FOR_PAYMENT") {
      throw new PaymentAuthorizationRecoveryError("La solicitud ya no está habilitada para iniciar el pago.");
    }
    onApplicationRefreshed(application);
  };

  if (refreshBeforePost) {
    await refresh();
    return createPayment(payload);
  }

  try {
    return await createPayment(payload);
  } catch (error) {
    if (!(error instanceof PaymentApiError) || error.status !== 403 || error.code !== PAYMENT_AUTH_INVALID_OR_EXPIRED) throw error;
  }

  await refresh();
  return createPayment(payload);
}
