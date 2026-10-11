import { describe, expect, it, vi } from "vitest";
import { NotificationService } from "./NotificationService";
import type { NotificationRepository } from "../Repositories/NotificationRepository";

function fakeRepository(overrides: Partial<NotificationRepository> = {}) {
  return {
    list: vi.fn(async () => ({ items: [], nextCursor: null })),
    countUnread: vi.fn(async () => 0),
    findOwnedById: vi.fn(async () => null),
    markRead: vi.fn(async () => undefined),
    markAllRead: vi.fn(async () => 0),
    archive: vi.fn(async () => undefined),
    createMany: vi.fn(async () => 0),
    ...overrides,
  } as unknown as NotificationRepository;
}

describe("NotificationService", () => {
  it("rejects marking a notification that does not belong to the user", async () => {
    const repository = fakeRepository({ findOwnedById: vi.fn(async () => null) });
    const service = new NotificationService(repository);

    await expect(service.markRead(1, 999)).rejects.toMatchObject({ status: 404 });
    expect(repository.markRead).not.toHaveBeenCalled();
  });

  it("rejects archiving a notification that does not belong to the user", async () => {
    const repository = fakeRepository({ findOwnedById: vi.fn(async () => null) });
    const service = new NotificationService(repository);

    await expect(service.archive(1, 999)).rejects.toMatchObject({ status: 404 });
    expect(repository.archive).not.toHaveBeenCalled();
  });

  it("scopes list and unread count to the authenticated user id", async () => {
    const repository = fakeRepository();
    const service = new NotificationService(repository);

    await service.list(42, {});
    await service.unreadCount(42);

    expect(repository.list).toHaveBeenCalledWith(expect.objectContaining({ userId: 42 }));
    expect(repository.countUnread).toHaveBeenCalledWith(42);
  });

  it("caps the page size and marks all read for the user", async () => {
    const repository = fakeRepository({ markAllRead: vi.fn(async () => 3) });
    const service = new NotificationService(repository);

    const updated = await service.markAllRead(42);
    expect(updated).toBe(3);
    expect(repository.markAllRead).toHaveBeenCalledWith(42);
  });
});
