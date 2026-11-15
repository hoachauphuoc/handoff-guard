/// <reference types="vite/client" />
import { describe, expect, it } from "vitest";

const sources = import.meta.glob("../src/**/*.{ts,tsx}", { query: "?raw", import: "default", eager: true }) as Record<string, string>;
const code = (text: string): string => text.split(/\r?\n/).filter((l) => !l.trim().startsWith("//") && !l.trim().startsWith("*")).join("\n");

describe("product principles that a grep can hold", () => {
  it("src/rules is pure: no Forge, network, clock or randomness", () => {
    const rules = Object.entries(sources).filter(([path]) => path.startsWith("../src/rules/"));
    expect(rules.length).toBeGreaterThan(3);
    for (const [path, text] of rules) {
      for (const banned of [/@forge\//, /\bfetch\(/, /Date\.now\(/, /new Date\(\)/, /process\.env/, /Math\.random\(/]) {
        expect(code(text), `${path} uses ${banned}`).not.toMatch(banned);
      }
    }
  });

  it("only src/store.ts writes to Forge storage, and only the records the privacy notes list (no chat)", () => {
    for (const [path, text] of Object.entries(sources)) {
      if (path === "../src/store.ts") continue;
      expect(code(text), `${path} touches storage`).not.toMatch(/kvs\.(set|delete)|storage\.(set|delete)/);
    }
    const keys = [...code(sources["../src/store.ts"] as string).matchAll(/`([a-z-]+):\$\{/g)].map((m) => m[1]);
    expect(new Set(keys)).toEqual(new Set(["decisions", "handoff", "proposals", "audit", "settings", "receipt-draft", "condition-drafts"]));
  });
});
