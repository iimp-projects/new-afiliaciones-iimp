import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/modules/afiliaciones/payments/Components/NiubizCheckout", () => ({
  NiubizCheckout: () => <button disabled>PAGA AQUÍ</button>,
}));
vi.mock("@/modules/afiliaciones/payments/Components/PaymentLoadingOverlay", () => ({
  PaymentLoadingOverlay: () => <div role="status" />,
}));

import PaymentProcessStep from "./PaymentProcessStep";

const billingData = { tipoDocumento: "RUC" as const, numeroDocumento: "20107972090", razonSocial: "Razón social real", direccionFiscal: "Av. Principal 123", responsable: "Responsable real", emailFacturacion: "facturacion@example.com" };
const props = { billingData, confirmed: false, onConfirmedChange: vi.fn(), result: null, loading: false, error: null, onRetry: vi.fn(), paymentUiState: "PAYMENT_FAILED" as const, onCheckoutStateChange: vi.fn(), failureCode: "116", failureMessage: "Pago no aprobado", affiliateType: "ASOCIADO ACTIVO" };

describe("PaymentProcessStep", () => {
  it("presenta la alerta FAILED antes del resumen y mantiene el reintento fuera de ella", () => {
    const markup = renderToStaticMarkup(<PaymentProcessStep {...props} />);
    expect(markup.indexOf("Pago no aprobado")).toBeLessThan(markup.indexOf("Resumen final antes del pago"));
    expect(markup.lastIndexOf("Intentar nuevamente")).toBeGreaterThan(markup.indexOf("Código de soporte: 116"));
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
