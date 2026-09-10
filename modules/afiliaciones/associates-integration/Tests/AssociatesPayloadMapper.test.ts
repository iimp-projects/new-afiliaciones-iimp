import { describe, expect, it } from "vitest";
import { AssociatesPayloadMapper, AssociatesPayloadValidationError } from "../Mappers/AssociatesPayloadMapper";
import type { AssociateRequestPayloadSnapshot } from "../Models/AssociateIntegration";

const base = (): AssociateRequestPayloadSnapshot => ({ TipoDocumento: "1", NumDocumento: "72183002", Tipo: "A", Nombres: "Max", ApellidoPaterno: "Ichijaya", ApellidoMaterno: "Sanchez", Direccion: "Av. Costa Azul", Telefono: "987654321", Email: "max@example.com", TipoFacturacion: "03", TipDocFacturacion: "1", NumDocFacturacion: "72183002", ApellidoPaternoFact: "Ichijaya", ApellidoMaternoFact: "Sanchez", NombresFact: "Max", DirFacturacion: "Av. Costa Azul", servicios: [{ concepto: "INSCRIPCION", anno: 2026, moneda: "S/", monto: 150, cortesia: false }, { concepto: "CUOTA", anno: 2026, moneda: "S/", monto: 150, cortesia: false }] });

describe("AssociatesPayloadMapper", () => {
  const mapper = new AssociatesPayloadMapper();
  it("acepta y preserva DNI, CE y PASSPORT; rechaza OTHER", () => {
    expect(mapper.map(base()).TipoDocumento).toBe("1");
    expect(mapper.map({ ...base(), TipoDocumento: "4" }).TipoDocumento).toBe("4");
    expect(mapper.map({ ...base(), TipoDocumento: "7", TipDocFacturacion: "7", NumDocFacturacion: "P123", servicios: [{ concepto: "INSCRIPCION", anno: 2026, moneda: "S/", monto: 0, cortesia: true }, { concepto: "CUOTA", anno: 2026, moneda: "S/", monto: 0, cortesia: true }] }).TipoDocumento).toBe("7");
    expect(() => mapper.map({ ...base(), TipoDocumento: "OTHER" as never })).toThrow(AssociatesPayloadValidationError);
  });
  it("mapea valores internos semánticos y omite sexo no soportado", () => {
    expect(mapper.map({ ...base(), TipoDocumento: "DNI" as never, Tipo: "ACTIVE" as never, Sexo: "MALE" as never })).toMatchObject({ TipoDocumento: "1", Tipo: "A", Sexo: "M" });
    expect(mapper.map({ ...base(), Sexo: "OTHER" as never }).Sexo).toBeUndefined();
    expect(mapper.map({ ...base(), Sexo: "FEMALE" as never }).Sexo).toBe("F");
  });
  it("valida factura RUC, boleta personal y servicios", () => {
    expect(mapper.map({ ...base(), TipoFacturacion: "01", TipDocFacturacion: "6", NumDocFacturacion: "20107972090", RazonSocial: "Empresa", ApellidoPaternoFact: undefined, ApellidoMaternoFact: undefined, NombresFact: undefined })).toMatchObject({ TipoFacturacion: "01", TipDocFacturacion: "6" });
    expect(() => mapper.map({ ...base(), TipoFacturacion: "01", TipDocFacturacion: "1" })).toThrow(AssociatesPayloadValidationError);
    expect(() => mapper.map({ ...base(), servicios: [{ concepto: "CUOTA", anno: 2026, moneda: "S/", monto: 0, cortesia: false }] })).toThrow(AssociatesPayloadValidationError);
    expect(() => mapper.map({ ...base(), Email: "" })).toThrow(AssociatesPayloadValidationError);
  });
});
