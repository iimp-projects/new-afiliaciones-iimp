"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { billingDataSchema, type BillingDataInput } from "@/modules/afiliaciones/payments/DTOs/billing.schema";
import { paymentApi } from "@/modules/afiliaciones/payments/Services/PaymentApi";
import type { CreatePaymentResponse } from "@/modules/afiliaciones/payments/Models/PaymentResponse";
import type { ApplicationStatusData } from "../Models/ApplicationStatus";
import PaymentStepper from "./PaymentStepper/PaymentStepper";
import PersonalDetailsStep from "./PaymentStepper/PersonalDetailsStep";
import BillingDetailsStep from "./PaymentStepper/BillingDetailsStep";
import PaymentProcessStep, { type PaymentUiState } from "./PaymentStepper/PaymentProcessStep";
import PaymentFooter from "./PaymentStepper/PaymentFooter";

interface RestoredPayment { id: number; status: "PAID" | "FAILED" | "PENDING"; amount: number; registrationAmount?: number | null; membershipFeeAmount?: number | null; currency: "PEN"; paymentDate?: string; transactionId?: string; authorizationCode?: string; cardBrand?: string; cardType?: string; maskedCard?: string; traceNumber?: string; }
interface Props { data: ApplicationStatusData; onCancel: () => void; initialBillingData?: BillingDataInput | null; restoredPayment?: RestoredPayment | null; failureMessage?: string | null; failureCode?: string | null; }
const initialBilling: BillingDataInput = { tipoDocumento: "DNI", numeroDocumento: "", razonSocial: "", direccionFiscal: "", responsable: "", emailFacturacion: "" };

export const StatusPaymentReady: React.FC<Props> = ({ data, onCancel, initialBillingData, restoredPayment, failureMessage, failureCode }) => {
  const [currentStep, setCurrentStep] = useState(restoredPayment ? 3 : 1);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const [billingData, setBillingData] = useState<BillingDataInput>(initialBillingData ?? initialBilling);
  const [confirmed, setConfirmed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CreatePaymentResponse | null>(restoredPayment ? { success: true, paymentId: restoredPayment.id, status: restoredPayment.status, amount: restoredPayment.amount, registrationAmount: restoredPayment.registrationAmount, membershipFeeAmount: restoredPayment.membershipFeeAmount, currency: restoredPayment.currency, message: restoredPayment.status === "FAILED" ? "Pago no aprobado." : restoredPayment.status === "PAID" ? "Pago realizado correctamente." : "Estamos verificando tu pago." } : null);
  const [error, setError] = useState<string | null>(null);
  const [paymentUiState, setPaymentUiState] = useState<PaymentUiState>(restoredPayment?.status === "FAILED" ? "PAYMENT_FAILED" : restoredPayment?.status === "PAID" ? "PAYMENT_SUCCESS" : restoredPayment?.status === "PENDING" ? "PAYMENT_UNCERTAIN" : "IDLE");
  const checkoutRequestInFlightRef = useRef(false);
  const billingValid = billingDataSchema.safeParse(billingData).success;

  const startCheckout = useCallback(async () => {
    if (!data.applicationId || !billingValid || loading) return;
    setLoading(true);
    setPaymentUiState("PREPARING_CHECKOUT");
    setError(null);
    try {
      const paymentResult = await paymentApi.createPayment({ applicationId: data.applicationId, billingData });
      setResult(paymentResult);
      setPaymentUiState(paymentResult.status === "PENDING" ? "IDLE" : paymentResult.status === "PAID" ? "PAYMENT_SUCCESS" : "PAYMENT_FAILED");
    } catch (paymentError) {
      setError(paymentError instanceof Error ? paymentError.message : "No se pudo preparar el formulario de pago.");
      setPaymentUiState("PAYMENT_FAILED");
    } finally {
      setLoading(false);
    }
  }, [billingData, billingValid, data.applicationId, loading]);

  useEffect(() => {
    if (currentStep !== 3 || !billingValid || loading || result || error || checkoutRequestInFlightRef.current) return;
    checkoutRequestInFlightRef.current = true;
    void startCheckout().finally(() => { checkoutRequestInFlightRef.current = false; });
  }, [billingValid, currentStep, error, loading, result, startCheckout]);

  const next = () => {
    if (currentStep >= 3) return;
    setCompletedSteps((steps) => steps.includes(currentStep) ? steps : [...steps, currentStep]);
    setCurrentStep((step) => step + 1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const previous = () => {
    if (currentStep <= 1) return;
    if (currentStep === 3) {
      setResult(null);
      setError(null);
    }
    setCurrentStep((step) => step - 1);
  };
  const titles = ["Datos personales", "Información de facturación", "Proceso de pago"];

  return <div className="w-full min-h-screen bg-[#F7F8FA] pb-24"><div className="bg-center bg-cover bg-no-repeat text-white" style={{ backgroundImage: "linear-gradient(rgba(42, 23, 0, 0.68), rgba(42, 23, 0, 0.76)), url('/images/minero.jpg')" }}><nav className="w-full px-6 py-6 flex justify-between max-w-5xl mx-auto"><img src="/images/logo-iimp.png" alt="IIMP Logo" className="h-12 w-auto brightness-0 invert" /><button onClick={onCancel} className="px-5 py-2.5 rounded-xl bg-white/10 font-bold flex gap-2"><ArrowLeft size={18} />Volver</button></nav><div className="max-w-5xl mx-auto px-6 pb-10"><div className="mt-10 mb-14"><PaymentStepper currentStep={currentStep} completedSteps={completedSteps} onStepChange={setCurrentStep} /></div><h1 className="text-4xl font-extrabold">{titles[currentStep - 1]}</h1></div></div>
    <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">{currentStep === 1 && <PersonalDetailsStep data={data} />}{currentStep === 2 && <BillingDetailsStep data={data} billingData={billingData} setBillingData={setBillingData} />}{currentStep === 3 && <PaymentProcessStep billingData={billingData} confirmed={confirmed} onConfirmedChange={setConfirmed} result={result} loading={loading} error={error} onRetry={() => { setError(null); setResult(null); setPaymentUiState("IDLE"); }} paymentUiState={paymentUiState} onCheckoutStateChange={setPaymentUiState} failureMessage={failureMessage} failureCode={failureCode} restoredPayment={restoredPayment} affiliateType={data.affiliateType} onFinish={onCancel} />}</main>
    <PaymentFooter currentStep={currentStep} onCancel={onCancel} onPrevious={previous} onNext={next} isNextDisabled={currentStep === 2 && !billingValid} loading={loading || paymentUiState === "PREPARING_CHECKOUT" || paymentUiState === "PROCESSING_PAYMENT"} />
  </div>;
};
