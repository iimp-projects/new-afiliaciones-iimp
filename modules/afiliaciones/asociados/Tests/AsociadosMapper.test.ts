import { describe, expect, it } from "vitest";
import { AsociadosMapper } from "../Mappers/AsociadosMapper";
import { shouldShowEvaluationContext } from "@/modules/shared/Components/SmartCaseCard/types";

describe("AsociadosMapper", () => {
  it("mantiene filas compactas para un asociado activo", () => {
    const card = AsociadosMapper.toCardData({ id: 9, status: "ACTIVE", updatedAt: new Date("2026-09-03T10:00:00.000Z"), role: { slug: "ASOCIADO_ACTIVO" }, person: { firstName: "Andrea", paternalLastName: "Paredes", documentNumber: "41000057", contacts: [{ email: "andrea@example.com", phoneNumber: "999999999", isPrimary: true }], professionalExperiences: [{ company: { name: "Minera IIMP" }, isCurrent: true }], applications: [{ status: "COMPLETED", updatedAt: new Date("2026-08-07T10:00:00.000Z"), history: [{ newStatus: "COMPLETED", createdAt: new Date("2026-08-07T10:00:00.000Z") }], payments: [{ status: "PAID", totalAmount: "300" }] }] } });
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
});
