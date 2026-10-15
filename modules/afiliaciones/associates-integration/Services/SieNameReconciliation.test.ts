import { describe, expect, it } from "vitest";
import {
  areNameMultisetsEqual,
  classifyReconciliation,
  normalizeNameComponent,
  tokenizeName,
} from "./SieNameReconciliation";

describe("normalizeNameComponent", () => {
  it("quita tildes, minúsculas y puntuación", () => {
    expect(normalizeNameComponent("María José")).toBe("maria jose");
    expect(normalizeNameComponent("SANTISTEBAN,  ")).toBe("santisteban");
    expect(normalizeNameComponent("Yépez-Silva")).toBe("yepez silva");
  });
});

describe("tokenizeName", () => {
  it("une nombres y apellidos en componentes normalizados", () => {
    expect(tokenizeName({ nombres: "CAMILA ANASTASIA", apellidoPaterno: "YEPEZ", apellidoMaterno: "SILVA SANTISTEBAN" })).toEqual([
      "camila", "anastasia", "yepez", "silva", "santisteban",
    ]);
  });
});

describe("areNameMultisetsEqual", () => {
  it("coincide cuando los componentes están en distinto orden/distribución", () => {
    // SIE: nombres "CAMILA ANASTASIA", apPaterno "YEPEZ", apMaterno "SILVA SANTISTEBAN"
    // Persona: first "SANTISTEBAN", paterno "CAMILA ANASTASIA", materno "YEPEZ SILVA"
    expect(
      areNameMultisetsEqual(
        { nombres: "CAMILA ANASTASIA", apellidoPaterno: "YEPEZ", apellidoMaterno: "SILVA SANTISTEBAN" },
        { firstName: "SANTISTEBAN", paternalLastName: "CAMILA ANASTASIA", maternalLastName: "YEPEZ SILVA" },
      ),
    ).toBe(true);
  });

  it("NO coincide si falta o sobra un componente", () => {
    expect(
      areNameMultisetsEqual(
        { nombres: "CAMILA ANASTASIA", apellidoPaterno: "YEPEZ", apellidoMaterno: "SILVA" },
        { firstName: "SANTISTEBAN", paternalLastName: "CAMILA ANASTASIA", maternalLastName: "YEPEZ SILVA" },
      ),
    ).toBe(false);
  });

  it("respeta componentes repetidos (multiconjunto)", () => {
    expect(
      areNameMultisetsEqual(
        { nombres: "JUAN JUAN", apellidoPaterno: "PEREZ", apellidoMaterno: "GOMEZ" },
        { firstName: "JUAN", paternalLastName: "PEREZ", maternalLastName: "JUAN GOMEZ" },
      ),
    ).toBe(true);
    expect(
      areNameMultisetsEqual(
        { nombres: "JUAN", apellidoPaterno: "PEREZ", apellidoMaterno: "GOMEZ" },
        { firstName: "JUAN", paternalLastName: "PEREZ", maternalLastName: "GOMEZ" },
      ),
    ).toBe(true);
  });
});

describe("classifyReconciliation", () => {
  const sie = { nombres: "CAMILA ANASTASIA", apellidoPaterno: "YEPEZ", apellidoMaterno: "SILVA SANTISTEBAN" };
  const person = { firstName: "SANTISTEBAN", paternalLastName: "CAMILA ANASTASIA", maternalLastName: "YEPEZ SILVA" };
  const okCtx = { singleCandidate: true, alreadyLinkedToOtherCode: false, hasCompletedApplication: false };

  it("SAFE_MATCH con documento único, sin vínculo previo y multiconjunto igual", () => {
    expect(classifyReconciliation(sie, person, okCtx)).toBe("SAFE_MATCH");
  });

  it("MANUAL_REVIEW con múltiples candidatos", () => {
    expect(classifyReconciliation(sie, person, { ...okCtx, singleCandidate: false })).toBe("MANUAL_REVIEW");
  });

  it("MANUAL_REVIEW si ya está vinculada a otro código", () => {
    expect(classifyReconciliation(sie, person, { ...okCtx, alreadyLinkedToOtherCode: true })).toBe("MANUAL_REVIEW");
  });

  it("MANUAL_REVIEW si tiene postulación COMPLETED", () => {
    expect(classifyReconciliation(sie, person, { ...okCtx, hasCompletedApplication: true })).toBe("MANUAL_REVIEW");
  });

  it("MANUAL_REVIEW si los nombres no coinciden", () => {
    expect(
      classifyReconciliation(sie, { firstName: "OTRO", paternalLastName: "NOMBRE", maternalLastName: null }, okCtx),
    ).toBe("MANUAL_REVIEW");
  });
});
