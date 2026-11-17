import { describe, expect, it } from "vitest";
import labelsData from "../data/labels.json";
import humanData from "../data/human_labels.json";
import { checkHandoff } from "../src/rules/checkHandoff";
import { feasibleSpace, suggestFixes } from "../src/rules/feasible";
import { constraintText } from "../src/decisions/reach";
import { relate } from "../src/decisions/supersede";
import { buildManualDecision, type ManualInput } from "../src/decisions/manual";
import { validateCandidates } from "../src/decisions/validate";
import { slotsFor } from "../src/handoff/receipt";
import { readBackProblems, unaddressed } from "../src/handoff/ipass";
import { contradictions } from "../src/handoff/teachback";
import { changesSince, fingerprintOf, touches } from "../src/handoff/drift";
import { exampleReadBack } from "../src/handoff/example";
import type { Decision, Handoff, WorkItem } from "../src/rules/types";

const T = "2026-11-17T00:00:00.000Z";

const JQL = "priority = Highest";

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

const condDecision = (over: Partial<Decision> = {}): Decision => ({
  id: "D-9",
  title: "Only the highest priority ships",
  status: "decided",
  source: { kind: "ledger", ref: "demo" },
  scope: { kind: "project", projectKey: "OPS" },
  constraints: [{ kind: "condition", jql: JQL }],
  ...over,
});

describe("condition constraint in checkHandoff", () => {
  it("reports nothing when the work item matches the condition", () => {
    const r = checkHandoff(handoff({ item: item({ conditions: { [JQL]: true } }), acknowledged: ["D-9"] }), [condDecision()]);
    expect(r).toMatchObject({ verdict: "clear", findings: [] });
  });

  it("blocks with the JQL in the message when the work item does not match", () => {
    const r = checkHandoff(handoff({ item: item({ conditions: { [JQL]: false } }), acknowledged: ["D-9"] }), [condDecision()]);
    expect(r.verdict).toBe("blocked");
    expect(r.findings).toEqual([
      {
        rule: "contradicts_decision",
        severity: "block",
        message: `Contradicts "Only the highest priority ships": does not match the Jira filter ${JQL}.`,
        decisionId: "D-9",
      },
    ]);
  });

  it.each([{ name: "null", conditions: { [JQL]: null } }, { name: "missing key", conditions: {} }, { name: "missing map", conditions: undefined }])(
    "asks for information, never Clear, when the condition is $name",
    ({ conditions }) => {
      const r = checkHandoff(handoff({ item: item({ conditions: conditions as WorkItem["conditions"] }), acknowledged: ["D-9"] }), [condDecision()]);
      expect(r.verdict).toBe("needs_info");
      expect(r.findings).toEqual([
        {
          rule: "invalid_constraint",
          severity: "info_needed",
          message: `"Only the highest priority ships" could not be checked by Jira just now: ${JQL}. The verdict waits for Jira.`,
          decisionId: "D-9",
        },
      ]);
    },
  );

  it("applies a condition beside an existing label rule", () => {
    const d = condDecision({ constraints: [{ kind: "condition", jql: JQL }, { kind: "labelRequired", label: "legal-reviewed" }] });
    const bothBad = checkHandoff(handoff({ item: item({ conditions: { [JQL]: false } }), acknowledged: ["D-9"] }), [d]);
    expect(bothBad.verdict).toBe("blocked");
    expect(bothBad.findings.map((f) => f.message)).toEqual([
      `Contradicts "Only the highest priority ships": does not match the Jira filter ${JQL}.`,
      'Contradicts "Only the highest priority ships": label "legal-reviewed" is missing.',
    ]);
    const labelBad = checkHandoff(handoff({ item: item({ conditions: { [JQL]: true } }), acknowledged: ["D-9"] }), [d]);
    expect(labelBad.findings.map((f) => f.message)).toEqual(['Contradicts "Only the highest priority ships": label "legal-reviewed" is missing.']);
  });
});

describe("condition elsewhere in the handoff", () => {
  it("gives a confirm slot that keeps the JQL true", () => {
    expect(slotsFor([condDecision()])).toEqual([
      { decisionId: "D-9", title: "Only the highest priority ships", key: "D-9:0", kind: "confirm", ask: `I will keep this work item matching the Jira filter: ${JQL}` },
    ]);
  });

  it("is addressed by the decision title or the JQL itself, and named when neither appears", () => {
    expect(unaddressed("Only the highest priority ships, understood and accepted here", [condDecision()], T)).toEqual([]);
    expect(unaddressed("This work item has priority = Highest so it is fine to ship now", [condDecision()], T)).toEqual([]);
    expect(unaddressed("I read all of this and will follow it carefully", [condDecision()], T)).toEqual([condDecision()]);
    expect(readBackProblems("I will follow everything that was decided here", [condDecision()], T)).toEqual([
      `Your read-back does not mention "Only the highest priority ships" (condition ${JQL}).`,
    ]);
  });

  it("has no teach-back contradiction and reads understood in the example", () => {
    expect(contradictions("I will skip all of this and ship anyway.", [condDecision()], "2026-12-01T00:00:00.000Z")).toEqual([]);
    expect(exampleReadBack([condDecision()])).toBe("Only the highest priority ships: understood, I will follow it.");
  });

  it("touches no fingerprint field, so it never goes stale", () => {
    const d = condDecision();
    const before = fingerprintOf(item());
    for (const change of changesSince(before, item({ dueDate: "2026-12-15", labels: ["other"], components: ["api"] }))) {
      expect(touches(d, change)).toBe(false);
    }
  });

  it("is ignored by the feasibility check", () => {
    expect(feasibleSpace([condDecision()])).toMatchObject({
      latestDueDate: null,
      requiredLabels: [],
      forbiddenLabels: [],
      requiredComponents: [],
      forbiddenComponents: [],
      invalidConstraints: [],
    });
    expect(suggestFixes(item({ conditions: { [JQL]: false } }), [condDecision()]).changes).toEqual([]);
  });
});

describe("condition between decisions", () => {
  const scope = { kind: "project", projectKey: "OPS" } as const;

  it("relates when the JQL matches ignoring case and outer spaces", () => {
    const stored = condDecision();
    expect(relate([stored], scope, [{ kind: "condition", jql: "  PRIORITY = highest " }])?.kind).toBe("already_decided");
    expect(relate([stored], { kind: "workItem", key: "OPS-12" }, [{ kind: "condition", jql: JQL }])?.kind).toBe("already_decided");
    const narrow = condDecision({ scope: { kind: "workItem", key: "OPS-12" } });
    const wider = relate([narrow], scope, [{ kind: "condition", jql: JQL }]);
    expect(wider?.kind).toBe("supersedes");
  });

  it("does not relate, clash or move a limit when the JQL differs", () => {
    expect(relate([condDecision()], scope, [{ kind: "condition", jql: "priority = Lowest" }])).toBeNull();
  });

  it("reads as Must match in plain words", () => {
    expect(constraintText({ kind: "condition", jql: "priority = Highest" })).toBe("Must match the Jira filter: priority = Highest");
  });

  it("refuses a sixth filter, which would read as not checked, unless one is replaced in the same save", () => {
    const five = [1, 2, 3, 4, 5].map((n) => condDecision({ id: `D-${n}`, title: `t${n}`, constraints: [{ kind: "condition", jql: `labels = l${n}` }] }));
    const input: ManualInput = { title: "One more", scope: "project", scopeValue: "", constraint: "condition", constraintValue: "labels = l6", supersede: false };
    const at = "2026-11-16T00:00:00.000Z";
    const sixth = buildManualDecision(input, "OPS", five, "u-ana", at);
    expect(!sixth.ok && sixth.reason).toContain("Supersede one before adding another");
    expect(buildManualDecision(input, "OPS", five, "u-ana", at, "D-3").ok).toBe(true);
    // A retired filter frees its place, and a non-filter decision is never held back by the cap.
    const retired: Decision = { ...five[0]!, status: "superseded" };
    expect(buildManualDecision(input, "OPS", [...five.slice(1), retired], "u-ana", at).ok).toBe(true);
    expect(buildManualDecision({ ...input, constraint: "labelRequired", constraintValue: "x" }, "OPS", five, "u-ana", at).ok).toBe(true);
  });

  it("lets a new decision reuse a filter only when that filter is among the ones checked", () => {
    const six = [1, 2, 3, 4, 5, 6].map((n) =>
      condDecision({ id: `D-${n}`, title: `t${n}`, scope: { kind: "workItem", key: `OPS-${n}` }, constraints: [{ kind: "condition", jql: `labels = l${n}` }] }),
    );
    const reuse = (jql: string) =>
      buildManualDecision({ title: "Same filter, other item", scope: "workItem", scopeValue: "OPS-99", constraint: "condition", constraintValue: jql, supersede: false }, "OPS", six, "u-ana", "2026-11-16T00:00:00.000Z");
    expect(reuse("labels = l2").ok).toBe(true);
    // Only the first five are asked of Jira, so the sixth filter would read as not checked.
    expect(reuse("labels = l6").ok).toBe(false);
  });

  it("is typed in by hand: refused when empty, sorted or too long, kept as typed otherwise", () => {
    const base: ManualInput = { title: "Only the highest priority ships", scope: "project", scopeValue: "", constraint: "condition", constraintValue: JQL, supersede: false };
    const made = buildManualDecision(base, "OPS", [], "u-ana", "2026-11-15T00:00:00.000Z");
    expect(made.ok && made.decision.constraints).toEqual([{ kind: "condition", jql: JQL }]);
    const reason = (v: string) => {
      const r = buildManualDecision({ ...base, constraintValue: v }, "OPS", [], "u-ana", "2026-11-15T00:00:00.000Z");
      return r.ok ? null : r.reason;
    };
    expect(reason("")).toContain("Write the Jira filter");
    expect(reason("priority = Highest ORDER BY key")).toContain("ORDER BY");
    expect(reason("x".repeat(301))).toContain("at most 300");
    expect(reason("summary ~ border")).toBeNull();
  });

  it("cannot come from a Rovo proposal", () => {
    const parts = [{ from: "OPS-12 description", text: "Decision: only the highest priority ships, everyone agreed." }];
    const out = validateCandidates(
      [{ title: "Only the highest priority ships", scope: { kind: "project", projectKey: "OPS" }, constraints: [{ kind: "condition", jql: JQL }], evidence: { quote: "only the highest priority ships" } }],
      parts,
      { issueKey: "OPS-12", projectKey: "OPS", labels: ["campaign"] },
      "2026-11-15T00:00:00.000Z",
    );
    expect(out.kept).toEqual([]);
    expect(out.rejected).toEqual([{ index: 0, reason: "bad_constraint" }]);
  });
});

describe("measure pin", () => {
  it("keeps the shipped-sample figures unchanged: no sample uses a condition", () => {
    const modules = import.meta.glob("../data/samples/*.json", { eager: true }) as Record<string, { samples: { note: string; handoff: Handoff; decisions: Decision[] }[] }>;
    const samples = new Map<string, { handoff: Handoff; decisions: Decision[] }>();
    for (const [path, mod] of Object.entries(modules).sort(([a], [b]) => (a < b ? -1 : 1))) {
      const file = path.split("/").pop() as string;
      mod.samples.forEach((s, i) => samples.set(`${file}#${i}`, s));
    }
    for (const [, s] of samples) {
      for (const d of s.decisions) expect(d.constraints.map((c) => c.kind)).not.toContain("condition");
    }
    const labels = labelsData as { id: string; verdict: string }[];
    const verdictOf = (id: string, decisions: Decision[]) => checkHandoff(samples.get(id)!.handoff, decisions).verdict;
    expect(samples.size).toBe(48);
    expect(labels.filter((l) => verdictOf(l.id, samples.get(l.id)!.decisions) === l.verdict).length).toBe(47);
    expect(labels.filter((l) => verdictOf(l.id, []) === l.verdict).length).toBe(34);
    expect(labels.filter((l) => l.verdict === "clear").length).toBe(12);
    const human = (humanData.labels as { id: string; verdict: string }[]).filter((l) => l.verdict !== "unresolved" && samples.has(l.id));
    const museById = new Map(labels.map((l) => [l.id, l.verdict]));
    expect(human.length).toBe(40);
    expect(human.filter((l) => verdictOf(l.id, samples.get(l.id)!.decisions) === l.verdict).length).toBe(36);
    expect(human.filter((l) => verdictOf(l.id, []) === l.verdict).length).toBe(25);
    expect(human.filter((l) => l.verdict === "clear").length).toBe(17);
    expect(human.filter((l) => museById.get(l.id) === l.verdict).length).toBe(35);
  });
});
