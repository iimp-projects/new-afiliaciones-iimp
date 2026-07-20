import { seedLogger } from './logger';
import { SeedMetrics } from './types';

export const runSeed = async (
  seedName: string, 
  seedFn: () => Promise<SeedMetrics | void>
): Promise<void> => {
  const start = performance.now();
  seedLogger.info(`Iniciando: ${seedName}...`);
  
  try {
    const result = await seedFn();
    const end = performance.now();
    if (result) seedLogger.metricsSummary(result);
    seedLogger.time(`Completado: ${seedName}`, end - start);
  } catch (error) {
    seedLogger.error(`Fallo crítico en: ${seedName}`, error);
    throw error;
  }
};