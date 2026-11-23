import { Client } from "pg";
import { QuotaSyncLockedError, type IQuotaSyncLock } from "./QuotaSyncLock";

const DEFAULT_LOCK_KEY = 741852963;

/**
 * Lock distribuido basado en PostgreSQL. Se mantiene en una conexión dedicada
 * durante toda la ejecución y se libera al cerrar la conexión.
 */
export class PostgresQuotaSyncLock implements IQuotaSyncLock {
  constructor(
    private readonly connectionString: string,
    private readonly lockKey = DEFAULT_LOCK_KEY,
  ) {}

  async acquire(): Promise<() => Promise<void>> {
    const client = new Client({ connectionString: this.connectionString });
    await client.connect();
    try {
      const result = await client.query("SELECT pg_try_advisory_lock($1) AS locked", [this.lockKey]);
      if (!result.rows[0]?.locked) {
        await client.end();
        throw new QuotaSyncLockedError();
      }
    } catch (error) {
      if (error instanceof QuotaSyncLockedError) throw error;
      try { await client.end(); } catch { /* ignore */ }
      throw error;
    }

    return async () => {
      try { await client.query("SELECT pg_advisory_unlock($1)", [this.lockKey]); }
      finally { await client.end(); }
    };
  }
}
