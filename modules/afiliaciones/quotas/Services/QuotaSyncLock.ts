import { mkdir, readFile, stat, unlink, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

export class QuotaSyncLockedError extends Error {
  readonly code = "QUOTA_SYNC_LOCKED";
  constructor(message = "Ya existe una sincronización de cuotas en ejecución.") {
    super(message);
    this.name = "QuotaSyncLockedError";
  }
}

export interface IQuotaSyncLock {
  acquire(): Promise<() => Promise<void>>;
}

export class FileQuotaSyncLock implements IQuotaSyncLock {
  constructor(
    private readonly lockPath: string,
    private readonly staleMs = 6 * 60 * 60 * 1000,
    private readonly now: () => number = Date.now,
  ) {}

  async acquire(): Promise<() => Promise<void>> {
    await mkdir(dirname(this.lockPath), { recursive: true });
    const payload = JSON.stringify({ pid: process.pid, startedAt: new Date(this.now()).toISOString() });
    if (await this.tryCreate(payload)) return () => this.release();
    if (await this.isStale()) {
      await this.release();
      if (await this.tryCreate(payload)) return () => this.release();
    }
    throw new QuotaSyncLockedError();
  }

  private async tryCreate(payload: string): Promise<boolean> {
    try {
      await writeFile(this.lockPath, payload, { encoding: "utf8", flag: "wx" });
      return true;
    } catch (error) {
      if (isAlreadyExists(error)) return false;
      throw error;
    }
  }

  private async isStale(): Promise<boolean> {
    try {
      const info = await stat(this.lockPath);
      if (this.now() - info.mtimeMs > this.staleMs) return true;
      const content = JSON.parse(await readFile(this.lockPath, "utf8")) as { pid?: number };
      return typeof content.pid === "number" ? !isProcessAlive(content.pid) : false;
    } catch {
      return false;
    }
  }

  private async release(): Promise<void> {
    try {
      await unlink(this.lockPath);
    } catch (error) {
      if (!isNotFound(error)) throw error;
    }
  }
}

function isAlreadyExists(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "EEXIST";
}

function isNotFound(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "ENOENT";
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}
