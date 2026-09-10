import type { AssociateRequestPayloadSnapshot } from "../Models/AssociateIntegration";
import { getMembershipYear } from "../Utils/MembershipYear";

type Identity = Omit<AssociateRequestPayloadSnapshot, "Tipo" | "servicios">;

export type AssociateSnapshotSource = {
  documentType: string;
  documentNumber: string;
  email: string;
  phone: string;
  person: { firstName: string; paternalLastName: string; maternalLastName: string | null; gender: string | null; addresses: { street: string; isPrimary: boolean }[] } | null;
  billing?: { taxId: string; businessName: string; billingAddress: string | null; billingEmail: string | null; documentType: string | null; receiptType: string | null; billingContact: string | null } | null;
};

export class AssociateSnapshotBuildError extends Error {
  constructor(readonly code: string, message: string) { super(message); this.name = "AssociateSnapshotBuildError"; }
}

/** Builds immutable, payload-shaped snapshots; it performs no external I/O. */
export class AssociateIntegrationSnapshotBuilder {
  active(identity: Identity, effectiveAt: Date, amounts: { registration: number; monthlyFee: number }): AssociateRequestPayloadSnapshot {
    return { ...identity, Tipo: "A", servicios: [service("INSCRIPCION", effectiveAt, amounts.registration, false), service("CUOTA", effectiveAt, amounts.monthlyFee, false)] };
  }
  student(identity: Identity, effectiveAt: Date): AssociateRequestPayloadSnapshot {
    return { ...identity, Tipo: "E", servicios: [service("INSCRIPCION", effectiveAt, 0, true), service("CUOTA", effectiveAt, 0, true)] };
  }

  activeFrom(source: AssociateSnapshotSource, effectiveAt: Date, amounts: { registration: number; monthlyFee: number; total: number }): AssociateRequestPayloadSnapshot {
    if (!Number.isFinite(amounts.registration) || !Number.isFinite(amounts.monthlyFee) || !Number.isFinite(amounts.total) || amounts.registration < 0 || amounts.monthlyFee < 0 || Math.round((amounts.registration + amounts.monthlyFee) * 100) !== Math.round(amounts.total * 100)) throw new AssociateSnapshotBuildError("INVALID_PAYMENT_BREAKDOWN", "El desglose persistido del pago no coincide con el total.");
    return this.active(this.identity(source, true), effectiveAt, { registration: amounts.registration, monthlyFee: amounts.monthlyFee });
  }

  studentFrom(source: AssociateSnapshotSource, effectiveAt: Date): AssociateRequestPayloadSnapshot {
    return this.student(this.identity(source, false), effectiveAt);
  }

  failedSnapshot(source: AssociateSnapshotSource, tipo: "A" | "E"): AssociateRequestPayloadSnapshot {
    const person = source.person;
    const billing = source.billing;
    return {
      TipoDocumento: source.documentType as "1",
      NumDocumento: source.documentNumber || "",
      Tipo: tipo,
      Nombres: person?.firstName || "",
      ApellidoPaterno: person?.paternalLastName || "",
      ApellidoMaterno: person?.maternalLastName || "",
      Direccion: person?.addresses.find((address) => address.isPrimary)?.street || person?.addresses[0]?.street || "",
      Telefono: source.phone || "",
      Email: source.email || "",
      TipoFacturacion: billing?.receiptType === "FACTURA" ? "01" : "03",
      TipDocFacturacion: (billing?.documentType === "RUC" ? "6" : billing?.documentType === "CE" ? "4" : billing?.documentType === "DNI" ? "1" : source.documentType === "PASSPORT" ? "7" : "") as "1",
      NumDocFacturacion: billing?.taxId || source.documentNumber || "",
      RazonSocial: billing?.businessName || undefined,
      DirFacturacion: billing?.billingAddress || "",
      NombreContactoFact: billing?.billingContact || undefined,
      CorreoContactoFact: billing?.billingEmail || undefined,
      servicios: [],
    };
  }

  private identity(source: AssociateSnapshotSource, useBilling: boolean): Identity {
    const person = source.person;
    const billing = source.billing;
    if (!person?.firstName?.trim() || !person.paternalLastName?.trim() || !person.maternalLastName?.trim()) throw new AssociateSnapshotBuildError("MISSING_ASSOCIATE_IDENTITY", "Faltan nombres completos persistidos para integrar al asociado.");
    const address = person.addresses.find((item) => item.isPrimary)?.street || person.addresses[0]?.street;
    if (!address?.trim()) throw new AssociateSnapshotBuildError("MISSING_ASSOCIATE_ADDRESS", "Falta dirección persistida para integrar al asociado.");
    const personalBilling = !useBilling;
    if (personalBilling) return { TipoDocumento: source.documentType as "1", NumDocumento: source.documentNumber, Nombres: person.firstName, ApellidoPaterno: person.paternalLastName, ApellidoMaterno: person.maternalLastName, Direccion: address, Telefono: source.phone, Email: source.email, Sexo: person.gender === "MALE" ? "M" : person.gender === "FEMALE" ? "F" : undefined, TipoFacturacion: "03", TipDocFacturacion: source.documentType === "DNI" ? "1" : source.documentType === "CE" ? "4" : source.documentType === "PASSPORT" ? "7" : "" as "1", NumDocFacturacion: source.documentNumber, ApellidoPaternoFact: person.paternalLastName, ApellidoMaternoFact: person.maternalLastName, NombresFact: person.firstName, DirFacturacion: address };
    if (!billing) throw new AssociateSnapshotBuildError("MISSING_BILLING", "Falta la facturación persistida del pago.");
    if (billing.receiptType === "FACTURA" && billing.documentType === "RUC") return { TipoDocumento: source.documentType as "1", NumDocumento: source.documentNumber, Nombres: person.firstName, ApellidoPaterno: person.paternalLastName, ApellidoMaterno: person.maternalLastName, Direccion: address, Telefono: source.phone, Email: source.email, Sexo: person.gender === "MALE" ? "M" : person.gender === "FEMALE" ? "F" : undefined, TipoFacturacion: "01", TipDocFacturacion: "6", NumDocFacturacion: billing.taxId, RazonSocial: billing.businessName, DirFacturacion: billing.billingAddress || "", NombreContactoFact: billing.billingContact || undefined, CorreoContactoFact: billing.billingEmail || undefined };
    if (billing.receiptType !== "BOLETA" || billing.taxId !== source.documentNumber || !billing.documentType) throw new AssociateSnapshotBuildError("UNSUPPORTED_BILLING", "La facturación persistida no corresponde a un caso soportado para integración V1.");
    return { TipoDocumento: source.documentType as "1", NumDocumento: source.documentNumber, Nombres: person.firstName, ApellidoPaterno: person.paternalLastName, ApellidoMaterno: person.maternalLastName, Direccion: address, Telefono: source.phone, Email: source.email, Sexo: person.gender === "MALE" ? "M" : person.gender === "FEMALE" ? "F" : undefined, TipoFacturacion: "03", TipDocFacturacion: billing.documentType === "DNI" ? "1" : billing.documentType === "CE" ? "4" : "" as "1", NumDocFacturacion: billing.taxId, ApellidoPaternoFact: person.paternalLastName, ApellidoMaternoFact: person.maternalLastName, NombresFact: person.firstName, DirFacturacion: billing.billingAddress || address, NombreContactoFact: billing.billingContact || undefined, CorreoContactoFact: billing.billingEmail || undefined };
  }
}

function service(concepto: "INSCRIPCION" | "CUOTA", effectiveAt: Date, monto: number, cortesia: boolean) {
  if (!Number.isFinite(monto) || monto < 0 || (monto === 0 && !cortesia)) throw new Error(`Monto inválido para ${concepto}.`);
  return { concepto, anno: getMembershipYear(effectiveAt), moneda: "S/" as const, monto, cortesia };
}
