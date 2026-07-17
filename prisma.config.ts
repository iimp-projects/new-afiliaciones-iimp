import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "npx tsx ./prisma/seed.ts",
  },
  datasource: {
    // Prisma 7 usa este helper especial 'env' que importamos arriba
    url: env("DATABASE_URL"),
  },
});