import { describe, expect, it } from "vitest";
import { validateCandidates } from "../src/decisions/validate";

const ctx = { issueKey: "OPS-1", projectKey: "OPS", labels: ["launch"] };
const NOW = "2026-11-12T00:00:00.000Z";
const parts = [
  { from: "OPS-1 description", text: "Decision: all launch work needs the legal-reviewed label before 2026-12-15." },
];

const cand = (quote: string, over: Record<string, unknown> = {}) => ({
  title: "Launch work needs legal review",
  scope: { kind: "label", label: "launch" },
  constraints: [{ kind: "labelRequired", label: "legal-reviewed" }],
  evidence: { quote },
  ...over,
});
const run = (raw: unknown, p = parts) => validateCandidates(raw, p, ctx, NOW);
const reasons = (raw: unknown, p = parts) => run(raw, p).rejected.map((r) => r.reason);

describe("evidence check", () => {
  it("keeps a quote copied from the source and records where it came from", () => {
    const { kept, rejected } = run([cand("all launch work needs the legal-reviewed label")]);
    expect(rejected).toEqual([]);
    expect(kept).toHaveLength(1);
    expect(kept[0]?.evidence).toEqual({ quote: "all launch work needs the legal-reviewed label", from: "OPS-1 description" });
    expect(kept[0]?.proposedAt).toBe(NOW);
  });

  it("rejects a paraphrase", () => {
    expect(reasons([cand("launch work must carry legal review")])).toEqual(["evidence_not_in_source"]);
  });

  it("ignores whitespace runs but not case", () => {
    expect(run([cand("all launch   work\n needs the legal-reviewed label")]).kept).toHaveLength(1);
    expect(reasons([cand("All launch work needs the legal-reviewed label")])).toEqual(["evidence_not_in_source"]);
  });

  it("normalises curly quotes and dashes on both sides", () => {
    const p = [{ from: "c1", text: "The team’s rule — ship “early” – is final for everyone." }];
    const q = "The team's rule - ship \"early\" - is final";
    expect(validateCandidates([cand(q)], p, ctx, NOW).kept).toHaveLength(1);
  });

  it("matches Jira wiki markup raw and rejects a quote with the markup stripped", () => {
    const p = [{ from: "c1", text: "We agreed *all launch work* needs [the checklist|http://x.test/c] first." }];
    expect(validateCandidates([cand("*all launch work* needs [the checklist|http://x.test/c]")], p, ctx, NOW).kept).toHaveLength(1);
    expect(validateCandidates([cand("all launch work needs the checklist")], p, ctx, NOW).rejected[0]?.reason).toBe("evidence_not_in_source");
  });

  it("rejects two sentences joined together", () => {
    const p = [{ from: "c1", text: "Ship by the fifteenth. Legal must review first. Thanks." }];
    expect(validateCandidates([cand("Ship by the fifteenth. Thanks.")], p, ctx, NOW).rejected[0]?.reason).toBe("evidence_not_in_source");
  });

  it("rejects a short or missing quote as no_evidence", () => {
    expect(reasons([cand("legal")])).toEqual(["no_evidence"]);
    expect(reasons([{ ...cand("x"), evidence: undefined }])).toEqual(["no_evidence"]);
    expect(reasons([cand("a".repeat(301))])).toEqual(["no_evidence"]);
  });
});

describe("candidate shape", () => {
  const ok = "all launch work needs the legal-reviewed label";

  it("accepts an array or {candidates}, otherwise rejects", () => {
    expect(run({ candidates: [cand(ok)] }).kept).toHaveLength(1);
    expect(reasons("nope")).toEqual(["not_object"]);
    expect(reasons([42])).toEqual(["not_object"]);
  });

  it("keeps 5 and marks the sixth over_cap", () => {
    const six = Array.from({ length: 6 }, (_, i) => cand(ok, { title: `Rule ${i}` }));
    const out = run(six);
    expect(out.kept).toHaveLength(5);
    expect(out.rejected).toEqual([{ index: 5, reason: "over_cap" }]);
  });

  it("rejects bad titles, kinds, dates and scopes", () => {
    expect(reasons([cand(ok, { title: "  " })])).toEqual(["bad_title"]);
    expect(reasons([cand(ok, { title: "x".repeat(121) })])).toEqual(["bad_title"]);
    expect(reasons([cand(ok, { constraints: [{ kind: "mustBeNice" }] })])).toEqual(["bad_constraint"]);
    expect(reasons([cand(ok, { constraints: [] })])).toEqual(["bad_constraint"]);
    expect(reasons([cand(ok, { constraints: Array(4).fill({ kind: "labelRequired", label: "a" }) })])).toEqual(["bad_constraint"]);
    expect(reasons([cand(ok, { constraints: [{ kind: "dueNotAfter", date: "2026-13-01" }] })])).toEqual(["bad_date"]);
    expect(reasons([cand(ok, { scope: { kind: "project", projectKey: "FIN" } })])).toEqual(["bad_scope"]);
    expect(reasons([cand(ok, { scope: { kind: "label", label: "other" } })])).toEqual(["bad_scope"]);
    expect(reasons([cand(ok, { scope: { kind: "workItem", key: "OPS-2" } })])).toEqual(["bad_scope"]);
  });

  it("accepts the work item, its project and a label it has", () => {
    for (const scope of [
      { kind: "workItem", key: "ops-1" },
      { kind: "project", projectKey: "OPS" },
      { kind: "label", label: "Launch" },
    ]) {
      expect(run([cand(ok, { scope })]).kept).toHaveLength(1);
    }
  });

  it("gives the same ids on every run and different ids for different content", () => {
    const a = run([cand(ok)]).kept[0]?.id;
    expect(a).toMatch(/^p-[0-9a-f]{8}$/);
    expect(run([cand(ok)]).kept[0]?.id).toBe(a);
    expect(run([cand(ok, { title: "Another" })]).kept[0]?.id).not.toBe(a);
  });

  it("drops an exact repeat without spending the cap", () => {
    const out = run([cand(ok), cand(ok)]);
    expect(out.kept).toHaveLength(1);
    expect(out.rejected).toEqual([]);
  });
});
