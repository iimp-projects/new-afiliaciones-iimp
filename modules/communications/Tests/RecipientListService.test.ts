import { describe, expect, it, vi } from "vitest";
import { RecipientListService, RecipientListError } from "../Services/RecipientListService";
import type { RecipientRepository } from "../Repositories/RecipientRepository";

const ACTOR = { userId: 1, email: "admin@iimp.org.pe" };

function setup(overrides: { getList?: { id: number; name: string } | null } = {}) {
  const getList = vi.fn().mockResolvedValue(overrides.getList === undefined ? { id: 10, name: "Sheet1" } : overrides.getList);
  const renameList = vi.fn().mockResolvedValue(undefined);
  const deleteList = vi.fn().mockResolvedValue(undefined);
  const writeListAudit = vi.fn().mockResolvedValue(undefined);

  const repository = {
    getList,
    renameList,
    deleteList,
    writeListAudit,
  } as unknown as RecipientRepository;

  const service = new RecipientListService(repository);
  return { service, mocks: { getList, renameList, deleteList, writeListAudit } };
}

describe("RecipientListService", () => {
  it("renombra la lista con nombre válido y audita", async () => {
    const { service, mocks } = setup();
    await service.renameList(10, "Nueva lista", ACTOR);
    expect(mocks.renameList).toHaveBeenCalledWith(10, "Nueva lista");
    expect(mocks.writeListAudit).toHaveBeenCalledWith(ACTOR, "RECIPIENT_LIST_RENAMED", 10, expect.objectContaining({ from: "Sheet1", to: "Nueva lista" }));
  });

  it("rechaza nombre vacío en renombrado", async () => {
    const { service, mocks } = setup();
    await expect(service.renameList(10, "   ", ACTOR)).rejects.toBeInstanceOf(RecipientListError);
    expect(mocks.renameList).not.toHaveBeenCalled();
  });

  it("rechaza renombrar lista inexistente", async () => {
    const { service, mocks } = setup({ getList: null });
    await expect(service.renameList(999, "X", ACTOR)).rejects.toBeInstanceOf(RecipientListError);
    expect(mocks.renameList).not.toHaveBeenCalled();
  });

  it("elimina la lista y audita (sin borrar destinatarios globales)", async () => {
    const { service, mocks } = setup();
    await service.deleteList(10, ACTOR);
    expect(mocks.deleteList).toHaveBeenCalledWith(10);
    expect(mocks.writeListAudit).toHaveBeenCalledWith(ACTOR, "RECIPIENT_LIST_DELETED", 10, expect.objectContaining({ name: "Sheet1" }));
  });

  it("rechaza eliminar lista inexistente", async () => {
    const { service, mocks } = setup({ getList: null });
    await expect(service.deleteList(999, ACTOR)).rejects.toBeInstanceOf(RecipientListError);
    expect(mocks.deleteList).not.toHaveBeenCalled();
  });
});
