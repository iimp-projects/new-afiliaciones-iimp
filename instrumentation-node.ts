import { assertStartupConfig, ConfigurationError } from "./lib/config/env";

if (process.env.NEXT_PHASE !== "phase-production-build") {
  try {
    assertStartupConfig();
  } catch (error) {
    if (error instanceof ConfigurationError) {
      console.error(`[startup] ${error.message}`);
      process.exit(1);
    }
    throw error;
  }
}
