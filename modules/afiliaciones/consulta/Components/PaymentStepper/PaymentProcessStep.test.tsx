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
const props = { billingData, confirmed: false, onConfirmedChange: vi.fn(), termsAccepted: false, onTermsAcceptedChange: vi.fn(), majorityAccepted: false, onMajorityAcceptedChange: vi.fn(), result: null, loading: false, error: null, onRetry: vi.fn(), paymentUiState: "PAYMENT_FAILED" as const, onCheckoutStateChange: vi.fn(), failureCode: "116", failureMessage: "No cuentas con fondos suficientes para completar la compra. Intenta nuevamente con otra tarjeta.", affiliateType: "ASOCIADO ACTIVO" };
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

  it("mantiene el botón bloqueado hasta aceptar términos y mayoría de edad", () => {
    const markup = renderToStaticMarkup(<PaymentProcessStep {...props} confirmed paymentUiState="IDLE" result={checkoutResult} />);
    expect(markup).toContain('<button disabled="">PAGA AQUÍ</button>');
  });

  it("habilita el botón cuando facturación, términos y mayoría de edad están aceptados", () => {
    const markup = renderToStaticMarkup(<PaymentProcessStep {...props} confirmed termsAccepted majorityAccepted paymentUiState="IDLE" result={checkoutResult} />);
    expect(markup).toContain("<button>PAGA AQUÍ</button>");
  });

  it("muestra los checkboxes de términos y mayoría de edad", () => {
    const markup = renderToStaticMarkup(<PaymentProcessStep {...props} paymentUiState="IDLE" />);
    expect(markup).toContain("He leído y acepto los");
    expect(markup).toContain("Términos y Condiciones de Afiliación y Pago del IIMP");
    expect(markup).toContain("Declaro ser mayor de edad");
    expect(markup).toContain('type="checkbox"');
  });

  it("enlaza el PDF de Términos y Condiciones en una pestaña nueva", () => {
    const markup = renderToStaticMarkup(<PaymentProcessStep {...props} paymentUiState="IDLE" />);
    expect(markup).toContain('href="/docs/terminos-condiciones.pdf"');
    expect(markup).toContain('target="_blank"');
    expect(markup).toContain('rel="noopener noreferrer"');
    expect(markup).toContain("Leer Términos y Condiciones");
  });

  it("incluye la sección de contacto institucional con correo y teléfono", () => {
    const markup = renderToStaticMarkup(<PaymentProcessStep {...props} paymentUiState="IDLE" />);
    expect(markup).toContain("¿Necesitas ayuda con tu afiliación?");
    expect(markup).toContain("mailto:liset.otoya@iimp.org.pe");
    expect(markup).toContain("tel:+51982097019");
    expect(markup).toContain("Los Canarios 155, Lima 15021, Perú");
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
