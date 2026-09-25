import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import confetti from "canvas-confetti";
import FinishStep from "./FinishStep";
import { MembershipType } from "../../Types/MembershipType";

vi.mock("canvas-confetti", () => ({ default: vi.fn() }));

describe("FinishStep", () => {
  it("renderiza el último paso sin disparar confetti al montar", () => {
    const markup = renderToStaticMarkup(
      <FinishStep
        membershipType={MembershipType.ACTIVE}
        onSubmitApplication={vi.fn()}
        onNext={vi.fn()}
        onBack={vi.fn()}
      />,
    );

    expect(markup).toContain("Postulación Lista para Enviar");
    expect(markup).toContain("Asociado Activo");
    expect(confetti).not.toHaveBeenCalled();
  });
});
