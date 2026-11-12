/// <reference types="vite/client" />
import { describe, expect, it } from "vitest";
import { buildDecisionsPage } from "../src/decisions/page";
import { hypothetical } from "../src/decisions/hypothetical";
import { itemsFromSearch } from "../src/handoff/build";
import { inFlight } from "../src/handoff/inflight";
import type { HandoffRecord } from "../src/handoff/types";
import { impactOf } from "../src/rules/impact";
import type { Decision, WorkItem } from "../src/rules/types";
import rulesSource from "../src/rules/checkHandoff?raw";
import validatorSource from "../src/validator?raw";

const item = (key: string, over: Partial<WorkItem> = {}): WorkItem => ({
  key,
  projectKey: "OPS",
  summary: `s ${key}`,
  description: "d",
  labels: [],
  components: [],
  dueDate: "2026-12-01",
  assigneeId: null,
  ...over,
});
const decision = (over: Partial<Decision> = {}): Decision => ({
  id: "d1",
  title: "Ship by mid December",
  status: "decided",
  source: { kind: "ledger", ref: "demo" },
  scope: { kind: "project", projectKey: "OPS" },
  constraints: [{ kind: "dueNotAfter", date: "2026-12-15" }],
  ...over,
});
const record = (over: Partial<HandoffRecord> = {}): HandoffRecord => ({ fromId: "a", toId: "b", acknowledged: [], preparedAt: "2026-11-01T00:00:00.000Z", acknowledgedAt: {}, ...over });
const NOW = "2026-11-12T00:00:00.000Z";

describe("impactOf", () => {
  const items = [item("OPS-1"), item("OPS-2", { dueDate: "2026-12-20" }), item("OPS-3", { dueDate: null }), item("OTHER-1", { projectKey: "OTHER", dueDate: "2027-01-01" })];

  it("lists the items that contradict the decision, with the reason, and skips items it does not bind", () => {
    expect(impactOf(decision(), items)).toEqual([{ key: "OPS-2", reasons: ['Contradicts "Ship by mid December": due date 2026-12-20 is after 2026-12-15.'] }]);
  });

  it("counts nothing for a superseded decision or a limit that is not a date", () => {
    expect(impactOf(decision({ status: "superseded" }), items)).toEqual([]);
    expect(impactOf(decision({ constraints: [{ kind: "dueNotAfter", date: "soon" }] }), items)).toEqual([]);
  });

  it("agrees with the rule check on every item", () => {
    const d = decision({ constraints: [{ kind: "labelRequired", label: "legal" }] });
    expect(impactOf(d, items).map((i) => i.key)).toEqual(["OPS-1", "OPS-2", "OPS-3"]);
  });

  it("counts a proposal through hypothetical() without storing or binding it", () => {
    const p = { id: "p-1", title: "T", scope: { kind: "project" as const, projectKey: "OPS" }, constraints: [{ kind: "dueNotAfter" as const, date: "2026-11-30" }], evidence: { quote: "q", from: "OPS-1 description" }, proposedAt: "t" };
    expect(impactOf(hypothetical(p), items).map((i) => i.key)).toEqual(["OPS-1", "OPS-2"]);
  });
});

describe("inFlight", () => {
  it("lists handoffs that are not clear, blocked first then oldest, with the decision that blocks", () => {
    const d = decision();
    const entries = [
      { item: item("OPS-1"), record: record({ acknowledged: ["d1"] }) }, // clear: dropped
      { item: item("OPS-2"), record: record({ preparedAt: "2026-11-10T00:00:00.000Z" }) }, // needs info
      { item: item("OPS-3", { dueDate: "2026-12-20" }), record: record({ preparedAt: "2026-11-11T00:00:00.000Z" }) }, // blocked
      { item: item("OPS-4", { dueDate: "2026-12-20" }), record: record({ preparedAt: "2026-10-01T00:00:00.000Z" }) }, // blocked, older
      { item: item("OPS-5"), record: null },
    ];
    const out = inFlight(entries, [d], NOW);
    expect(out.map((h) => [h.key, h.verdict, h.ageDays])).toEqual([["OPS-4", "blocked", 42], ["OPS-3", "blocked", 1], ["OPS-2", "needs_info", 2]]);
    expect(out[0]?.blockedBy).toEqual(["Ship by mid December"]);
    expect(out[2]?.unacknowledged).toBe(1);
  });
});

describe("buildDecisionsPage", () => {
  it("shows this project's decisions with their counts and says when the cap was hit", () => {
    const decisions = [decision(), decision({ id: "d2", scope: { kind: "project", projectKey: "ELSE" } }), decision({ id: "d3", status: "superseded" })];
    const open = [{ item: item("OPS-1", { dueDate: "2026-12-30" }), record: null }, { item: item("OPS-2"), record: null }];
    const page = buildDecisionsPage("OPS", decisions, open, true, NOW, "viewer");
    expect(page.rows.map((r) => r.id)).toEqual(["d1", "d3"]);
    expect(page.rows[0]?.impact).toEqual({ count: 1, keys: ["OPS-1"] });
    expect(page.rows[1]?.impact).toBeNull();
    expect(page).toMatchObject({ scanned: 2, capped: true });
  });
});

describe("itemsFromSearch", () => {
  it("reads issues and reports a cut list, tolerating junk", () => {
    const out = itemsFromSearch({ issues: [{ id: "1", key: "OPS-1", fields: { summary: "x", project: { key: "OPS" } } }, { key: 5 }, null], nextPageToken: "t" });
    expect(out.items.map((i) => [i.item.key, i.issueId, i.item.projectKey])).toEqual([["OPS-1", "1", "OPS"]]);
    expect(out.capped).toBe(true);
    expect(itemsFromSearch({ issues: [], isLast: true }).capped).toBe(false);
    expect(itemsFromSearch(null)).toEqual({ items: [], capped: false });
  });
});

describe("the decisions page stays out of the verdict path", () => {
  it("is not read by the rule check or the validator", () => {
    for (const src of [rulesSource, validatorSource]) expect(src).not.toMatch(/impact|inflight|hypothetical/i);
  });
});
