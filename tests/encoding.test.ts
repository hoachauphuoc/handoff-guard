/// <reference types="vite/client" />
import { describe, expect, it } from "vitest";

// Read as text through Vite so no node:fs is needed. Eager and raw: every source and test file.
const files = {
  ...import.meta.glob("../src/**/*.{ts,tsx}", { query: "?raw", import: "default", eager: true }),
  ...import.meta.glob("./**/*.ts", { query: "?raw", import: "default", eager: true }),
} as Record<string, string>;

// UTF-8 text that was decoded as Windows-1252 and saved again shows a lead character (A-tilde, A-circumflex,
// a-circumflex) followed by a continuation byte shown as a symbol, for example the ellipsis becoming three
// odd characters. Built from code points so this file does not contain the sequences it forbids.
const LEAD = "[\u00c2-\u00f4]";
const TRAIL = "[\u0080-\u00bf\u20ac\u201a\u0192\u201e\u2026\u2020\u2021\u02c6\u2030\u0160\u2039\u0152\u017d\u2018\u2019\u201c\u201d\u2022\u2013\u2014\u02dc\u2122\u0161\u203a\u0153\u017e\u0178]";
const DOUBLE_ENCODED = new RegExp(`${LEAD}${TRAIL}`);

describe("text encoding", () => {
  it("finds the files it is meant to scan", () => {
    expect(Object.keys(files).length).toBeGreaterThan(20);
  });

  it("has no double-encoded text under src/ or tests/", () => {
    const bad = Object.entries(files)
      .filter(([, text]) => DOUBLE_ENCODED.test(text))
      .map(([path]) => path);
    expect(bad).toEqual([]);
  });

  // A byte that is not valid UTF-8 (for example a Windows-1252 bullet written by a script) is read back as U+FFFD.
  it("has no replacement characters under src/ or tests/", () => {
    const bad = Object.entries(files)
      .filter(([, text]) => text.includes(String.fromCharCode(0xfffd)))
      .map(([path]) => path);
    expect(bad).toEqual([]);
  });

  it("detects the known bad ellipsis", () => {
    expect(DOUBLE_ENCODED.test("handoffâ€¦")).toBe(true);
    expect(DOUBLE_ENCODED.test("handoff…")).toBe(false);
  });
});
