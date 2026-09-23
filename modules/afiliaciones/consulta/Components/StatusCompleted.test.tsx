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
});
