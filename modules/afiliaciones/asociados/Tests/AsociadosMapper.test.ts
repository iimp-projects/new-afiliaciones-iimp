import { describe, expect, it } from "vitest";
import { AsociadosMapper } from "../Mappers/AsociadosMapper";
import { shouldShowEvaluationContext } from "@/modules/shared/Components/SmartCaseCard/types";

describe("AsociadosMapper", () => {
  it("mantiene filas compactas para un asociado activo", () => {
    const card = AsociadosMapper.toCardData({ id: 9, status: "ACTIVE", updatedAt: new Date("2026-09-03T10:00:00.000Z"), role: { slug: "ASOCIADO_ACTIVO" }, person: { firstName: "Andrea", paternalLastName: "Paredes", documentNumber: "41000057", contacts: [{ email: "andrea@example.com", phoneNumber: "999999999", isPrimary: true }], professionalExperiences: [{ company: { name: "Minera IIMP" }, isCurrent: true }], applications: [{ status: "COMPLETED", updatedAt: new Date("2026-08-07T10:00:00.000Z"), history: [{ newStatus: "COMPLETED", createdAt: new Date("2026-08-07T10:00:00.000Z") }], payments: [{ status: "PAID", totalAmount: "300", gateway: "NIUBIZ", paymentChannel: "web" }] }] } });
    expect(card.atomicValidations?.map((item) => item.label)).toEqual(["Código", "Miembro desde", "Empresa", "Inscripción"]);
    expect(card.identity.email).toBe("andrea@example.com");
    expect(card.identity.phone).toBe("999999999");
    expect(card.hideContactDetails).toBe(true);
    expect(card.atomicValidations?.at(-1)?.assignee?.name).toBe("S/ 300.00");
  });

  it("muestra Institución para estudiantes y admite nombres largos", () => {
    const institution = "Universidad Nacional Mayor de San Marcos";
    const card = AsociadosMapper.toCardData({ id: 10, status: "ACTIVE", updatedAt: new Date(), role: { slug: "ASOCIADO_ESTUDIANTE" }, person: { firstName: "Ana", paternalLastName: "Ríos", documentNumber: "70000001", academicInfos: [{ university: { name: institution } }], applications: [{ status: "COMPLETED", history: [], payments: [] }] } });
    expect(card.atomicValidations?.map((item) => item.label)).toEqual(["Código", "Miembro desde", "Institución", "Inscripción"]);
    expect(card.atomicValidations?.[2].statusLabel).toBe(institution);
    expect(card.atomicValidations?.at(-1)?.statusLabel).toBe("Gratuita");
    expect(card.atomicValidations?.at(-1)?.assignee).toBeUndefined();
    expect(card.hideContactDetails).toBe(true);
  });

  it("asociado activo usa etiqueta dorada sin borde, subtítulo de membresía activa y línea superior dorada", () => {
    const card = AsociadosMapper.toCardData({ id: 9, status: "ACTIVE", updatedAt: new Date(), role: { slug: "ASOCIADO_ACTIVO" }, person: { firstName: "Andrea", paternalLastName: "Paredes", documentNumber: "41000057", contacts: [], professionalExperiences: [], applications: [{ status: "COMPLETED", history: [], payments: [] }] } });
    expect(card.primaryBadge).toMatchObject({ label: "Asociado Activo", icon: "person", colorClass: "bg-[#FFF4DE] text-[#9A6A1F]" });
    expect(card.primaryBadge?.colorClass).not.toContain("border");
    expect(card.subStatus).toBe("Membresía activa");
    expect(card.topBorderColorClass).toBe("bg-[#B58B35]");
  });

  it("asociado activo inactivo no muestra el subtítulo 'Membresía activa'", () => {
    const card = AsociadosMapper.toCardData({ id: 11, status: "INACTIVE", updatedAt: new Date(), role: { slug: "ASOCIADO_ACTIVO" }, person: { firstName: "Luis", paternalLastName: "Pérez", documentNumber: "41000058", contacts: [], professionalExperiences: [], applications: [{ status: "COMPLETED", history: [], payments: [] }] } });
    expect(card.subStatus).toBe("Membresía inactiva");
  });

  it("asociado estudiante usa etiqueta azul índigo sin borde y línea superior índigo", () => {
    const card = AsociadosMapper.toCardData({ id: 12, status: "ACTIVE", updatedAt: new Date(), role: { slug: "ASOCIADO_ESTUDIANTE" }, person: { firstName: "Ana", paternalLastName: "Ríos", documentNumber: "70000002", contacts: [], academicInfos: [], applications: [{ status: "COMPLETED", history: [], payments: [] }] } });
    expect(card.primaryBadge).toMatchObject({ label: "Asociado Estudiante", icon: "graduation", colorClass: "bg-[#EEF2FF] text-[#4F46B8]" });
    expect(card.primaryBadge?.colorClass).not.toContain("border");
    expect(card.subStatus).toBe("Membresía estudiantil");
    expect(card.topBorderColorClass).toBe("bg-[#4F6BD8]");
  });

  it("conserva la etiqueta real de una membresía no activa", () => {
    const card = AsociadosMapper.toCardData({ id: 13, status: "BLOCKED", updatedAt: new Date(), role: { slug: "ASOCIADO_ACTIVO" }, person: { firstName: "María", paternalLastName: "Soto", documentNumber: "41000059", contacts: [], professionalExperiences: [], applications: [{ status: "COMPLETED", history: [], payments: [] }] } });
    expect(card.subStatus).toBe("Membresía suspendida");
  });

  it("usa la actualización más reciente entre el asociado y su expediente", () => {
    const card = AsociadosMapper.toCardData({ id: 14, status: "ACTIVE", updatedAt: new Date("2026-10-02T10:00:00.000Z"), role: { slug: "ASOCIADO_ACTIVO" }, person: { firstName: "Lucía", paternalLastName: "Paz", documentNumber: "41000060", contacts: [], professionalExperiences: [], applications: [{ status: "COMPLETED", updatedAt: new Date("2026-10-03T10:00:00.000Z"), history: [], payments: [] }] } });
    expect(card.metadata.lastUpdatedRelative).toContain("03/10/2026");
    expect(card.generalStatus).toBe("COMPLETED");
    expect(card.metadata.showEvaluationContext).toBe(false);
  });

  it("oculta el contexto de evaluación solo cuando el flujo finalizó", () => {
    expect(shouldShowEvaluationContext("COMPLETED")).toBe(false);
    expect(shouldShowEvaluationContext("APPROVED")).toBe(true);
    expect(shouldShowEvaluationContext("UNDER_EVALUACION")).toBe(true);
    expect(shouldShowEvaluationContext("PENDING")).toBe(true);
  });

  it("formatea la actualización en la zona horaria institucional de Lima", () => {
    const card = AsociadosMapper.toCardData({ id: 15, status: "ACTIVE", updatedAt: new Date("2026-10-03T02:00:00.000Z"), role: { slug: "ASOCIADO_ACTIVO" }, person: { firstName: "Elena", paternalLastName: "Gil", documentNumber: "41000061", contacts: [], professionalExperiences: [], applications: [{ status: "COMPLETED", updatedAt: new Date("2026-10-02T20:00:00.000Z"), history: [], payments: [] }] } });
    expect(card.metadata.lastUpdatedRelative).toBe("Actualizado: 02/10/2026");
  });

  const user = (documentType: unknown, documentNumber: string) => ({
    id: 20, status: "ACTIVE", updatedAt: new Date(), role: { slug: "ASOCIADO_ACTIVO" },
    person: { firstName: "Ana", paternalLastName: "Ríos", documentType, documentNumber, contacts: [], professionalExperiences: [], applications: [{ status: "COMPLETED", history: [], payments: [] }] },
  });

  it("construye el subtítulo con el tipo de documento real (DNI)", () => {
    const card = AsociadosMapper.toCardData(user("DNI", "41000057"));
    expect(card.identity.subtitle).toBe("DNI 41000057");
  });

  it("construye el subtítulo con el tipo de documento real (CE)", () => {
    const card = AsociadosMapper.toCardData(user("CE", "001234567"));
    expect(card.identity.subtitle).toBe("CE 001234567");
  });

  it("construye el subtítulo para pasaporte y conserva el número alfanumérico", () => {
    const card = AsociadosMapper.toCardData(user("PASSPORT", "P14138404"));
    expect(card.identity.subtitle).toBe("Pasaporte P14138404");
  });

  it("muestra Documento para tipo OTHER sin alterar el número", () => {
    const card = AsociadosMapper.toCardData(user("OTHER", "G33052626"));
    expect(card.identity.subtitle).toBe("Documento G33052626");
  });

  it("muestra Documento cuando el tipo no está registrado", () => {
    const card = AsociadosMapper.toCardData(user(null, "P11219869"));
    expect(card.identity.subtitle).toBe("Documento P11219869");
  });

  it("muestra el código institucional confirmado y 'No disponible' cuando no existe", () => {
    const withoutCode = AsociadosMapper.toCardData(user("DNI", "41000057"));
    expect(withoutCode.atomicValidations?.[0].statusLabel).toBe("No disponible");

    const withCode = AsociadosMapper.toCardData({ ...user("DNI", "41000057"), institutionalCode: "12345" });
    expect(withCode.atomicValidations?.[0].statusLabel).toBe("12345");
    expect(withCode.atomicValidations?.[0].assignee?.name).toBe("SIE");
  });

  it("muestra el código correlativo almacenado del asociado", () => {
    const base = user("DNI", "41000057");
    const card = AsociadosMapper.toCardData({ ...base, person: { ...base.person, id: 41, associateCode: "A-00041" } });
    expect(card.atomicValidations?.[0].statusLabel).toBe("A-00041");
    expect(card.atomicValidations?.[0].assignee?.name).toBe("IIMP");
  });

  it("reconoce un asociado histórico SIE sin expediente como COMPLETADO con origen y código visible", () => {
    const card = AsociadosMapper.toCardData({ id: 900, source: "SIE_HISTORICAL", status: "COMPLETED", updatedAt: new Date(), role: { slug: "ASOCIADO_ACTIVO" }, institutionalCode: "00212", sieCode: "00212", person: { firstName: "Jose", paternalLastName: "Briceno", documentType: "DNI", documentNumber: "10000022", contacts: [], professionalExperiences: [], applications: [] } });
    expect(card.generalStatus).toBe("COMPLETED");
    expect(card.subStatus).toBe("Membresía histórica SIE");
    expect(card.identity.categoryBadge?.label).toBe("SIE · Histórico");
    expect(card.identity.subtitle).toBe("DNI 10000022");
    expect(card.trackingCode).toBe("00212");
    expect(card.atomicValidations?.[0].statusLabel).toBe("00212");
    expect(card.atomicValidations?.[0].assignee?.name).toBe("SIE");
  });

  it("usa la primera cuota migrada como 'Miembro desde' del asociado histórico", () => {
    const card = AsociadosMapper.toCardData({
      id: 901, source: "SIE_HISTORICAL", status: "COMPLETED", updatedAt: new Date(), role: { slug: "ASOCIADO_ACTIVO" }, institutionalCode: "00213", sieCode: "00213",
      person: {
        firstName: "Jose", paternalLastName: "Briceno", documentType: "DNI", documentNumber: "10000023", contacts: [], professionalExperiences: [], applications: [],
        quotas: [
          { concept: "INSCRIPCION", quotaNumber: null, year: 2014, periodStart: new Date("2014-12-15T00:00:00.000Z"), paidAt: new Date("2014-12-20T00:00:00.000Z") },
          { concept: "CUOTA", quotaNumber: 1, year: 2015, periodStart: new Date("2015-01-01T00:00:00.000Z"), paidAt: new Date("2015-01-05T00:00:00.000Z") },
        ],
      },
    });
    const memberSince = card.atomicValidations?.find((item) => item.label === "Miembro desde");
    expect(memberSince?.statusLabel).toBe("01/01/2015");
    expect(memberSince?.status).toBe("check");
    expect(memberSince?.assignee?.name).toBe("SIE");
  });

  it("prefiere la primera cuota SIE sobre la fecha del expediente en asociados V2", () => {
    const card = AsociadosMapper.toCardData({
      id: 902, status: "ACTIVE", updatedAt: new Date(), role: { slug: "ASOCIADO_ACTIVO" }, institutionalCode: "00214",
      person: {
        firstName: "Andrea", paternalLastName: "Paredes", documentType: "DNI", documentNumber: "41000057", contacts: [], professionalExperiences: [],
        applications: [{ status: "COMPLETED", updatedAt: new Date("2026-08-07T10:00:00.000Z"), history: [{ newStatus: "COMPLETED", createdAt: new Date("2026-08-07T10:00:00.000Z") }], payments: [] }],
        quotas: [{ concept: "CUOTA", quotaNumber: 1, year: 2018, periodStart: new Date("2018-03-01T00:00:00.000Z"), paidAt: null }],
      },
    });
    const memberSince = card.atomicValidations?.find((item) => item.label === "Miembro desde");
    expect(memberSince?.statusLabel).toBe("01/03/2018");
    expect(memberSince?.assignee?.name).toBe("SIE");
  });

  it("mantiene la fecha del expediente cuando no existen cuotas SIE", () => {
    const card = AsociadosMapper.toCardData({
      id: 903, status: "ACTIVE", updatedAt: new Date(), role: { slug: "ASOCIADO_ACTIVO" }, institutionalCode: "00215",
      person: {
        firstName: "Lucía", paternalLastName: "Paz", documentType: "DNI", documentNumber: "41000060", contacts: [], professionalExperiences: [],
        applications: [{ status: "COMPLETED", updatedAt: new Date("2026-08-07T10:00:00.000Z"), history: [{ newStatus: "COMPLETED", createdAt: new Date("2026-08-07T10:00:00.000Z") }], payments: [] }],
      },
    });
    const memberSince = card.atomicValidations?.find((item) => item.label === "Miembro desde");
    expect(memberSince?.statusLabel).toBe("07/08/2026");
    expect(memberSince?.assignee?.name).toBe("IIMP");
  });

  it("muestra el origen Pasarela en la inscripción", () => {
    const card = AsociadosMapper.toCardData({
      id: 904, status: "ACTIVE", updatedAt: new Date(), role: { slug: "ASOCIADO_ACTIVO" }, institutionalCode: "00216",
      person: {
        firstName: "Ana", paternalLastName: "Ríos", documentType: "DNI", documentNumber: "41000061", contacts: [], professionalExperiences: [],
        applications: [{ status: "COMPLETED", history: [], payments: [{ status: "PAID", totalAmount: "300", gateway: "NIUBIZ", paymentChannel: "web" }] }],
      },
    });
    const inscription = card.atomicValidations?.find((item) => item.label === "Inscripción");
    expect(inscription?.statusLabel).toBe("Pagada · Pasarela");
    expect(inscription?.assignee?.name).toBe("S/ 300.00");
  });

  it("muestra el origen Manual en la inscripción", () => {
    const card = AsociadosMapper.toCardData({
      id: 905, status: "ACTIVE", updatedAt: new Date(), role: { slug: "ASOCIADO_ACTIVO" }, institutionalCode: "00217",
      person: {
        firstName: "Ana", paternalLastName: "Ríos", documentType: "DNI", documentNumber: "41000062", contacts: [], professionalExperiences: [],
        applications: [{ status: "COMPLETED", history: [], payments: [{ status: "PAID", totalAmount: "300", gateway: "BANK_TRANSFER", paymentChannel: "MANUAL" }] }],
      },
    });
    const inscription = card.atomicValidations?.find((item) => item.label === "Inscripción");
    expect(inscription?.statusLabel).toBe("Pagada · Manual");
    expect(inscription?.assignee?.name).toBe("S/ 300.00");
  });

  it("muestra el origen SIE en la inscripción de un asociado histórico", () => {
    const card = AsociadosMapper.toCardData({
      id: 906, source: "SIE_HISTORICAL", status: "COMPLETED", updatedAt: new Date(), role: { slug: "ASOCIADO_ACTIVO" }, institutionalCode: "00218", sieCode: "00218",
      person: {
        firstName: "Jose", paternalLastName: "Briceno", documentType: "DNI", documentNumber: "10000024", contacts: [], professionalExperiences: [], applications: [],
        quotas: [{ concept: "INSCRIPCION", quotaNumber: null, year: 2015, periodStart: new Date("2015-01-01T00:00:00.000Z"), paidAt: new Date("2015-01-05T00:00:00.000Z"), amount: "150.00", currency: "S/" }],
      },
    });
    const inscription = card.atomicValidations?.find((item) => item.label === "Inscripción");
    expect(inscription?.statusLabel).toBe("Pagada · SIE");
    expect(inscription?.assignee?.name).toBe("S/ 150.00");
  });

  it("mantiene el origen SIE cuando la tabla migrada solo tiene cuotas", () => {
    const card = AsociadosMapper.toCardData({
      id: 907, source: "SIE_HISTORICAL", status: "COMPLETED", updatedAt: new Date(), role: { slug: "ASOCIADO_ACTIVO" }, institutionalCode: "00219", sieCode: "00219",
      person: {
        firstName: "Jose", paternalLastName: "Briceno", documentType: "DNI", documentNumber: "10000025", contacts: [], professionalExperiences: [], applications: [],
        quotas: [{ concept: "CUOTA", quotaNumber: 1, year: 2015, periodStart: new Date("2015-01-01T00:00:00.000Z"), paidAt: new Date("2015-01-05T00:00:00.000Z"), amount: "150.00", currency: "S/" }],
      },
    });
    const inscription = card.atomicValidations?.find((item) => item.label === "Inscripción");
    expect(inscription?.statusLabel).toBe("Pagada · SIE");
    expect(inscription?.assignee).toBeUndefined();
  });
});
