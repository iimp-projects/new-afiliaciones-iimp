import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/modules/afiliaciones/payments/Components/NiubizCheckout", () => ({
  NiubizCheckout: ({ disabled }: { disabled?: boolean }) => <button disabled={disabled}>PAGA AQUÍ</button>,
}));
vi.mock("@/modules/afiliaciones/payments/Components/PaymentLoadingOverlay", () => ({
  PaymentLoadingOverlay: () => <div role="status" />,
}));

import PaymentProcessStep from "./PaymentProcessStep";

const billingData = { tipoDocumento: "RUC" as const, numeroDocumento: "20107972090", razonSocial: "Razón social real", direccionFiscal: "Av. Principal 123", responsable: "Responsable real", emailFacturacion: "facturacion@example.com" };
const props = { billingData, confirmed: false, onConfirmedChange: vi.fn(), result: null, loading: false, error: null, onRetry: vi.fn(), paymentUiState: "PAYMENT_FAILED" as const, onCheckoutStateChange: vi.fn(), failureCode: "116", failureMessage: "No cuentas con fondos suficientes para completar la compra. Intenta nuevamente con otra tarjeta.", affiliateType: "ASOCIADO ACTIVO" };
const checkoutResult = { success: true, paymentId: 2, status: "PENDING" as const, amount: 300, registrationAmount: 150, membershipFeeAmount: 150, currency: "PEN" as const, message: "Sesión Niubiz creada.", checkout: { sessionToken: "token", merchantId: "merchant", purchaseNumber: "2", amount: 300, currency: "PEN" as const, checkoutUrl: "https://checkout.example.invalid", callbackUrl: "https://example.invalid/callback", expirationMinutes: 10, timeoutUrl: "https://example.invalid/timeout", merchantName: "IIMP", formButtonColor: "#C5A059" } };

describe("PaymentProcessStep", () => {
  it("presenta la alerta FAILED antes del resumen y reutiliza el botón normal de pago", () => {
    const markup = renderToStaticMarkup(<PaymentProcessStep {...props} confirmed paymentUiState="IDLE" showRestoredFailure result={checkoutResult} />);
    expect(markup.indexOf("Pago no aprobado")).toBeLessThan(markup.indexOf("Resumen final antes del pago"));
    expect(markup).toContain("No cuentas con fondos suficientes para completar la compra. Intenta nuevamente con otra tarjeta.");
    expect(markup).toContain("Código de soporte: 116");
    expect(markup).toContain("PAGA AQUÍ");
    expect(markup).not.toContain(">Intentar nuevamente<");
  });

  it("mantiene el botón normal bloqueado hasta confirmar la facturación", () => {
    const markup = renderToStaticMarkup(<PaymentProcessStep {...props} paymentUiState="IDLE" result={checkoutResult} />);
    expect(markup).toContain('<button disabled="">PAGA AQUÍ</button>');
  });

  it.each(["PAYMENT_UNCERTAIN", "PROCESSING_PAYMENT", "PAYMENT_SUCCESS"] as const)("no ofrece un nuevo checkout en %s", (paymentUiState) => {
    const markup = renderToStaticMarkup(<PaymentProcessStep {...props} paymentUiState={paymentUiState} result={null} />);
    expect(markup).not.toContain("PAGA AQUÍ");
  });

  it("muestra la confirmación formal de factura con los datos reales de Billing", () => {
    const markup = renderToStaticMarkup(<PaymentProcessStep {...props} paymentUiState="IDLE" />);
    expect(markup).toContain("FACTURA COMERCIAL");
    expect(markup).toContain("Razón social real");
    expect(markup).toContain("20107972090");
    expect(markup).toContain("ASOCIADO ACTIVO");
  });

  it("diferencia el fallo de inicialización de un pago rechazado", () => {
    const markup = renderToStaticMarkup(<PaymentProcessStep {...props} paymentUiState="INIT_FAILED" error="No se pudo conectar con el servicio de pagos." />);
    expect(markup).toContain("No pudimos iniciar el pago");
    expect(markup).not.toContain("Pago no aprobado");
    expect(markup).toContain("Intentar nuevamente");
  });
});
