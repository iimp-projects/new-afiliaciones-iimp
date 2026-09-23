import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  checkExistingUser: vi.fn(),
  createUserWithPerson: vi.fn(),
  createAndSendActivation: vi.fn(),
}));

vi.mock("../Repositories/UserRepository", () => ({
  UserRepository: class {
    checkExistingUser = mocks.checkExistingUser;
    createUserWithPerson = mocks.createUserWithPerson;
  },
}));
vi.mock("@/modules/auth/account-activation/service", () => ({
  accountActivationService: { createAndSendActivation: mocks.createAndSendActivation },
}));

import { UserService } from "./UserService";

describe("UserService secure administrative creation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.checkExistingUser.mockResolvedValue({ emailExists: false, documentExists: false });
    mocks.createUserWithPerson.mockResolvedValue({ id: 42 });
  });

  it("creates a pending account without a shared password and starts the existing one-time activation flow", async () => {
    const input = {
      documentType: "DNI",
      documentNumber: "12345678",
      firstName: "Ana",
      paternalLastName: "Pérez",
      email: "ana@example.com",
      roleId: 2,
      userType: "VALIDATOR",
    } as never;

    await new UserService().createUser(input);

    expect(mocks.createUserWithPerson).toHaveBeenCalledWith(input, undefined);
    expect(mocks.createAndSendActivation).toHaveBeenCalledWith(42);
  });
});
