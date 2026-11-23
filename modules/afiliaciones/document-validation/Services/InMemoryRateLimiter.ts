export interface RateLimitDecision {
  readonly allowed: boolean;
  readonly retryAfterMs: number;
}

/**
 * Limitador en memoria para el proceso actual. Suficiente para desarrollo y
 * para evitar ráfagas desde una misma sesión; en un despliegue con varias
 * instancias debe sustituirse por un almacén compartido (por ejemplo Redis).
 */
export class InMemoryRateLimiter {
  private readonly hits = new Map<string, number[]>();

  public consume(
    key: string,
    limit: number,
    windowMs: number,
    now = Date.now(),
  ): RateLimitDecision {
    const windowStart = now - windowMs;
    const recent = (this.hits.get(key) ?? []).filter((timestamp) => timestamp > windowStart);
    if (recent.length >= limit) {
      const oldest = recent[0] ?? now;
      this.hits.set(key, recent);
      return { allowed: false, retryAfterMs: Math.max(1_000, oldest + windowMs - now) };
    }
    recent.push(now);
    this.hits.set(key, recent);
    return { allowed: true, retryAfterMs: 0 };
  }

  public reset(): void {
    this.hits.clear();
  }
}

export const documentPrevalidationRateLimiter = new InMemoryRateLimiter();
