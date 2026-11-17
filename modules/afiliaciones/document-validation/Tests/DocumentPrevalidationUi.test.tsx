import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DocumentPrevalidationNotice } from "../Components/DocumentPrevalidationNotice";
import {
  DocumentPrevalidationAdminCard,
  type DocumentPrevalidationAdminRecord,
} from "../Components/DocumentPrevalidationAdminCard";
import type { RuleEvaluationDTO } from "../Models/DocumentPrevalidationDTO";

const adminRecord: DocumentPrevalidationAdminRecord = {
  id: "p1",
  fileUrl: "https://s3.example/a.pdf",
  fileName: "constancia.pdf",
  status: "COMPLETED",
  result: "OBSERVED",
  extraction: {
    tipo_documento: "constancia_estudios",
    universidad: "UNSAAC",
    carrera: "Ingeniería de Minas",
    ciclo_academico: null,
    periodo_academico: "2022-II",
  },
  rules: [
    { code: "R06", label: "Vigencia académica", status: "FAIL", message: "El periodo 2022-II no está vigente." },
  ],
  warnings: ["No se identifica el ciclo académico"],
  modelUsed: "gemini-3.5-flash",
  modelVersion: "gemini-3.6-flash",
  rulesVersion: "1.0.0",
  promptVersion: "1.0.0",
  extractionSchemaVersion: "1.0.0",
  durationMs: 2470,
  cacheHit: false,
  errorCode: null,
  analyzedAt: "2026-11-16T12:00:00.000Z",
  createdAt: "2026-11-16T12:00:00.000Z",
};

describe("DocumentPrevalidation UI", () => {
  it("muestra la observación y la acción de reemplazo sin porcentajes", () => {
    const markup = renderToStaticMarkup(
      <DocumentPrevalidationNotice
        state="OBSERVED"
        message="El periodo 2022-II no está vigente."
        rules={adminRecord.rules as RuleEvaluationDTO[]}
        warnings={["No se identifica el ciclo académico"]}
        extraction={{ tipoDocumento: "constancia_estudios", universidad: "UNSAAC", carrera: "Ingeniería de Minas", cicloAcademico: null, periodoAcademico: "2022-II" }}
        durationMs={2470}
        onReplace={() => {}}
      />,
    );
    expect(markup).toContain("Constancia observada");
    expect(markup).toContain("Observada");
    expect(markup).toContain("Reemplazar documento");
    expect(markup).toContain("2022-II");
    expect(markup).not.toMatch(/%/);
  });

  it("muestra un estado de carga mientras la IA analiza el documento", () => {
    const markup = renderToStaticMarkup(
      <DocumentPrevalidationNotice state="PROCESSING" />,
    );
    expect(markup).toContain("Analizando");
    expect(markup).toContain("Analizando tu constancia de estudios");
    expect(markup).toContain('aria-busy="true"');
  });

  it("muestra un resultado favorable cuando la constancia es válida", () => {
    const markup = renderToStaticMarkup(
      <DocumentPrevalidationNotice state="PREVALIDATED" message="La constancia cumple los requisitos." />,
    );
    expect(markup).toContain("Válida");
    expect(markup).toContain("¡Constancia válida!");
    expect(markup).toContain("La constancia cumple los requisitos.");
  });

  it("diferencia el resultado de IA de la decisión administrativa", () => {
    const markup = renderToStaticMarkup(<DocumentPrevalidationAdminCard record={adminRecord} />);
    expect(markup).toContain("Resultado de IA");
    expect(markup).toContain("Observado por IA");
    expect(markup).toContain("La decisión final corresponde al Área de Asociados");
    expect(markup).toContain("no certifica la autenticidad");
  });

  it("muestra un error técnico sin ocultar la revisión administrativa", () => {
    const markup = renderToStaticMarkup(
      <DocumentPrevalidationAdminCard
        record={{ ...adminRecord, status: "TECHNICAL_ERROR", result: null, errorCode: "TIMEOUT" }}
      />,
    );
    expect(markup).toContain("Error técnico");
    expect(markup).toContain("TIMEOUT");
    expect(markup).toContain("revisión administrativa");
  });
});
