import { SeedMetrics } from './types';

export const seedLogger = {
  info: (message: string): void => console.log(`\x1b[34m[INFO]\x1b[0m ${message}`),
  success: (message: string): void => console.log(`\x1b[32m[SUCCESS]\x1b[0m ${message}`),
  warn: (message: string): void => console.log(`\x1b[33m[WARN]\x1b[0m ${message}`),
  error: (message: string, error?: unknown): void => {
    console.error(`\x1b[31m[ERROR]\x1b[0m ${message}`);
    if (error) console.error(error instanceof Error ? error.stack : error);
  },
  divider: (): void => console.log(`\x1b[90m${'-'.repeat(80)}\x1b[0m`),
  time: (message: string, ms: number): void => 
    console.log(`\x1b[36m[TIME]\x1b[0m ${message} - \x1b[33m${ms.toFixed(2)}ms\x1b[0m`),
  metricsSummary: (metrics: SeedMetrics): void => {
    const total = metrics.created + metrics.updated + metrics.skipped + metrics.failed;
    console.log(`\x1b[36m[METRICS]\x1b[0m Total evaluados: \x1b[1m${total}\x1b[0m`);
    if (metrics.created > 0) console.log(`  \x1b[32m├─ Creados:\x1b[0m ${metrics.created}`);
    if (metrics.updated > 0) console.log(`  \x1b[34m├─ Actualizados:\x1b[0m ${metrics.updated}`);
    if (metrics.skipped > 0) console.log(`  \x1b[33m├─ Omitidos:\x1b[0m ${metrics.skipped}`);
    if (metrics.failed > 0) console.log(`  \x1b[31m└─ Fallidos:\x1b[0m ${metrics.failed}`);
  }
};