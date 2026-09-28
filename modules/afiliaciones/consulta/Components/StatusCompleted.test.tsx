import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { ApplicationStatusData } from "../Models/ApplicationStatus";

vi.mock("canvas-confetti", () => ({ default: vi.fn() }));
vi.mock("next/image", () => ({ default: (props: { alt: string }) => <span aria-label={props.alt} /> }));

import { StatusCompleted } from "./StatusCompleted";

describe("StatusCompleted", () => {
  it("no expone el código de seguimiento al postulante", () => {
    const data = {
      status: "COMPLETED",
      affiliateType: "ACTIVE",
      applicationCode: "EXP-001",
      trackingCode: "uuid-que-no-debe-renderizarse",
      applicantName: "Postulante IIMP",
      draftData: { personalInformation: { documentNumber: "12345678", email: "postulante@example.com" } },
    } as ApplicationStatusData;

    const markup = renderToStaticMarkup(<StatusCompleted data={data} onFinish={vi.fn()} />);

    expect(markup).toContain("Tu afiliación ha sido completada");
    expect(markup).toContain("Cerrar / Finalizar");
    expect(markup).toContain("EXP-001");
    expect(markup).not.toContain("uuid-que-no-debe-renderizarse");
    expect(markup).not.toContain("Código de seguimiento");
  });

  const completedPayment = {
    id: 1,
    status: "PAID" as const,
    amount: 300,
    currency: "PEN",
    gateway: "NIUBIZ",
    transactionId: "tx-1",
    paymentChannel: "web",
    cardBrand: "visa",
    cardType: "D",
    maskedCard: "455788******3051",
  };

  it("WALLET/YAPE: muestra Yape y oculta la metadata de tarjeta", () => {
    const data = {
      status: "COMPLETED",
      affiliateType: "ACTIVE",
      applicationCode: "EXP-002",
      applicantName: "Postulante IIMP",
      draftData: { personalInformation: { documentNumber: "12345678", email: "postulante@example.com" } },
      completedPayment: { ...completedPayment, paymentMethod: "WALLET", paymentBrand: "YAPE" },
    } as ApplicationStatusData;

    const markup = renderToStaticMarkup(<StatusCompleted data={data} onFinish={vi.fn()} />);

    expect(markup).toContain("Yape");
    expect(markup).toContain("Proveedor / canal");
    expect(markup).not.toContain("Marca");
    expect(markup).not.toContain("Débito");
    expect(markup).not.toContain("455788******3051");
    expect(markup).not.toContain("Tarjeta enmascarada");
  });

  it("UNKNOWN: muestra No identificado y no interpreta metadata histórica como tarjeta", () => {
    const data = {
      status: "COMPLETED",
      affiliateType: "ACTIVE",
      applicationCode: "EXP-003",
      applicantName: "Postulante IIMP",
      draftData: { personalInformation: { documentNumber: "12345678", email: "postulante@example.com" } },
      completedPayment: { ...completedPayment, paymentMethod: "UNKNOWN" },
    } as ApplicationStatusData;

    const markup = renderToStaticMarkup(<StatusCompleted data={data} onFinish={vi.fn()} />);

    expect(markup).toContain("No identificado");
    expect(markup).not.toContain("Marca");
    expect(markup).not.toContain("Débito");
    expect(markup).not.toContain("455788******3051");
  });

  it("CARD: muestra Tarjeta con marca, tipo y tarjeta enmascarada", () => {
    const data = {
      status: "COMPLETED",
      affiliateType: "ACTIVE",
      applicationCode: "EXP-004",
      applicantName: "Postulante IIMP",
      draftData: { personalInformation: { documentNumber: "12345678", email: "postulante@example.com" } },
      completedPayment: { ...completedPayment, paymentMethod: "CARD" },
    } as ApplicationStatusData;

    const markup = renderToStaticMarkup(<StatusCompleted data={data} onFinish={vi.fn()} />);

    expect(markup).toContain("Tarjeta");
    expect(markup).toContain("Marca");
    expect(markup).toContain("Débito");
    expect(markup).toContain("455788******3051");
  });
});
