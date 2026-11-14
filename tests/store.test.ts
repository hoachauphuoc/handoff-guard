import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Decision } from "../src/rules/types";

const data = new Map<string, unknown>();
vi.mock("@forge/kvs", () => ({
  kvs: { get: async (k: string) => data.get(k), set: async (k: string, v: unknown) => void data.set(k, v) },
}));
const { getDecisions, updateDecisions } = await import("../src/store");

const dec = (id: string, projectKey: string): Decision => ({
  id,
  title: id,
  status: "decided",
  source: { kind: "ledger", ref: "x" },
  scope: { kind: "project", projectKey },
  constraints: [{ kind: "dueNotAfter", date: "2026-12-31" }],
});

beforeEach(() => data.clear());

describe("per-project decisions", () => {
  it("reads this project's decisions from the old site-wide key until the new key exists, and never writes the old key", async () => {
    data.set("decisions", [dec("a", "OPS"), dec("b", "HR")]);
    expect((await getDecisions("OPS")).map((d) => d.id)).toEqual(["a"]);
    await updateDecisions("OPS", (c) => [...c, dec("c", "OPS")]);
    expect((await getDecisions("OPS")).map((d) => d.id)).toEqual(["a", "c"]);
    expect((data.get("decisions") as Decision[]).map((d) => d.id)).toEqual(["a", "b"]);
  });

  it("keeps projects apart", async () => {
    await updateDecisions("OPS", () => [dec("a", "OPS")]);
    await updateDecisions("HR", () => [dec("b", "HR")]);
    expect((await getDecisions("OPS")).map((d) => d.id)).toEqual(["a"]);
    expect((await getDecisions("HR")).map((d) => d.id)).toEqual(["b"]);
  });

  it("does not store a decision that belongs to another project", async () => {
    await updateDecisions("OPS", () => [dec("a", "OPS"), dec("b", "HR")]);
    expect((await getDecisions("OPS")).map((d) => d.id)).toEqual(["a"]);
  });

  it("refuses a save when someone else saved in between", async () => {
    await updateDecisions("OPS", () => [dec("a", "OPS")]);
    await expect(
      updateDecisions("OPS", (c) => {
        data.set("decisions:ops", { version: 99, decisions: [] });
        return c;
      }),
    ).rejects.toThrow("Someone else changed");
  });
});

describe("purgeLegacyDecisions", () => {
  it("removes only this project's decisions from the old key and keeps an old site-wide label decision", async () => {
    const { purgeLegacyDecisions } = await import("../src/store");
    const siteWide: Decision = { ...dec("l", "OPS"), scope: { kind: "label", label: "launch" } };
    data.set("decisions", [dec("a", "OPS"), dec("b", "HR"), siteWide]);
    expect(await purgeLegacyDecisions("ops")).toBe(1);
    expect((data.get("decisions") as Decision[]).map((d) => d.id)).toEqual(["b", "l"]);
  });
});
