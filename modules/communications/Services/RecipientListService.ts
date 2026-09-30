import { RecipientRepository } from "../Repositories/RecipientRepository";

export class RecipientListError extends Error {
  constructor(message: string, readonly status = 400) { super(message); }
}

export class RecipientListService {
  constructor(private readonly repository = new RecipientRepository()) {}

  async renameList(id: number, name: string, actor: { userId: number; email: string }): Promise<void> {
    const trimmed = name.trim();
    if (!trimmed) throw new RecipientListError("El nombre de la lista es obligatorio.", 422);
    const list = await this.repository.getList(id);
    if (!list) throw new RecipientListError("La lista no existe.", 404);
    await this.repository.renameList(id, trimmed);
    await this.repository.writeListAudit(actor, "RECIPIENT_LIST_RENAMED", id, { from: list.name, to: trimmed });
  }

  async deleteList(id: number, actor: { userId: number; email: string }): Promise<void> {
    const list = await this.repository.getList(id);
    if (!list) throw new RecipientListError("La lista no existe.", 404);
    await this.repository.deleteList(id);
    await this.repository.writeListAudit(actor, "RECIPIENT_LIST_DELETED", id, { name: list.name });
  }
}
