/// <reference types="vite/client" />
import { describe, expect, it } from "vitest";
import rulesSource from "../src/rules/checkHandoff?raw";
import validatorSource from "../src/validator?raw";
import { checkHandoff } from "../src/rules/checkHandoff";
import { changeText, feasibleSpace, suggestFixes } from "../src/rules/feasible";
import type { Decision, WorkItem } from "../src/rules/types";

const item = (over: Partial<WorkItem> = {}): WorkItem => ({
  key: "OPS-12",
  projectKey: "OPS",
  summary: "Launch the spring campaign",
  description: "Landing page, mailing list and budget are attached.",
  labels: ["campaign"],
  components: [],
  dueDate: "2026-12-10",
  assigneeId: "u-sender",
  ...over,
});

const decision = (over: Partial<Decision> = {}): Decision => ({
  id: "D-1",
  title: "Campaigns ship before 15 December",
  status: "decided",
  source: { kind: "ledger", ref: "demo" },
  scope: { kind: "label", label: "campaign" },
  constraints: [{ kind: "dueNotAfter", date: "2026-12-15" }],
  ...over,
});

const contradictions = (w: WorkItem, ds: Decision[]) =>
  checkHandoff({ item: w, fromId: "a", toId: "b", acknowledged: ds.map((d) => d.id) }, ds).findings.filter(
    (f) => f.rule === "contradicts_decision",
  );

describe("feasibleSpace", () => {
  it("takes the earliest valid date limit and reports a malformed one without using it", () => {
    const s = feasibleSpace([
      decision({ id: "a", constraints: [{ kind: "dueNotAfter", date: "2026-12-15" }] }),
      decision({ id: "b", constraints: [{ kind: "dueNotAfter", date: "2026-12-01" }] }),
      decision({ id: "c", title: "Bad", constraints: [{ kind: "dueNotAfter", date: "2026-13-01" }] }),
    ]);
    expect(s.latestDueDate).toBe("2026-12-01");
    expect(s.invalidConstraints).toEqual([{ decisionId: "c", title: "Bad", constraint: "2026-13-01" }]);
  });

  it("lists each label and component once, compared the way the rules compare", () => {
    const s = feasibleSpace([
      decision({ constraints: [{ kind: "labelRequired", label: "legal-reviewed" }, { kind: "componentForbidden", component: "legacy" }] }),
      decision({ id: "D-2", constraints: [{ kind: "labelRequired", label: "Legal-Reviewed " }, { kind: "componentForbidden", component: "LEGACY" }] }),
    ]);
    expect(s.requiredLabels).toEqual(["legal-reviewed"]);
    expect(s.forbiddenComponents).toEqual(["legacy"]);
  });
});

describe("suggestFixes", () => {
  it("suggests nothing when the item already fits", () => {
    const out = suggestFixes(item(), [decision()]);
    expect(out.changes).toEqual([]);
    expect(out.after).toEqual(item());
  });

  it("moves a late, missing or malformed due date to the limit", () => {
    for (const dueDate of ["2026-12-20", null, "next week"]) {
      const out = suggestFixes(item({ dueDate }), [decision()]);
      expect(out.changes).toEqual([
        { field: "dueDate", from: dueDate, to: "2026-12-15", because: ["Campaigns ship before 15 December"] },
      ]);
      expect(out.after.dueDate).toBe("2026-12-15");
    }
  });

  it("adds a required label and removes a forbidden component, keeping the item's own spelling", () => {
    const d = decision({
      scope: { kind: "project", projectKey: "OPS" },
      constraints: [{ kind: "labelRequired", label: "legal-reviewed" }, { kind: "componentForbidden", component: "legacy-billing" }],
    });
    const out = suggestFixes(item({ components: ["Legacy-Billing", "web"] }), [d]);
    expect(out.after.labels).toEqual(["campaign", "legal-reviewed"]);
    expect(out.after.components).toEqual(["web"]);
    expect(out.changes.map(changeText)).toEqual([
      'Add label "legal-reviewed" ("Campaigns ship before 15 December")',
      'Remove component "Legacy-Billing" ("Campaigns ship before 15 December")',
    ]);
  });

  it("follows a label that brings a label-scoped decision into force", () => {
    const ds = [
      decision({ id: "p", title: "Launch needs legal", scope: { kind: "project", projectKey: "OPS" }, constraints: [{ kind: "labelRequired", label: "legal" }] }),
      decision({ id: "l", title: "Legal items ship by 1 Dec", scope: { kind: "label", label: "legal" }, constraints: [{ kind: "dueNotAfter", date: "2026-12-01" }] }),
    ];
    const out = suggestFixes(item({ labels: [] }), ds);
    expect(out.after.labels).toEqual(["legal"]);
    expect(out.after.dueDate).toBe("2026-12-01");
    expect(out.changes[0]).toMatchObject({ field: "dueDate", from: "2026-12-10", to: "2026-12-01", because: ["Legal items ship by 1 Dec"] });
  });

  it("ignores superseded decisions and decisions that do not bind the item", () => {
    const ds = [
      decision({ status: "superseded", constraints: [{ kind: "labelRequired", label: "x" }] }),
      decision({ id: "o", scope: { kind: "project", projectKey: "OTHER" }, constraints: [{ kind: "labelRequired", label: "y" }] }),
    ];
    expect(suggestFixes(item(), ds).changes).toEqual([]);
  });

  it("leaves no contradiction for the rule check to find", () => {
    const ds = [
      decision({ id: "1", scope: { kind: "project", projectKey: "OPS" }, constraints: [{ kind: "labelRequired", label: "a" }, { kind: "componentForbidden", component: "old" }] }),
      decision({ id: "2", scope: { kind: "label", label: "a" }, constraints: [{ kind: "labelRequired", label: "b" }, { kind: "dueNotAfter", date: "2026-11-30" }] }),
      decision({ id: "3", scope: { kind: "label", label: "b" }, constraints: [{ kind: "componentForbidden", component: "web" }, { kind: "dueNotAfter", date: "2026-11-20" }] }),
      decision({ id: "4", scope: { kind: "workItem", key: "OPS-12" }, constraints: [{ kind: "dueNotAfter", date: "not-a-date" }] }),
    ];
    const start = item({ labels: [], components: ["old", "web", "api"], dueDate: "2027-01-05" });
    expect(contradictions(start, ds).length).toBeGreaterThan(0);
    const out = suggestFixes(start, ds);
    expect(contradictions(out.after, ds)).toEqual([]);
    expect(out.after.components).toEqual(["api"]);
    expect(out.after.dueDate).toBe("2026-11-20");
    expect(out.space.invalidConstraints).toHaveLength(1);
  });
});

describe("feasible stays out of the verdict path", () => {
  it("is not imported by checkHandoff.ts or validator.ts", () => {
    expect(rulesSource).not.toMatch(/feasible/);
    expect(validatorSource).not.toMatch(/feasible/);
  });
});
