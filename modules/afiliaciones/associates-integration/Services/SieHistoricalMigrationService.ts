import { mapSieDocumentType } from "../Mappers/SieAssociateListMapper";
import type { SanitizedSieAssociate } from "../Models/SieAssociateList";

export type PersonResolution =
  | { kind: "CREATE" }
  | { kind: "LINK"; personId: number }
  | { kind: "CONFLICT"; personId: number }
  | { kind: "DOCUMENT_TYPE_UNMAPPED" }
  | { kind: "MISSING_REQUIRED_DATA" };

export type AddressResolution =
  | { kind: "RESOLVED_LOCAL"; countryId: number; districtId: number }
  | { kind: "FOREIGN"; countryId: number }
  | { kind: "DEFERRED" }
  | { kind: "NO_DATA" };

export type ExistingPerson = {
  id: number;
  firstName: string;
  paternalLastName: string;
  maternalLastName: string | null;
  email: string | null;
  phone: string | null;
  street: string | null;
};

export type GeoResolution = {
  countryId: number | null;
  countryIsPeru: boolean;
  departmentId: number | null;
  provinceId: number | null;
  districtId: number | null;
};

export type MigrationPlan = {
  person: PersonResolution;
  address: AddressResolution;
  hasContact: boolean;
  linkStatus: "LINKED" | "UNLINKED" | "CONFLICT";
};

function norm(value: string | null | undefined): string {
  if (!value) return "";
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

export function hasPersonDataConflict(record: SanitizedSieAssociate, existing: ExistingPerson): boolean {
  if (record.nombres && existing.firstName && norm(record.nombres) !== norm(existing.firstName)) return true;
  if (record.apellidoPaterno && existing.paternalLastName && norm(record.apellidoPaterno) !== norm(existing.paternalLastName)) return true;
  if (record.apellidoMaterno && existing.maternalLastName && norm(record.apellidoMaterno) !== norm(existing.maternalLastName)) return true;
  if (record.correo && existing.email && norm(record.correo) !== norm(existing.email)) return true;
  if (record.telefono && existing.phone && norm(record.telefono) !== norm(existing.phone)) return true;
  if (record.direccion && existing.street && norm(record.direccion) !== norm(existing.street)) return true;
  return false;
}

export function classifyPerson(record: SanitizedSieAssociate, existing: ExistingPerson | null): PersonResolution {
  if (!mapSieDocumentType(record.documentType) || !record.documentNumber) return { kind: "DOCUMENT_TYPE_UNMAPPED" };
  if (existing) {
    return hasPersonDataConflict(record, existing) ? { kind: "CONFLICT", personId: existing.id } : { kind: "LINK", personId: existing.id };
  }
  if (!record.nombres || !record.apellidoPaterno) return { kind: "MISSING_REQUIRED_DATA" };
  return { kind: "CREATE" };
}

export function classifyAddress(record: SanitizedSieAssociate, geo: GeoResolution): AddressResolution {
  const hasGeo = Boolean(record.paisNombre || record.departamentoNombre || record.provinciaNombre || record.distritoNombre || record.direccion);
  if (!hasGeo) return { kind: "NO_DATA" };
  if (geo.districtId && geo.countryId) return { kind: "RESOLVED_LOCAL", countryId: geo.countryId, districtId: geo.districtId };
  if (geo.countryId && !geo.countryIsPeru) return { kind: "FOREIGN", countryId: geo.countryId };
  return { kind: "DEFERRED" };
}

export function buildPlan(record: SanitizedSieAssociate, existing: ExistingPerson | null, geo: GeoResolution): MigrationPlan {
  const person = classifyPerson(record, existing);
  const address = classifyAddress(record, geo);
  const hasContact = Boolean(record.correo || record.telefono);
  let linkStatus: MigrationPlan["linkStatus"];
  if (person.kind === "CREATE" || person.kind === "LINK") linkStatus = "LINKED";
  else if (person.kind === "CONFLICT") linkStatus = "CONFLICT";
  else linkStatus = "UNLINKED";
  return { person, address, hasContact, linkStatus };
}

export type DryRunReport = {
  targetRecords: number;
  wouldCreatePerson: number;
  wouldLinkExistingPerson: number;
  personConflicts: number;
  documentTypeUnmapped: number;
  missingRequiredData: number;
  wouldCreateContact: number;
  wouldCreateSieRecord: number;
  wouldLinkSieRecord: number;
  addressResolvedLocal: number;
  addressForeign: number;
  addressDeferred: number;
  addressSkippedNoData: number;
  usersToCreate: number;
  credentialsToCreate: number;
  successfullyLinked: number;
  manualReview: number;
  unaccounted: number;
};

export function buildDryRunReport(plans: MigrationPlan[]): DryRunReport {
  const report: DryRunReport = {
    targetRecords: plans.length,
    wouldCreatePerson: 0,
    wouldLinkExistingPerson: 0,
    personConflicts: 0,
    documentTypeUnmapped: 0,
    missingRequiredData: 0,
    wouldCreateContact: 0,
    wouldCreateSieRecord: plans.length,
    wouldLinkSieRecord: 0,
    addressResolvedLocal: 0,
    addressForeign: 0,
    addressDeferred: 0,
    addressSkippedNoData: 0,
    usersToCreate: 0,
    credentialsToCreate: 0,
    successfullyLinked: 0,
    manualReview: 0,
    unaccounted: 0,
  };

  for (const plan of plans) {
    switch (plan.person.kind) {
      case "CREATE":
        report.wouldCreatePerson += 1;
        break;
      case "LINK":
        report.wouldLinkExistingPerson += 1;
        break;
      case "CONFLICT":
        report.personConflicts += 1;
        break;
      case "DOCUMENT_TYPE_UNMAPPED":
        report.documentTypeUnmapped += 1;
        break;
      case "MISSING_REQUIRED_DATA":
        report.missingRequiredData += 1;
        break;
    }

    if (plan.hasContact) report.wouldCreateContact += 1;
    if (plan.linkStatus === "LINKED") report.wouldLinkSieRecord += 1;

    switch (plan.address.kind) {
      case "RESOLVED_LOCAL":
        report.addressResolvedLocal += 1;
        break;
      case "FOREIGN":
        report.addressForeign += 1;
        break;
      case "DEFERRED":
        report.addressDeferred += 1;
        break;
      case "NO_DATA":
        report.addressSkippedNoData += 1;
        break;
    }
  }

  report.successfullyLinked = report.wouldCreatePerson + report.wouldLinkExistingPerson;
  report.manualReview = report.personConflicts + report.documentTypeUnmapped + report.missingRequiredData;
  report.unaccounted = report.targetRecords - report.successfullyLinked - report.manualReview;

  return report;
}
