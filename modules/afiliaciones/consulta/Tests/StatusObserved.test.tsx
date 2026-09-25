import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { StatusObserved } from "../Components/StatusObserved";

const observedData = () => ({
  id: 1,
  applicationCode: "APP-1790289120377",
  trackingCode: "private-1",
  status: "OBSERVED",
  expirationDate: "5 días",
  pendingObservations: [
    {
      id: 1,
      department: "ASOCIADOS",
      message: "Faltan los datos que se señalan a continuación: Fecha de nacimiento y Dirección.",
      fieldPaths: ["personalInformation.birthDate", "personalInformation.address"],
    },
  ],
  observations: ["Faltan los datos que se señalan a continuación: Fecha de nacimiento y Dirección."],
  draftData: {
    personalInformation: { birthDate: "2008-09-01", address: "Av. Prueba 123", phone: "999888777" },
  },
  areas: { sponsors: { status: "APPROVED", approvedCount: 2, requiredCount: 2 } },
});

describe("StatusObserved (subsanación directa)", () => {
  it("muestra directamente la subsanación sin paso intermedio ni botón 'Revisar y subsanar'", () => {
    const markup = renderToStaticMarkup(<StatusObserved data={observedData() as never} />);
    expect(markup).toContain("Tienes observaciones por subsanar");
    expect(markup).not.toContain("Revisar y subsanar");
  });

  it("muestra la observación real del evaluador y el conteo de campos solicitados", () => {
    const markup = renderToStaticMarkup(<StatusObserved data={observedData() as never} />);
    expect(markup).toContain("Observación del evaluador");
    expect(markup).toContain("Faltan los datos que se señalan a continuación: Fecha de nacimiento y Dirección.");
    expect(markup).toContain("Campos solicitados: 2");
  });

  it("muestra únicamente los campos observados, el plazo y la ayuda de edición", () => {
    const markup = renderToStaticMarkup(<StatusObserved data={observedData() as never} />);
    expect(markup).toContain("Información a corregir");
    expect(markup).toContain("Fecha de nacimiento");
    expect(markup).toContain("Dirección");
    expect(markup).not.toContain("Celular");
    expect(markup).toContain("Vence en 5 días");
    expect(markup).toContain("Solo puedes modificar los campos solicitados por el evaluador.");
  });

  it("mantiene 'Guardar correcciones' deshabilitado sin cambios y explica el envío", () => {
    const markup = renderToStaticMarkup(<StatusObserved data={observedData() as never} />);
    expect(markup).toContain("Guardar correcciones");
    expect(markup).toContain("Al guardar, tus correcciones serán remitidas nuevamente para evaluación.");
    expect(markup).toContain("disabled");
  });
});
