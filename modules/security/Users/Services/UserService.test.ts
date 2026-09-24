import { beforeEach, describe, expect, it, vi } from "vitest";
import bcrypt from "bcryptjs";
import type { CreateUserInput } from "../DTOs/user.schema";

const mocks = vi.hoisted(() => ({
  checkExistingUser: vi.fn(),
  createUserWithPerson: vi.fn(),
  setUsersStatus: vi.fn(),
  softDeleteUsers: vi.fn(),
  revokeAllSessions: vi.fn(),
  auditCreate: vi.fn(),
}));

vi.mock("../Repositories/UserRepository", () => ({
  UserRepository: class {
    checkExistingUser = mocks.checkExistingUser;
    createUserWithPerson = mocks.createUserWithPerson;
    setUsersStatus = mocks.setUsersStatus;
    softDeleteUsers = mocks.softDeleteUsers;
  },
}));
vi.mock("@/lib/prisma", () => ({ prisma: { auditLog: { create: mocks.auditCreate } } }));
vi.mock("@/modules/auth/session/service", () => ({ sessionService: { revokeAllSessions: mocks.revokeAllSessions } }));

import { UserService } from "./UserService";

const input = {
  documentType: "DNI",
  documentNumber: "12345678",
  firstName: "Ana",
  paternalLastName: "Pérez",
  email: "ana@example.com",
  password: "Str0ngPass!",
  roleId: 2,
  userType: "VALIDATOR",
} as unknown as CreateUserInput;

describe("UserService administrative creation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.checkExistingUser.mockResolvedValue({ emailExists: false, documentExists: false });
    mocks.createUserWithPerson.mockResolvedValue({ id: 42 });
  });

  it("hashes the password so the login mechanism can verify it (never stores plaintext)", async () => {
    await new UserService().createUser(input);

    const [data, imageUrl, hashedPassword] = mocks.createUserWithPerson.mock.calls[0] as [
      CreateUserInput,
      string | undefined,
      string,
    ];
    expect(data).toBe(input);
    expect(imageUrl).toBeUndefined();
    expect(hashedPassword).toBeTruthy();
    expect(hashedPassword).not.toContain(input.password);
    await expect(bcrypt.compare(input.password, hashedPassword)).resolves.toBe(true);
  });

  it("rejects a duplicated email", async () => {
    mocks.checkExistingUser.mockResolvedValue({ emailExists: true, documentExists: false });

    await expect(new UserService().createUser(input)).rejects.toThrow("correo electrónico");
    expect(mocks.createUserWithPerson).not.toHaveBeenCalled();
  });

  it("rejects a duplicated document number", async () => {
    mocks.checkExistingUser.mockResolvedValue({ emailExists: false, documentExists: true });

    await expect(new UserService().createUser(input)).rejects.toThrow("documento");
    expect(mocks.createUserWithPerson).not.toHaveBeenCalled();
  });
});

describe("UserService bulk operations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.setUsersStatus.mockResolvedValue([]);
    mocks.softDeleteUsers.mockResolvedValue([]);
    mocks.revokeAllSessions.mockResolvedValue(1);
    mocks.auditCreate.mockResolvedValue({});
  });

  it("bulkBlockUsers excludes the operator and delegates to the repository", async () => {
    mocks.setUsersStatus.mockResolvedValue([2, 3]);

    const result = await new UserService().bulkBlockUsers([1, 2, 3], 1);

    expect(mocks.setUsersStatus).toHaveBeenCalledWith([2, 3], "INACTIVE");
    expect(result.processed).toBe(2);
    expect(result.failed).toBe(1);
  });

  it("bulkBlockUsers reports partial failure for users not found", async () => {
    mocks.setUsersStatus.mockResolvedValue([2]);

    const result = await new UserService().bulkBlockUsers([2, 3, 4], 99);

    expect(result.processed).toBe(1);
    expect(result.failed).toBe(2);
  });

  it("bulkUnblockUsers sets ACTIVE", async () => {
    mocks.setUsersStatus.mockResolvedValue([2, 3]);
    await new UserService().bulkUnblockUsers([2, 3], 99);
    expect(mocks.setUsersStatus).toHaveBeenCalledWith([2, 3], "ACTIVE");
  });

  it("bulkDeleteUsers uses soft delete", async () => {
    mocks.softDeleteUsers.mockResolvedValue([2]);
    const result = await new UserService().bulkDeleteUsers([2], 99);
    expect(mocks.softDeleteUsers).toHaveBeenCalledWith([2]);
    expect(result.processed).toBe(1);
  });

  it("bulkRevokeSessions revokes sessions for each non-operator user", async () => {
    const result = await new UserService().bulkRevokeSessions([1, 2, 3], 1);
    expect(mocks.revokeAllSessions).toHaveBeenCalledTimes(2);
    expect(result.processed).toBe(2);
    expect(result.failed).toBe(1);
  });

  it("writes an audit log for bulk block", async () => {
    mocks.setUsersStatus.mockResolvedValue([2]);
    await new UserService().bulkBlockUsers([2], 99);

    expect(mocks.auditCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 99,
          action: "USERS_BULK_BLOCK",
          entity: "User",
          entityId: "BULK",
        }),
      }),
    );
  });
});
