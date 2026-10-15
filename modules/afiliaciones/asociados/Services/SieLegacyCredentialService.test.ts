import { describe, expect, it, vi } from "vitest";
import bcrypt from "bcryptjs";
import type { Prisma } from "@prisma/client";
import {
  classifyLegacyCredential,
  isWeakSiePassword,
  isValidLegacyCredentialEmail,
  SIE_LEGACY_CREDENTIAL_BCRYPT_COST,
  SIE_MIN_HISTORICAL_CLAVE_LENGTH,
  SieLegacyCredentialConflictError,
  SieLegacyCredentialService,
  type SieLegacyCredentialContext,
} from "./SieLegacyCredentialService";

const ctx = (overrides: Partial<SieLegacyCredentialContext> = {}): SieLegacyCredentialContext => ({
  hasUser: true,
  userStatus: "PENDING",
  hasAnyCredential: false,
  email: "asociado@example.com",
  identityConflict: false,
  ...overrides,
});

const SYNTHETIC_CLAVE = "ClaveInventada2026!";

describe("classifyLegacyCredential", () => {
  it("clasifica ELIGIBLE a un usuario PENDING sin ninguna credencial, con Clave robusta y correo válido", () => {
    expect(classifyLegacyCredential(SYNTHETIC_CLAVE, ctx())).toBe("ELIGIBLE");
  });

  it("excluye cuentas con conflicto de identidad por encima de todo", () => {
    expect(classifyLegacyCredential(SYNTHETIC_CLAVE, ctx({ identityConflict: true }))).toBe("EXCLUDED_IDENTITY_CONFLICT");
  });

  it("excluye personas sin usuario", () => {
    expect(classifyLegacyCredential(SYNTHETIC_CLAVE, ctx({ hasUser: false, userStatus: null }))).toBe("EXCLUDED_NO_USER");
  });

  it("excluye usuarios no-PENDING (ACTIVE/INACTIVE/BLOCKED)", () => {
    expect(classifyLegacyCredential(SYNTHETIC_CLAVE, ctx({ userStatus: "ACTIVE" }))).toBe("EXCLUDED_NOT_PENDING");
    expect(classifyLegacyCredential(SYNTHETIC_CLAVE, ctx({ userStatus: "INACTIVE" }))).toBe("EXCLUDED_NOT_PENDING");
    expect(classifyLegacyCredential(SYNTHETIC_CLAVE, ctx({ userStatus: "BLOCKED" }))).toBe("EXCLUDED_NOT_PENDING");
  });

  it("excluye usuarios con CUALQUIER credencial previa (PASSWORD o PASSKEY, activa o inactiva)", () => {
    expect(classifyLegacyCredential(SYNTHETIC_CLAVE, ctx({ hasAnyCredential: true }))).toBe("EXCLUDED_HAS_CREDENTIAL");
  });

  it("excluye Clave vacía o nula", () => {
    expect(classifyLegacyCredential(null, ctx())).toBe("EXCLUDED_EMPTY_CLAVE");
    expect(classifyLegacyCredential("   ", ctx())).toBe("EXCLUDED_EMPTY_CLAVE");
  });

  it("excluye Clave histórica por debajo del mínimo (1-3 caracteres)", () => {
    expect(classifyLegacyCredential("123", ctx())).toBe("EXCLUDED_WEAK_PASSWORD");
  });

  it("acepta Clave histórica de 4 y 6 caracteres (no aplica política de contraseña nueva)", () => {
    expect(classifyLegacyCredential("1234", ctx())).toBe("ELIGIBLE");
    expect(classifyLegacyCredential("123456", ctx())).toBe("ELIGIBLE");
  });

  it("excluye correos inválidos", () => {
    expect(classifyLegacyCredential(SYNTHETIC_CLAVE, ctx({ email: null }))).toBe("EXCLUDED_INVALID_EMAIL");
    expect(classifyLegacyCredential(SYNTHETIC_CLAVE, ctx({ email: "a@" }))).toBe("EXCLUDED_INVALID_EMAIL");
  });
});

describe("política de contraseña", () => {
  it(`marca como débil únicamente Clave histórica menor a ${SIE_MIN_HISTORICAL_CLAVE_LENGTH} caracteres`, () => {
    expect(isWeakSiePassword("123")).toBe(true);
    expect(isWeakSiePassword("1234")).toBe(false);
    expect(isWeakSiePassword("123456")).toBe(false);
  });

  it("valida el formato de correo", () => {
    expect(isValidLegacyCredentialEmail("a@b.co")).toBe(true);
    expect(isValidLegacyCredentialEmail("a@b")).toBe(false);
    expect(isValidLegacyCredentialEmail(null)).toBe(false);
  });
});

describe("SieLegacyCredentialService.importCredential", () => {
  function fakeTx(overrides: Record<string, unknown> = {}) {
    return {
      $executeRaw: vi.fn().mockResolvedValue(1),
      credential: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ id: "cred-1", ...data })),
        delete: vi.fn().mockResolvedValue({}),
        deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
        update: vi.fn().mockResolvedValue({}),
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
        upsert: vi.fn().mockResolvedValue({}),
      },
      user: {
        update: vi.fn().mockResolvedValue({}),
      },
      auditLog: {
        create: vi.fn().mockResolvedValue({ id: "audit-1" }),
      },
      ...overrides,
    } as unknown as Prisma.TransactionClient;
  }

  const candidate = { userId: 1, email: "asociado@example.com", clave: SYNTHETIC_CLAVE, externalCode: "00012" };

  it("almacena un hash bcrypt (cost 12), nunca el valor en claro", async () => {
    const tx = fakeTx();
    const service = new SieLegacyCredentialService();

    await service.importCredential(tx, candidate, "run-1");

    const create = (tx.credential.create as ReturnType<typeof vi.fn>).mock.calls[0][0] as { data: { secret: string; type: string; isActive: boolean } };
    expect(create.data.type).toBe("PASSWORD");
    expect(create.data.isActive).toBe(true);
    expect(create.data.secret).not.toContain(SYNTHETIC_CLAVE);
    expect(create.data.secret.startsWith("$2")).toBe(true);
    expect(await bcrypt.compare(SYNTHETIC_CLAVE, create.data.secret)).toBe(true);
  });

  it("usa bcrypt cost 12 en el hash generado", async () => {
    const tx = fakeTx();
    const service = new SieLegacyCredentialService();
    await service.importCredential(tx, candidate, "run-1");
    const create = (tx.credential.create as ReturnType<typeof vi.fn>).mock.calls[0][0] as { data: { secret: string } };
    const salt = create.data.secret.split("$")[2];
    expect(salt).toBe(String(SIE_LEGACY_CREDENTIAL_BCRYPT_COST).padStart(2, "0"));
  });

  it("no expone la contraseña ni el hash en la auditoría (solo correo enmascarado)", async () => {
    const tx = fakeTx();
    const service = new SieLegacyCredentialService();
    await service.importCredential(tx, candidate, "run-1");

    const audit = (tx.auditLog.create as ReturnType<typeof vi.fn>).mock.calls[0][0] as { data: { newValues: Record<string, unknown> } };
    const serialized = JSON.stringify(audit.data.newValues);
    expect(serialized).not.toContain(SYNTHETIC_CLAVE);
    expect(serialized).not.toContain("secret");
    expect(audit.data.newValues.maskedEmail).toBe("as***@example.com");
  });

  it("adquiere el bloqueo advisory ANTES de verificar credenciales existentes", async () => {
    const tx = fakeTx();
    const service = new SieLegacyCredentialService();
    await service.importCredential(tx, candidate, "run-1");

    const executeRawOrder = (tx.$executeRaw as ReturnType<typeof vi.fn>).mock.invocationCallOrder[0];
    const findFirstOrder = (tx.credential.findFirst as ReturnType<typeof vi.fn>).mock.invocationCallOrder[0];
    expect(executeRawOrder).toBeLessThan(findFirstOrder);
  });
});

describe("regresión: preservación de contraseñas existentes", () => {
  const EXISTING_SECRET = "$2b$12$existinghashvalue000000000000000000000000000000000000000000000000";

  function fakeTxWithExistingCredential() {
    const tx = {
      $executeRaw: vi.fn().mockResolvedValue(1),
      credential: {
        findFirst: vi.fn().mockResolvedValue({ id: "cred-existing", secret: EXISTING_SECRET }),
        create: vi.fn(),
        delete: vi.fn(),
        deleteMany: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
        upsert: vi.fn(),
      },
      auditLog: { create: vi.fn() },
    } as unknown as Prisma.TransactionClient;
    return tx;
  }

  it("si existe una credencial previa (cualquier tipo), lanza conflicto y NO invoca ninguna mutación", async () => {
    const tx = fakeTxWithExistingCredential();
    const service = new SieLegacyCredentialService();

    await expect(service.importCredential(tx, { userId: 1, email: "a@b.co", clave: "ClaveInventada2026!", externalCode: "00012" }, "run-1"))
      .rejects.toBeInstanceOf(SieLegacyCredentialConflictError);

    expect(tx.credential.create).not.toHaveBeenCalled();
    expect(tx.credential.delete).not.toHaveBeenCalled();
    expect(tx.credential.deleteMany).not.toHaveBeenCalled();
    expect(tx.credential.update).not.toHaveBeenCalled();
    expect(tx.credential.updateMany).not.toHaveBeenCalled();
    expect(tx.credential.upsert).not.toHaveBeenCalled();
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });

  it("nunca utiliza deleteMany ni upsert, ni siquiera en el camino de creación", async () => {
    const tx = {
      $executeRaw: vi.fn().mockResolvedValue(1),
      credential: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ id: "cred-1", ...data })),
        delete: vi.fn(),
        deleteMany: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
        upsert: vi.fn(),
      },
      user: { update: vi.fn().mockResolvedValue({}) },
      auditLog: { create: vi.fn().mockResolvedValue({ id: "audit-1" }) },
    } as unknown as Prisma.TransactionClient;
    const service = new SieLegacyCredentialService();

    await service.importCredential(tx, { userId: 1, email: "a@b.co", clave: "ClaveInventada2026!", externalCode: "00012" }, "run-1");

    expect(tx.credential.deleteMany).not.toHaveBeenCalled();
    expect(tx.credential.delete).not.toHaveBeenCalled();
    expect(tx.credential.updateMany).not.toHaveBeenCalled();
    expect(tx.credential.update).not.toHaveBeenCalled();
    expect(tx.credential.upsert).not.toHaveBeenCalled();
  });

  it("es idempotente ante reintentos: un segundo intento con credencial ya existente no crea duplicados", async () => {
    const service = new SieLegacyCredentialService();

    const firstTx = {
      $executeRaw: vi.fn().mockResolvedValue(1),
      credential: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ id: "cred-1", ...data })),
      },
      user: { update: vi.fn().mockResolvedValue({}) },
      auditLog: { create: vi.fn().mockResolvedValue({ id: "audit-1" }) },
    } as unknown as Prisma.TransactionClient;

    await service.importCredential(firstTx, { userId: 7, email: "a@b.co", clave: "ClaveInventada2026!", externalCode: "00012" }, "run-1");
    expect(firstTx.credential.create).toHaveBeenCalledTimes(1);

    const secondTx = fakeTxWithExistingCredential();
    await expect(service.importCredential(secondTx, { userId: 7, email: "a@b.co", clave: "OtraClaveDistinta2026!", externalCode: "00012" }, "run-2"))
      .rejects.toBeInstanceOf(SieLegacyCredentialConflictError);
    expect(secondTx.credential.create).not.toHaveBeenCalled();
  });
});

describe("SieLegacyCredentialService: primer ingreso con cambio obligatorio", () => {
  function fakeTx() {
    return {
      $executeRaw: vi.fn().mockResolvedValue(1),
      credential: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ id: "cred-1", ...data })),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      user: { update: vi.fn().mockResolvedValue({}) },
      auditLog: { create: vi.fn().mockResolvedValue({ id: "audit-1" }) },
    } as unknown as Prisma.TransactionClient;
  }

  it("importCredential marca mustChangePassword=true", async () => {
    const tx = fakeTx();
    const service = new SieLegacyCredentialService();
    await service.importCredential(tx, { userId: 1, email: "a@b.co", clave: SYNTHETIC_CLAVE, externalCode: "00012" }, "run-1");
    expect(tx.user.update).toHaveBeenCalledWith({ where: { id: 1 }, data: { mustChangePassword: true } });
  });

  it("completeFirstLoginPasswordChange actualiza la credencial y limpia el flag", async () => {
    const tx = fakeTx();
    const service = new SieLegacyCredentialService();
    await service.completeFirstLoginPasswordChange(tx, 1, "NuevaClaveSegura2026!");
    expect(tx.credential.updateMany).toHaveBeenCalledWith({ where: { userId: 1, type: "PASSWORD", isActive: true }, data: { secret: expect.stringMatching(/^\$2/) } });
    expect(tx.user.update).toHaveBeenCalledWith({ where: { id: 1 }, data: { mustChangePassword: false } });
  });

  it("completeFirstLoginPasswordChange no expone la contraseña en la auditoría", async () => {
    const tx = fakeTx();
    const service = new SieLegacyCredentialService();
    await service.completeFirstLoginPasswordChange(tx, 1, "NuevaClaveSegura2026!");
    const audit = (tx.auditLog.create as ReturnType<typeof vi.fn>).mock.calls[0][0] as { data: { newValues: Record<string, unknown> } };
    expect(JSON.stringify(audit.data.newValues)).not.toContain("NuevaClaveSegura2026!");
    expect(JSON.stringify(audit.data.newValues)).not.toContain("secret");
  });

  it("completeFirstLoginPasswordChange rechaza reutilizar la contraseña histórica", async () => {
    const historicalHash = await bcrypt.hash("ClaveHistorica123", 12);
    const tx = fakeTx();
    (tx.credential.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({ secret: historicalHash });
    const service = new SieLegacyCredentialService();

    await expect(service.completeFirstLoginPasswordChange(tx, 1, "ClaveHistorica123"))
      .rejects.toThrow("contraseña histórica");
    expect(tx.credential.updateMany).not.toHaveBeenCalled();
    expect(tx.user.update).not.toHaveBeenCalled();
  });
});
