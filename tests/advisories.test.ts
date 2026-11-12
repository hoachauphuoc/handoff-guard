/// <reference types="vite/client" />
import { describe, expect, it } from "vitest";
import { runCheckHandoff, runGatherHandoffContext, type Deps } from "../src/actions/core";
import { watchConflicts } from "../src/rules/advisories";
import { checkHandoff } from "../src/rules/checkHandoff";
import type { Decision, Handoff, WorkItem } from "../src/rules/types";
import build from "../src/handoff/build?raw";
import rules from "../src/rules/checkHandoff?raw";
import validator from "../src/validator?raw";
import measure from "../scripts/measure.ts?raw";

const item = (over: Partial<WorkItem> = {}): WorkItem => ({
  key: "OPS-1",
  projectKey: "OPS",
  summary: "s",
  description: "Body.",
  labels: [],
  components: [],
  dueDate: "2026-12-10",
  assigneeId: "a",
  ...over,
});
const decision = (over: Partial<Decision> = {}): Decision => ({
  id: "d1",
  title: "Ship by mid December",
  status: "decided",
  source: { kind: "ledger", ref: "demo" },
  scope: { kind: "project", projectKey: "OPS" },
  constraints: [{ kind: "dueNotAfter", date: "2026-12-12" }],
  ...over,
});
const kinds = (w: WorkItem, ds: Decision[]) => watchConflicts(w, ds).map((a) => a.kind);

describe("description_date_after_due", () => {
  it("lists each later valid date once, at most 3, as plain facts", () => {
    const w = item({
      description:
        "Go live 2026-12-20, review 2026-12-20, retro 2027-01-05, 2027-02-30 is not a date, 2027-02-01, 2027-03-01, earlier 2026-12-01",
    });
    expect(watchConflicts(w, []).map((a) => a.message)).toEqual([
      "The description mentions 2026-12-20, later than the due date 2026-12-10.",
      "The description mentions 2027-01-05, later than the due date 2026-12-10.",
      "The description mentions 2027-02-01, later than the due date 2026-12-10.",
    ]);
  });
  it("is silent for earlier dates, no due date or a malformed due date", () => {
    expect(kinds(item({ description: "on 2026-12-01" }), [])).toEqual([]);
    expect(kinds(item({ dueDate: null, description: "on 2027-01-01" }), [])).toEqual([]);
    expect(kinds(item({ dueDate: "soon", description: "on 2027-01-01" }), [])).toEqual([]);
  });
});

describe("due_before_limit", () => {
  it("names a gap of 0 to 2 days", () => {
    expect(watchConflicts(item(), [decision()]).map((a) => a.message)).toEqual([
      'The due date 2026-12-10 is 2 days before the limit 2026-12-12 in "Ship by mid December".',
    ]);
    expect(watchConflicts(item({ dueDate: "2026-12-11" }), [decision()])[0]?.message).toContain("1 day before");
    expect(watchConflicts(item({ dueDate: "2026-12-12" }), [decision()])[0]?.message).toContain("0 days before");
  });
  it("is silent for 3 or more days, after the limit, or a bad limit", () => {
    expect(kinds(item({ dueDate: "2026-12-09" }), [decision()])).toEqual([]);
    expect(kinds(item({ dueDate: "2026-12-13" }), [decision()])).toEqual([]);
    expect(kinds(item(), [decision({ constraints: [{ kind: "dueNotAfter", date: "2026-13-40" }] })])).toEqual([]);
  });
});

describe("different_limits", () => {
  const second = decision({ id: "d2", title: "Second", constraints: [{ kind: "dueNotAfter", date: "2027-01-31" }] });
  it("reports distinct limits, even without a due date", () => {
    expect(watchConflicts(item({ dueDate: null }), [decision(), second])).toEqual([
      {
        kind: "different_limits",
        message:
          "Decisions set different date limits: Ship by mid December (2026-12-12), Second (2027-01-31); the rule check uses the earliest.",
        decisionIds: ["d1", "d2"],
      },
    ]);
  });
  it("is silent for equal limits or one decision", () => {
    expect(kinds(item({ dueDate: null }), [decision(), decision({ id: "d2" })])).toEqual([]);
    expect(kinds(item({ dueDate: null }), [decision()])).toEqual([]);
  });
});

describe("wording", () => {
  it("never says conflict or risk", () => {
    const later = decision({ id: "d2", constraints: [{ kind: "dueNotAfter", date: "2027-01-31" }] });
    const all = watchConflicts(item({ description: "2027-01-01" }), [decision(), later]);
    expect(all.length).toBeGreaterThanOrEqual(3);
    for (const a of all) expect(a.message).not.toMatch(/conflict|risk/i);
  });
});

// A tiny seeded generator, so the mutations are the same on every run.
const lcg = (seed: number) => () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32;
type SampleFile = { samples?: { handoff: Handoff; decisions: Decision[] }[] };
const files = Object.values(import.meta.glob("../data/samples/*.json", { eager: true, import: "default" })) as SampleFile[];

describe("watching never touches the verdict", () => {
  it("leaves checkHandoff's result identical over the samples and 300 mutations", () => {
    const base = files.flatMap((f) => f.samples ?? []);
    expect(base.length).toBeGreaterThan(0);
    const rnd = lcg(42);
    const below = (n: number) => Math.floor(rnd() * n);
    const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));
    const shift = (iso: string, days: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
    const cases = base.map((s) => ({ h: s.handoff, d: s.decisions }));
    for (let i = 0; i < 300; i++) {
      const s = base[below(base.length)] as (typeof base)[number];
      const h: Handoff = structuredClone(s.handoff);
      const d: Decision[] = structuredClone(s.decisions);
      switch (below(5)) {
        case 0:
          if (h.item.dueDate && isDate(h.item.dueDate)) h.item.dueDate = shift(h.item.dueDate, below(9) - 4);
          break;
        case 1:
          h.item.labels.push("l" + below(3));
          break;
        case 2:
          h.item.labels.pop();
          break;
        case 3:
          h.item.components.push("c" + below(3));
          break;
        default:
          for (const dec of d) for (const c of dec.constraints) if (c.kind === "dueNotAfter" && isDate(c.date)) c.date = shift(c.date, below(5) - 2);
      }
      cases.push({ h, d });
    }
    for (const { h, d } of cases) {
      const before = JSON.stringify(checkHandoff(h, d));
      const input = JSON.stringify([h, d]);
      watchConflicts(h.item, checkHandoff(h, d).binding);
      expect(JSON.stringify(checkHandoff(h, d))).toBe(before);
      expect(JSON.stringify([h, d])).toBe(input);
    }
  });
});

describe("advisories are a sibling field", () => {
  const near = item({ description: "launch 2027-01-01" });
  const dec = [decision()];
  const record = { fromId: "f", toId: "t", acknowledged: ["d1"], preparedAt: "t", acknowledgedAt: {} };
  const deps = (): Deps => ({
    readItem: async () => ({ item: near, issueId: "1" }),
    getDecisions: async () => dec,
    getRecord: async () => record,
    readSource: async () => ({ issueId: "1", projectKey: "OPS", labels: [], parts: [], truncated: false }),
    getProposals: async () => [],
    putProposals: async () => {},
    people: async () => ({ status: "nothing", sharedWith: [], mentioned: [] }),
    now: () => "2026-11-12T00:00:00.000Z",
  });

  it("check-handoff matches the direct rule check and carries no advisories", async () => {
    const out = await runCheckHandoff({ issueKey: "OPS-1" }, null, deps());
    const direct = checkHandoff({ item: near, fromId: "f", toId: "t", acknowledged: ["d1"] }, dec);
    if (!out.ok) throw new Error("expected ok");
    expect(out.verdict).toBe(direct.verdict);
    expect(out.findings).toEqual(direct.findings);
    expect(out.quote).toBe("Handoff Guard rule check for OPS-1: Clear. No findings.");
    expect(JSON.stringify(out)).not.toMatch(/advisor|description mentions/i);
  });

  it("gather carries them beside check, and check stays the plain check result", async () => {
    const out = await runGatherHandoffContext({ issueKey: "OPS-1" }, null, deps());
    const plain = await runCheckHandoff({ issueKey: "OPS-1" }, null, deps());
    if (!out.ok) throw new Error("expected ok");
    expect(out.check).toEqual(plain);
    expect(out.advisories.map((a) => a.kind)).toEqual(["description_date_after_due", "due_before_limit"]);
    expect(JSON.stringify(out.check)).not.toContain("advisories");
    expect(out.quote).not.toContain("description mentions");
  });

  it("gather has none without a handoff basis", async () => {
    const out = await runGatherHandoffContext({ issueKey: "OPS-1" }, null, { ...deps(), getRecord: async () => null });
    expect(out.ok && out.advisories).toEqual([]);
  });
});

describe("verdict-path sources", () => {
  it("never mention the advisories", () => {
    for (const src of [rules, validator, build, measure]) expect(src).not.toMatch(/advisor/i);
  });
});
