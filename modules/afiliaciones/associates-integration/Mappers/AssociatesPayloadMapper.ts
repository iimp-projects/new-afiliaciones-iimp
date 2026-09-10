import { isValidBillingDocument } from "@/modules/afiliaciones/payments/Rules/BillingDocumentRules";
import type { AssociateRequestPayloadSnapshot } from "../Models/AssociateIntegration";

export class AssociatesPayloadValidationError extends Error { constructor(message: string) { super(message); this.name = "AssociatesPayloadValidationError"; } }

export class AssociatesPayloadMapper {
  map(snapshot: AssociateRequestPayloadSnapshot): AssociateRequestPayloadSnapshot {
    const payload = { ...snapshot, TipoDocumento: documentType(snapshot.TipoDocumento), Tipo: affiliateType(snapshot.Tipo), Sexo: sex(snapshot.Sexo), servicios: snapshot.servicios.map(service) } as AssociateRequestPayloadSnapshot;
    if (!payload.NumDocumento.trim() || !payload.Nombres.trim() || !payload.ApellidoPaterno.trim() || !payload.ApellidoMaterno.trim() || !payload.Direccion.trim() || !payload.Telefono.trim() || !payload.Email.trim()) throw new AssociatesPayloadValidationError("El snapshot no contiene todos los datos obligatorios del socio para alta.");
    if (payload.Sexo === undefined) delete (payload as { Sexo?: "M" | "F" }).Sexo;
    validateServices(payload);
    validateBilling(payload);
    return payload;
  }
}

function documentType(value: unknown): "1" | "4" | "7" { const map: Record<string, "1" | "4" | "7"> = { DNI: "1", CE: "4", PASSPORT: "7", "1": "1", "4": "4", "7": "7" }; const mapped = typeof value === "string" ? map[value] : undefined; if (!mapped) throw new AssociatesPayloadValidationError("Tipo de documento del asociado no soportado para V1."); return mapped; }
function affiliateType(value: unknown): "A" | "E" { const map: Record<string, "A" | "E"> = { ACTIVE: "A", STUDENT: "E", A: "A", E: "E" }; const mapped = typeof value === "string" ? map[value] : undefined; if (!mapped) throw new AssociatesPayloadValidationError("Tipo de asociado no soportado para V1."); return mapped; }
function sex(value: unknown): "M" | "F" | undefined { return value === "MALE" || value === "M" ? "M" : value === "FEMALE" || value === "F" ? "F" : undefined; }
function service(value: AssociateRequestPayloadSnapshot["servicios"][number]) { if (!(value.concepto === "INSCRIPCION" || value.concepto === "CUOTA") || !Number.isInteger(value.anno) || value.anno < 2000 || value.anno > 9999 || value.moneda !== "S/" || !Number.isFinite(value.monto) || value.monto < 0 || (value.monto === 0 && !value.cortesia)) throw new AssociatesPayloadValidationError("El snapshot contiene un servicio inválido."); return value; }
function validateServices(payload: AssociateRequestPayloadSnapshot) {
  if (payload.servicios.length !== 2 || new Set(payload.servicios.map((item) => item.concepto)).size !== 2) throw new AssociatesPayloadValidationError("V1 requiere exactamente INSCRIPCION y CUOTA.");
  if (payload.Tipo === "E" && payload.servicios.some((item) => item.monto !== 0 || !item.cortesia)) throw new AssociatesPayloadValidationError("Estudiante V1 requiere servicios de cortesía con monto cero.");
}
function validateBilling(payload: AssociateRequestPayloadSnapshot) {
  if (payload.TipoFacturacion === "01") { if (payload.TipDocFacturacion !== "6" || !isValidBillingDocument("RUC", payload.NumDocFacturacion) || !payload.RazonSocial?.trim() || !payload.DirFacturacion.trim()) throw new AssociatesPayloadValidationError("Factura V1 requiere RUC válido, razón social y dirección."); return; }
  const type = payload.TipDocFacturacion === "1" ? "DNI" : payload.TipDocFacturacion === "4" ? "CE" : payload.TipDocFacturacion === "7" ? "PASSPORT" : null;
  if (payload.TipoFacturacion !== "03" || !type || !validPersonalDocument(type, payload.NumDocFacturacion) || !payload.ApellidoPaternoFact?.trim() || !payload.ApellidoMaternoFact?.trim() || !payload.NombresFact?.trim() || !payload.DirFacturacion.trim()) throw new AssociatesPayloadValidationError("Boleta V1 requiere documento personal y nombres desagregados.");
}
function validPersonalDocument(type: "DNI" | "CE" | "PASSPORT", value: string) { if (type === "DNI") return isValidBillingDocument("DNI", value); if (type === "CE") return /^[A-Za-z0-9]{1,15}$/.test(value); return /^[A-Za-z0-9]{1,15}$/.test(value); }
