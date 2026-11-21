import { tmpdir } from "node:os";
import { join } from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  cacheDir: join(tmpdir(), "robokan-circuit-vitest-cache"),
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    watch: false,
  },
});
