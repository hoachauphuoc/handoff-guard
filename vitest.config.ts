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
      // The figures move between runs of the same code (statements 88.3 to 90.8 on 2026-11-16, Windows and CI): the
      // report shows three large files (checkHandoff.ts, next.ts, context.ts) as one uncovered line in some runs.
      // So these are a floor that catches a real drop, not a target; cause not found yet.
      thresholds: { statements: 85, branches: 85, functions: 80, lines: 85 },
    },
  },
});
