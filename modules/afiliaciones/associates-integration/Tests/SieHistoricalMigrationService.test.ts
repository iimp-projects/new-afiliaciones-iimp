import { describe, expect, it } from "vitest";
import { buildDryRunReport, buildPlan, classifyAddress, classifyPerson } from "../Services/SieHistoricalMigrationService";
import type { ExistingPerson } from "../Services/SieHistoricalMigrationService";
import type { SanitizedSieAssociate } from "../Models/SieAssociateList";

const record = (overrides: Partial<SanitizedSieAssociate> = {}): SanitizedSieAssociate => ({
  documentType: "1",
  documentNumber: "71234567",
  externalCode: "00001",
  sourceType: "X",
  sourceDescription: "Separado",
  passwordPresent: true,
  nombres: "Juan",
  apellidoPaterno: "Perez",
  apellidoMaterno: "Gomez",
  fechaNacimiento: null,
  telefono: "999888777",
  correo: "juan@example.com",
  direccion: "Calle Uno 123",
  paisNombre: "Perú",
  departamentoNombre: "Lima",
  provinciaNombre: "Lima",
  distritoNombre: "Miraflores",
  ...overrides,
});

const existing = (overrides: Partial<ExistingPerson> = {}): ExistingPerson => ({
  id: 7,
  firstName: "Juan",
  paternalLastName: "Perez",
  maternalLastName: "Gomez",
  email: "juan@example.com",
  phone: "999888777",
  street: "Calle Uno 123",
  ...overrides,
});

describe("SieHistoricalMigrationService", () => {
  it("clasifica DOCUMENT_TYPE_UNMAPPED", () => {
    expect(classifyPerson(record({ documentType: "0" }), null).kind).toBe("DOCUMENT_TYPE_UNMAPPED");
  });

  it("vincula persona existente compatible", () => {
    expect(classifyPerson(record(), existing()).kind).toBe("LINK");
  });

  it("marca CONFLICT ante diferencia material", () => {
    expect(classifyPerson(record({ apellidoPaterno: "Otro" }), existing()).kind).toBe("CONFLICT");
  });

  it("crea persona cuando no existe y hay datos mínimos", () => {
    expect(classifyPerson(record(), null).kind).toBe("CREATE");
  });

  it("deja MISSING_REQUIRED_DATA si faltan nombres", () => {
    expect(classifyPerson(record({ nombres: null, apellidoPaterno: null }), null).kind).toBe("MISSING_REQUIRED_DATA");
  });

  it("clasifica dirección resuelta local", () => {
    const geo = { countryId: 1, countryIsPeru: true, departmentId: 2, provinceId: 3, districtId: 4 };
    expect(classifyAddress(record(), geo)).toEqual({ kind: "RESOLVED_LOCAL", countryId: 1, districtId: 4 });
  });

  it("clasifica dirección extranjera", () => {
    const geo = { countryId: 9, countryIsPeru: false, departmentId: null, provinceId: null, districtId: null };
    expect(classifyAddress(record(), geo).kind).toBe("FOREIGN");
  });

  it("clasifica dirección diferida (Perú sin distrito)", () => {
    const geo = { countryId: 1, countryIsPeru: true, departmentId: 2, provinceId: 3, districtId: null };
    expect(classifyAddress(record(), geo).kind).toBe("DEFERRED");
  });

  it("clasifica sin datos de dirección", () => {
    const geo = { countryId: null, countryIsPeru: false, departmentId: null, provinceId: null, districtId: null };
    expect(classifyAddress(record({ direccion: null, paisNombre: null, departamentoNombre: null, provinciaNombre: null, distritoNombre: null }), geo).kind).toBe("NO_DATA");
  });

  it("reconcilia el reporte sin residuo", () => {
    const plans = [
      buildPlan(record(), null, { countryId: 1, countryIsPeru: true, departmentId: 2, provinceId: 3, districtId: 4 }),
      buildPlan(record({ documentNumber: "2" }), existing(), { countryId: 1, countryIsPeru: true, departmentId: 2, provinceId: 3, districtId: null }),
      buildPlan(record({ documentNumber: "3" }), existing({ firstName: "Otro" }), { countryId: 1, countryIsPeru: true, departmentId: 2, provinceId: 3, districtId: null }),
      buildPlan(record({ documentNumber: "4", documentType: "0" }), null, { countryId: null, countryIsPeru: false, departmentId: null, provinceId: null, districtId: null }),
    ];
    const report = buildDryRunReport(plans);
    expect(report.targetRecords).toBe(4);
    expect(report.wouldCreatePerson).toBe(1);
    expect(report.wouldLinkExistingPerson).toBe(1);
    expect(report.personConflicts).toBe(1);
    expect(report.documentTypeUnmapped).toBe(1);
    expect(report.successfullyLinked).toBe(2);
    expect(report.manualReview).toBe(2);
    expect(report.unaccounted).toBe(0);
    expect(report.usersToCreate).toBe(0);
    expect(report.credentialsToCreate).toBe(0);
  });
});
