import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  // Prisma loads this file for `generate`, which must also work in CI before
  // deployment secrets are injected. Runtime code still requires DATABASE_URL.
  datasource: { url: process.env.DIRECT_URL ?? "postgresql://prisma:prisma@localhost:5432/prisma" }
});
