import path from "node:path";
import { defineConfig } from "vitest/config";

// Tests run against a disposable embedded PostgreSQL (tests/global-setup.ts).
// They never read DATABASE_URL from .env and can never reach Supabase.
export default defineConfig({
  resolve: {
    alias: [
      { find: "server-only", replacement: path.resolve("tests/stubs/server-only.ts") },
      { find: /^@\/generated\/(.*)$/, replacement: path.resolve("generated/$1") },
      { find: /^@\/(.*)$/, replacement: path.resolve("src/$1") },
    ],
  },
  test: {
    environment: "node",
    globalSetup: ["tests/global-setup.ts"],
    setupFiles: ["tests/setup-env.ts"],
    include: ["tests/**/*.test.ts"],
    testTimeout: 30_000,
    hookTimeout: 180_000,
    fileParallelism: false,
    pool: "forks",
  },
});
