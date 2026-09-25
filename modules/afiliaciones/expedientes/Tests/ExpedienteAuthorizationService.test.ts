import { describe, expect, it } from "vitest";
import { ExpedienteAuthorizationService } from "../Services/ExpedienteAuthorizationService";
import type { CurrentUserDTO } from "@/modules/auth/context/types";

function user(slug: string): CurrentUserDTO {
  return { role: { slug } } as unknown as CurrentUserDTO;
}

const service = new ExpedienteAuthorizationService();

describe("ExpedienteAuthorizationService.resolveWritableDepartment", () => {
  it("ATENCION_ASOCIADO escribe el área ASOCIADOS", () => {
    expect(service.resolveWritableDepartment(user("ATENCION_ASOCIADO"))).toBe("ASOCIADOS");
  });

  it("LOGISTICA escribe el área LOGISTICA", () => {
    expect(service.resolveWritableDepartment(user("LOGISTICA"))).toBe("LOGISTICA");
  });

  it("rechaza roles sin área asignada", () => {
    expect(() => service.resolveWritableDepartment(user("POSTULANTE"))).toThrow(/no administra un área/);
  });

  it("bloquea la modificación de otra área (ATENCION_ASOCIADO → LOGISTICA)", () => {
    expect(() => service.resolveWritableDepartment(user("ATENCION_ASOCIADO"), "LOGISTICA")).toThrow(/otra área/);
  });

  it("bloquea la modificación de otra área (LOGISTICA → ASOCIADOS)", () => {
    expect(() => service.resolveWritableDepartment(user("LOGISTICA"), "ASOCIADOS")).toThrow(/otra área/);
  });

  it("SUPER_ADMIN puede seleccionar un área válida", () => {
    expect(service.resolveWritableDepartment(user("SUPER_ADMIN"), "LOGISTICA")).toBe("LOGISTICA");
  });

  it("SUPER_ADMIN rechaza un área inválida", () => {
    expect(() => service.resolveWritableDepartment(user("SUPER_ADMIN"), "NO_EXISTE")).toThrow(/inválida/);
  });

  it("SUPER_ADMIN rechaza omitir el área", () => {
    expect(() => service.resolveWritableDepartment(user("SUPER_ADMIN"), undefined)).toThrow(/inválida/);
  });
});

describe("ExpedienteAuthorizationService.assertCanWriteDepartment", () => {
  it("permite al rol propietario de su área", () => {
    expect(() => service.assertCanWriteDepartment(user("LOGISTICA"), "LOGISTICA")).not.toThrow();
  });

  it("bloquea a un rol de otra área", () => {
    expect(() => service.assertCanWriteDepartment(user("LOGISTICA"), "ASOCIADOS")).toThrow(/otra área/);
  });

  it("permite a SUPER_ADMIN cualquier área", () => {
    expect(() => service.assertCanWriteDepartment(user("SUPER_ADMIN"), "ASOCIADOS")).not.toThrow();
  });
});
