import { describe, expect, it } from "vitest";
import { bindingDecisions, checkHandoff, checkItem } from "../src/rules/checkHandoff";
import type { Decision, Handoff, WorkItem } from "../src/rules/types";

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

const handoff = (over: Partial<Handoff> = {}): Handoff => ({
  item: item(),
  fromId: "u-sender",
  toId: "u-receiver",
  acknowledged: [],
  ...over,
});

const decision = (over: Partial<Decision> = {}): Decision => ({
  id: "D-1",
  title: "Campaigns ship before 15 December",
  status: "decided",
  source: { kind: "confluence", ref: "page-101" },
  scope: { kind: "label", label: "campaign" },
  constraints: [{ kind: "dueNotAfter", date: "2026-12-15" }],
  ...over,
});

const rules = (r: ReturnType<typeof checkHandoff>) => r.findings.map((f) => f.rule);

describe("checkHandoff", () => {
  it("is clear when nothing is missing and no decision binds", () => {
    const r = checkHandoff(handoff(), []);
    expect(r).toEqual({ verdict: "clear", findings: [], binding: [] });
  });

  it("blocks a handoff with no receiver or to the sender", () => {
    expect(checkHandoff(handoff({ toId: null }), []).verdict).toBe("blocked");
    expect(rules(checkHandoff(handoff({ toId: "u-sender" }), []))).toEqual(["same_person"]);
  });

  it("asks for information when description or due date is missing", () => {
    const r = checkHandoff(handoff({ item: item({ description: "  ", dueDate: null }) }), []);
    expect(r.verdict).toBe("needs_info");
    expect(rules(r)).toEqual(["empty_description", "no_due_date"]);
  });

  it("blocks work that contradicts a binding decision and names the decision", () => {
    const r = checkHandoff(handoff({ item: item({ dueDate: "2026-12-20" }), acknowledged: ["D-1"] }), [decision()]);
    expect(r.verdict).toBe("blocked");
    expect(r.findings).toEqual([
      {
        rule: "contradicts_decision",
        severity: "block",
        message: 'Contradicts "Campaigns ship before 15 December": due date 2026-12-20 is after 2026-12-15.',
        decisionId: "D-1",
      },
    ]);
  });

  it("needs acknowledgement of a binding decision even when the work complies", () => {
    const r = checkHandoff(handoff(), [decision()]);
    expect(r.verdict).toBe("needs_info");
    expect(rules(r)).toEqual(["decision_not_acknowledged"]);
    expect(checkHandoff(handoff({ acknowledged: ["D-1"] }), [decision()]).verdict).toBe("clear");
  });

  it("checks required labels and forbidden components", () => {
    const d = decision({
      id: "D-2",
      title: "Legal reviews every campaign",
      constraints: [
        { kind: "labelRequired", label: "legal-reviewed" },
        { kind: "componentForbidden", component: "legacy-mailer" },
      ],
    });
    const r = checkHandoff(
      handoff({ item: item({ components: ["legacy-mailer"] }), acknowledged: ["D-2"] }),
      [d],
    );
    expect(r.verdict).toBe("blocked");
    expect(r.findings.map((f) => f.message)).toEqual([
      'Contradicts "Legal reviews every campaign": label "legal-reviewed" is missing.',
      'Contradicts "Legal reviews every campaign": component "legacy-mailer" is not allowed.',
    ]);
  });

  it("ignores superseded decisions and decisions scoped elsewhere", () => {
    const decisions = [
      decision({ id: "D-old", status: "superseded" }),
      decision({ id: "D-other", scope: { kind: "project", projectKey: "HR" } }),
      decision({ id: "D-item", scope: { kind: "workItem", key: "OPS-12" }, constraints: [] }),
    ];
    expect(bindingDecisions(decisions, item()).map((d) => d.id)).toEqual(["D-item"]);
  });

  it("does not report a missing due date twice when a decision limits the date", () => {
    const r = checkHandoff(handoff({ item: item({ dueDate: null }), acknowledged: ["D-1"] }), [decision()]);
    expect(rules(r)).toEqual(["no_due_date"]);
  });

  it("asks for the sender when it is missing", () => {
    const r = checkHandoff(handoff({ fromId: null }), []);
    expect(r.verdict).toBe("needs_info");
    expect(rules(r)).toEqual(["no_sender"]);
    expect(rules(checkHandoff(handoff({ fromId: null, toId: null }), []))).toEqual(["no_sender", "no_receiver"]);
  });

  it("treats ids, labels and components as the same when only case or outer spaces differ", () => {
    expect(rules(checkHandoff(handoff({ fromId: "u-ana", toId: " U-Ana" }), []))).toEqual(["same_person"]);

    const d = decision({
      id: "D-3",
      scope: { kind: "label", label: "Campaign " },
      constraints: [
        { kind: "labelRequired", label: "legal-reviewed" },
        { kind: "componentForbidden", component: "legacy-mailer" },
      ],
    });
    const ok = item({ labels: ["campaign", "Legal-Reviewed "] });
    expect(checkHandoff(handoff({ item: ok, acknowledged: ["D-3"] }), [d]).verdict).toBe("clear");
    const bad = item({ labels: ["campaign", "legal-reviewed"], components: ["Legacy-Mailer"] });
    expect(rules(checkHandoff(handoff({ item: bad, acknowledged: ["D-3"] }), [d]))).toEqual(["contradicts_decision"]);
  });

  it("reports a malformed due date instead of comparing it", () => {
    for (const dueDate of ["2026-2-9", "2026-02-30", "next week"]) {
      const r = checkHandoff(handoff({ item: item({ dueDate }), acknowledged: ["D-1"] }), [decision()]);
      expect(r.verdict).toBe("needs_info");
      expect(rules(r)).toEqual(["invalid_due_date"]);
    }
  });

  it("matches project and work-item keys ignoring case and spaces", () => {
    const byProject = decision({ scope: { kind: "project", projectKey: " ops " } });
    expect(checkHandoff(handoff(), [byProject]).binding).toHaveLength(1);
    const byItem = decision({ scope: { kind: "workItem", key: "ops-12" } });
    expect(checkHandoff(handoff(), [byItem]).binding).toHaveLength(1);
  });

  it("reports a malformed date limit in a decision once, never as a contradiction", () => {
    const d = decision({ constraints: [{ kind: "dueNotAfter", date: "2026-13-01" }] });
    const r = checkHandoff(handoff({ acknowledged: ["D-1"] }), [d]);
    expect(r.verdict).toBe("needs_info");
    expect(r.findings).toEqual([
      expect.objectContaining({ rule: "invalid_constraint", decisionId: "D-1", severity: "info_needed" }),
    ]);
    expect(r.findings[0]?.message).toBe(
      '"Campaigns ship before 15 December" has a date limit "2026-13-01" that is not a valid YYYY-MM-DD date.',
    );
  });

  it("never returns clear together with a finding", () => {
    const cases = [
      handoff(),
      handoff({ toId: null }),
      handoff({ item: item({ dueDate: null }) }),
      handoff({ item: item({ dueDate: "2027-01-01" }) }),
    ];
    for (const h of cases) {
      const r = checkHandoff(h, [decision()]);
      expect(r.verdict === "clear").toBe(r.findings.length === 0);
    }
  });
});

describe("checkItem", () => {
  it("reports only what the work item breaks, with no handoff rules", () => {
    // No sender, receiver, acknowledgement, description or due-date finding can come from here.
    expect(checkItem(item({ description: "", dueDate: null }), [decision()])).toEqual([]);
    const late = checkItem(item({ dueDate: "2026-12-20" }), [decision()]);
    expect(late.map((f) => [f.rule, f.severity, f.decisionId])).toEqual([["contradicts_decision", "block", "D-1"]]);
  });

  it("ignores decisions that do not bind and reports a bad constraint as missing information", () => {
    expect(checkItem(item({ dueDate: "2026-12-20" }), [decision({ status: "superseded" })])).toEqual([]);
    expect(checkItem(item({ labels: [], dueDate: "2026-12-20" }), [decision()])).toEqual([]);
    const bad = checkItem(item(), [decision({ constraints: [{ kind: "dueNotAfter", date: "soon" }] })]);
    expect(bad.map((f) => [f.rule, f.severity])).toEqual([["invalid_constraint", "info_needed"]]);
  });

  it("agrees with checkHandoff on every decision finding", () => {
    const it2 = item({ dueDate: "2026-12-20", labels: ["campaign"] });
    const ds = [decision(), decision({ id: "D-2", title: "Needs review", constraints: [{ kind: "labelRequired", label: "reviewed" }] })];
    const fromHandoff = checkHandoff(handoff({ item: it2, acknowledged: ["D-1", "D-2"] }), ds).findings;
    expect(checkItem(it2, ds)).toEqual(fromHandoff);
  });
});

describe("labelForbidden and componentRequired", () => {
  const forbid = decision({ constraints: [{ kind: "labelForbidden", label: "Draft " }] });
  const need = decision({ id: "D-2", title: "Campaigns name their owner team", constraints: [{ kind: "componentRequired", component: "marketing" }] });

  it("blocks an item that carries a forbidden label, comparing the way the rules do", () => {
    const r = checkHandoff(handoff({ item: item({ labels: ["campaign", "DRAFT"] }), acknowledged: ["D-1"] }), [forbid]);
    expect(r.verdict).toBe("blocked");
    expect(r.findings.map((f) => f.message)).toEqual(['Contradicts "Campaigns ship before 15 December": label "Draft " is not allowed.']);
  });

  it("blocks an item that lacks a required component and passes once it has it", () => {
    const base = { acknowledged: ["D-2"] };
    const bad = checkHandoff(handoff({ ...base }), [need]);
    expect(bad.findings.map((f) => f.message)).toEqual(['Contradicts "Campaigns name their owner team": component "marketing" is missing.']);
    expect(checkHandoff(handoff({ ...base, item: item({ components: ["Marketing"] }) }), [need])).toMatchObject({ verdict: "clear", findings: [] });
  });
});
