import { describe, expect, it } from "vitest";
import { createUserSchema } from "./user.schema";

const validInput = () => ({
  documentType: "DNI",
  documentNumber: "12345678",
  firstName: "Ana",
  paternalLastName: "Pérez",
  maternalLastName: "Gómez",
  email: "ana@example.com",
  password: "Str0ngPass!",
  confirmPassword: "Str0ngPass!",
  roleId: "2",
});

describe("createUserSchema password confirmation", () => {
  it("permite la creación cuando password coincide con confirmPassword", () => {
    const result = createUserSchema.safeParse(validInput());
    expect(result.success).toBe(true);
  });

  it("bloquea la creación cuando password y confirmPassword no coinciden", () => {
    const result = createUserSchema.safeParse({ ...validInput(), confirmPassword: "OtraPass!" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.confirmPassword?.[0]).toBe("Las contraseñas no coinciden.");
    }
  });

  it("bloquea la creación cuando confirmPassword está vacío", () => {
    const result = createUserSchema.safeParse({ ...validInput(), confirmPassword: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.confirmPassword?.[0]).toBe("Debe confirmar la contraseña.");
    }
  });

  it("preserva la política de contraseña existente (mínimo 8 caracteres)", () => {
    const result = createUserSchema.safeParse({
      ...validInput(),
      password: "Corta1!",
      confirmPassword: "Corta1!",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.password?.[0]).toContain("8 caracteres");
    }
  });

  it("normaliza el correo con lowercase", () => {
    const result = createUserSchema.safeParse({ ...validInput(), email: "Ana@Example.COM" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe("ana@example.com");
    }
  });

  it("rechaza un correo con espacios para no evadir la regla de unicidad", () => {
    const result = createUserSchema.safeParse({ ...validInput(), email: "  ana@example.com " });
    expect(result.success).toBe(false);
  });
});
