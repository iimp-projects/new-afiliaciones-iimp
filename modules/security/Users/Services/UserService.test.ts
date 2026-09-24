import { beforeEach, describe, expect, it, vi } from "vitest";
import bcrypt from "bcryptjs";
import type { CreateUserInput } from "../DTOs/user.schema";

const mocks = vi.hoisted(() => ({
  checkExistingUser: vi.fn(),
  createUserWithPerson: vi.fn(),
}));

vi.mock("../Repositories/UserRepository", () => ({
  UserRepository: class {
    checkExistingUser = mocks.checkExistingUser;
    createUserWithPerson = mocks.createUserWithPerson;
  },
}));

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
