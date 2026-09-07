import { describe, expect, it } from "vitest";
import { AsociadosMapper } from "../Mappers/AsociadosMapper";

describe("AsociadosMapper", () => {
  it("mantiene filas compactas para un asociado activo", () => {
    const card = AsociadosMapper.toCardData({ id: 9, status: "ACTIVE", updatedAt: new Date("2026-09-03T10:00:00.000Z"), role: { slug: "ASOCIADO_ACTIVO" }, person: { firstName: "Andrea", paternalLastName: "Paredes", documentNumber: "41000057", contacts: [{ email: "andrea@example.com", phoneNumber: "999999999", isPrimary: true }], professionalExperiences: [{ company: { name: "Minera IIMP" }, isCurrent: true }], applications: [{ status: "COMPLETED", updatedAt: new Date("2026-08-07T10:00:00.000Z"), history: [{ newStatus: "COMPLETED", createdAt: new Date("2026-08-07T10:00:00.000Z") }], payments: [{ status: "PAID", totalAmount: "300" }] }] } });
    expect(card.atomicValidations?.map((item) => item.label)).toEqual(["Código", "Miembro desde", "Empresa", "Inscripción"]);
    expect(card.identity.email).toBe("andrea@example.com");
    expect(card.identity.phone).toBe("999999999");
    expect(card.atomicValidations?.at(-1)?.assignee?.name).toBe("S/ 300.00");
  });

  it("muestra Institución para estudiantes y admite nombres largos", () => {
    const institution = "Universidad Nacional Mayor de San Marcos";
    const card = AsociadosMapper.toCardData({ id: 10, status: "ACTIVE", updatedAt: new Date(), role: { slug: "ASOCIADO_ESTUDIANTE" }, person: { firstName: "Ana", paternalLastName: "Ríos", documentNumber: "70000001", academicInfos: [{ university: { name: institution } }], applications: [{ status: "COMPLETED", history: [], payments: [] }] } });
    expect(card.atomicValidations?.map((item) => item.label)).toEqual(["Código", "Miembro desde", "Institución", "Inscripción"]);
    expect(card.atomicValidations?.[2].statusLabel).toBe(institution);
    expect(card.atomicValidations?.at(-1)?.statusLabel).toBe("Gratuita");
    expect(card.atomicValidations?.at(-1)?.assignee).toBeUndefined();
  });
});
