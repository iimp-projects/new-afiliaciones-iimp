import { describe, expect, it, vi } from "vitest";
import { processPreparedStudentIntegrationAfterCommit } from "../Services/AdministrativeStatusPostCommitService";

describe("administrative student completion post-commit processing", () => {
  it("processes a prepared STUDENT integration only after the transaction commits", async () => {
    const events: string[] = [];
    const associates = {
      processAfterCommit: vi.fn(async (id: number) => {
        events.push(`process:${id}`);
      }),
    };
    let integrationId: number | null = null;

    const transaction = async (callback: () => Promise<void>) => {
      events.push("transaction:start");
      await callback();
      events.push("transaction:commit");
    };

    await transaction(async () => {
      events.push("recalculate");
      integrationId = 901;
    });
    await processPreparedStudentIntegrationAfterCommit(integrationId, associates as never);

    expect(associates.processAfterCommit).toHaveBeenCalledOnce();
    expect(associates.processAfterCommit).toHaveBeenCalledWith(901);
    expect(events).toEqual(["transaction:start", "recalculate", "transaction:commit", "process:901"]);
  });

  it("does not process when the administrative transaction rolls back", async () => {
    const associates = { processAfterCommit: vi.fn() };
    let integrationId: number | null = null;

    await expect(async () => {
      await (async (callback: () => Promise<void>) => {
        await callback();
        throw new Error("rollback");
      })(async () => {
        integrationId = 902;
      });
      await processPreparedStudentIntegrationAfterCommit(integrationId, associates as never);
    }).rejects.toThrow("rollback");

    expect(associates.processAfterCommit).not.toHaveBeenCalled();
  });

  it("does not process when recalculation did not prepare a STUDENT integration", async () => {
    const associates = { processAfterCommit: vi.fn() };

    await processPreparedStudentIntegrationAfterCommit(null, associates as never);

    expect(associates.processAfterCommit).not.toHaveBeenCalled();
  });

  it("does not process an already COMPLETED student when no new integration is prepared", async () => {
    const associates = { processAfterCommit: vi.fn() };
    const alreadyCompletedIntegrationId: number | null = null;

    await processPreparedStudentIntegrationAfterCommit(alreadyCompletedIntegrationId, associates as never);

    expect(associates.processAfterCommit).not.toHaveBeenCalled();
  });
});
