import { defineConfig } from "vitest/config";
import { fileURLToPath } from "url";

/**
 * Integration tests talk to a real Postgres, so they are a separate project
 * from the unit suite: no jsdom, no React plugin, and a longer timeout budget
 * for tests that deliberately sit and wait on a lock.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "server-only": fileURLToPath(new URL("./tests/stubs/server-only.ts", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["tests/integration/**/*.test.ts"],
    globals: true,
    // These share one database, so they must not run against each other.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
