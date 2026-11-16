import { defineConfig } from "vitest/config";

// Coverage is read over the product code only. The UI files are rendered by Forge, which no test here runs,
// so they are left out instead of counted as untested.
export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/frontend/**", "src/**/*.d.ts"],
      reporter: ["text-summary", "text"],
      // Set just under the figures of 2026-11-16 (90.8 / 92.0 / 86.5): CI fails when a change lowers them.
      thresholds: { statements: 90, branches: 90, functions: 85, lines: 90 },
    },
  },
});
