import { beforeEach, describe, expect, it, vi } from "vitest";
import { resolveCredentialsLogin } from "./submit-login";

describe("resolveCredentialsLogin", () => {
  const checkLockStatus = vi.fn<(email: string) => Promise<{ locked: boolean; message?: string }>>();
  const signIn = vi.fn<
    (options: { email: string; password: string; redirect: boolean }) =>
      Promise<{ error?: string } | undefined>
  >();

  const deps = { checkLockStatus, signIn };

  beforeEach(() => {
    vi.clearAllMocks();
    checkLockStatus.mockResolvedValue({ locked: false });
    signIn.mockResolvedValue({});
  });

  it("mantiene loading en login exitoso (navegación pendiente)", async () => {
    const result = await resolveCredentialsLogin({ email: "a@b.c", password: "x" }, deps);

    expect(result.keepLoading).toBe(true);
    expect(result.errorMessage).toBeNull();
  });

  it("restablece loading con credenciales inválidas", async () => {
    signIn.mockResolvedValue({ error: "CredentialsSignin" });

    const result = await resolveCredentialsLogin({ email: "a@b.c", password: "x" }, deps);

    expect(result.keepLoading).toBe(false);
    expect(result.errorMessage).toContain("Correo o contraseña incorrectos");
  });

  it("restablece loading ante un error de servidor", async () => {
    signIn.mockRejectedValue(new Error("down"));

    const result = await resolveCredentialsLogin({ email: "a@b.c", password: "x" }, deps);

    expect(result.keepLoading).toBe(false);
    expect(result.errorMessage).toContain("error inesperado");
  });

  it("restablece loading y no llama a signIn cuando la cuenta ya está bloqueada", async () => {
    checkLockStatus.mockResolvedValue({ locked: true, message: "Bloqueada" });

    const result = await resolveCredentialsLogin({ email: "a@b.c", password: "x" }, deps);

    expect(result.keepLoading).toBe(false);
    expect(result.errorMessage).toBe("Bloqueada");
    expect(signIn).not.toHaveBeenCalled();
  });

  it("restablece loading cuando el intento acaba de bloquear la cuenta (post-check)", async () => {
    signIn.mockResolvedValue({ error: "CredentialsSignin" });
    checkLockStatus
      .mockResolvedValueOnce({ locked: false })
      .mockResolvedValueOnce({ locked: true, message: "Bloqueada por intentos" });

    const result = await resolveCredentialsLogin({ email: "a@b.c", password: "x" }, deps);

    expect(result.keepLoading).toBe(false);
    expect(result.errorMessage).toBe("Bloqueada por intentos");
  });
});
