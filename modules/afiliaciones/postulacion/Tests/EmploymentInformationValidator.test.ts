import { describe, expect, it } from "vitest";
import { normalizeEmploymentInformation } from "../Models/EmploymentInformation";
import { EmploymentInformationValidator } from "../Validators/EmploymentInformationValidator";

const validator = new EmploymentInformationValidator();
const employed = { employmentStatus: "EMPLOYED" as const, isIndependent: false, isUnemployed: false, companyName: "Minera IIMP", positionName: "Ingeniero", workPhone: "999999999", workEmail: "ingeniero@iimp.pe", workingAddress: "Av. Prueba 123" };

describe("EmploymentInformationValidator", () => {
  it("valida trabajo en una empresa", () => expect(validator.validate(employed).valid).toBe(true));
  it("valida trabajo independiente sin RUC ni nombre comercial", () => expect(validator.validate({ ...employed, employmentStatus: "SELF_EMPLOYED", isIndependent: true, companyName: "" }).valid).toBe(true));
  it("permite no laborar y elimina datos incompatibles", () => {
    const normalized = normalizeEmploymentInformation({ ...employed, employmentStatus: "NOT_WORKING", isUnemployed: true });
    expect(validator.validate(normalized).valid).toBe(true);
    expect(normalized.companyName).toBe("");
    expect(normalized.workEmail).toBe("");
  });
  it.each([
    ["dirección solo símbolos", { workingAddress: "..." }, "workingAddress"],
    ["empresa solo símbolos", { companyName: "---" }, "companyName"],
    ["área solo símbolos", { area: "..." }, "area"],
    ["cargo solo símbolos", { positionName: "***" }, "positionName"],
    ["teléfono inválido", { workPhone: "9" }, "workPhone"],
    ["anexo no numérico", { workExtension: "ABC" }, "workExtension"],
    ["correo incompleto", { workEmail: "correo@" }, "workEmail"],
  ])("rechaza %s", (_name, patch, field) => {
    expect(validator.validate({ ...employed, ...patch }).errors.some(error => error.field === field)).toBe(true);
  });
  it("acepta contenido laboral significativo", () => {
    expect(validator.validate({ ...employed, companyName: "A&SS Ingenieros SRL", area: "TI", positionName: "CEO", workingAddress: "Calle 5 Mz B Lt 10", workExtension: "101" }).valid).toBe(true);
  });
  it.each(["-", ".", "-..", "---", "N/A", "SIN DIRECCION", "123", "AAAA", "-CCSSCSSCSCCSS{{{S..-SCZ"]) ("rechaza dirección legacy o inconsistente %s", address => {
    expect(validator.validate({ ...employed, workingAddress: address }).errors.some(error => error.field === "workingAddress")).toBe(true);
  });
  it.each(["Av. Los Canarios 155", "Calle 5 Mz B Lt 10"])("acepta dirección estructurada %s", address => {
    expect(validator.validate({ ...employed, workingAddress: address }).valid).toBe(true);
  });
});
