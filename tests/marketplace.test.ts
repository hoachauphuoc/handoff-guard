/// <reference types="vite/client" />
import { describe, expect, it } from "vitest";
import manifest from "../manifest.yml?raw";
import readme from "../README.md?raw";

const list = (re: RegExp, text: string) => [...text.matchAll(re)].map((m) => m[1]).sort();

describe("scopes", () => {
  const scopes = manifest.slice(manifest.indexOf("  scopes:"));
  const manifestScopes = list(/^ {4}- (\S+)\s*$/gm, scopes);
  const tableScopes = list(/^\| `([^`]+)` \|/gm, readme);

  it("are exactly the scopes in the README table", () => {
    expect(manifestScopes.length).toBeGreaterThan(0);
    expect(tableScopes).toEqual(manifestScopes);
  });

  it("have no external egress", () => {
    expect(manifest).not.toMatch(/external:/);
  });

  it("state the honesty lines", () => {
    expect(readme).toContain("synthetic");
    expect(readme).toContain("written by a model");
    expect(readme).toContain("agreement with Muse labels");
  });
});
