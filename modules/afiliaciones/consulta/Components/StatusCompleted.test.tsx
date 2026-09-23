import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { ApplicationStatusData } from "../Models/ApplicationStatus";

vi.mock("canvas-confetti", () => ({ default: vi.fn() }));
vi.mock("next/image", () => ({ default: (props: { alt: string }) => <span aria-label={props.alt} /> }));

import { StatusCompleted } from "./StatusCompleted";

describe("StatusCompleted", () => {
  it("restaura la presentación final vigente antes de los cambios locales de Niubiz", () => {
    const data = {
      status: "COMPLETED",
      affiliateType: "ACTIVE",
      applicationCode: "EXP-001",
      trackingCode: "must-not-be-rendered",
      applicantName: "Postulante IIMP",
      draftData: { personalInformation: { documentNumber: "12345678", email: "postulante@example.com" } },
    } as ApplicationStatusData;

    const markup = renderToStaticMarkup(<StatusCompleted data={data} onFinish={vi.fn()} />);

    expect(markup).toContain("Tu afiliación ha sido completada");
    expect(markup).toContain("Cerrar / Finalizar");
    expect(markup).toContain("must-not-be-rendered");
    expect(markup).toContain("Código de seguimiento");
  });
});
