import { describe, expect, it } from "vitest";
import { confirmProposal } from "../src/decisions/confirm";
import { buildManualDecision, type ManualInput } from "../src/decisions/manual";
import { clashes, storedClashes } from "../src/decisions/supersede";
import type { Proposal } from "../src/decisions/types";
import type { Constraint, Decision, DecisionScope } from "../src/rules/types";

const NOW = "2026-11-15T00:00:00.000Z";
const launch: DecisionScope = { kind: "label", label: "launch", projectKey: "OPS" };
const dec = (id: string, scope: DecisionScope, c: Constraint, confirmedBy?: string): Decision => ({
  id,
  title: id,
  status: "decided",
  source: { kind: "ledger", ref: "x" },
  scope,
  constraints: [c],
  ...(confirmedBy ? { confirmedBy } : {}),
});
const required = dec("needs-review", launch, { kind: "labelRequired", label: "legal-reviewed" });

describe("clashes", () => {
  it("finds the opposite rule and a moved date limit for the same reach only", () => {
    expect(clashes([required], launch, [{ kind: "labelForbidden", label: "Legal-Reviewed" }]).map((d) => d.id)).toEqual(["needs-review"]);
    expect(clashes([required], { kind: "project", projectKey: "OPS" }, [{ kind: "labelForbidden", label: "legal-reviewed" }])).toEqual([]);
    const due = dec("due", { kind: "project", projectKey: "OPS" }, { kind: "dueNotAfter", date: "2026-12-31" });
    expect(clashes([due], due.scope, [{ kind: "dueNotAfter", date: "2027-01-31" }]).map((d) => d.id)).toEqual(["due"]);
    expect(clashes([{ ...required, status: "superseded" }], launch, [{ kind: "labelForbidden", label: "legal-reviewed" }])).toEqual([]);
  });
  it("lists a stored clashing pair once", () => {
    const forbidden = dec("no-review", launch, { kind: "labelForbidden", label: "legal-reviewed" });
    expect(storedClashes([required, forbidden]).map((c) => [c.a.id, c.b.id])).toEqual([["needs-review", "no-review"]]);
  });
});

describe("a clashing decision cannot be saved beside the older one", () => {
  const input: ManualInput = { title: "Skip legal review", scope: "label", scopeValue: "launch", constraint: "labelForbidden", constraintValue: "legal-reviewed", supersede: false };

  it("is refused by hand without superseding, and retires the older one with it", () => {
    const refused = buildManualDecision(input, "OPS", [required], "u1", NOW);
    expect(refused).toMatchObject({ ok: false });
    if (!refused.ok) expect(refused.reason).toContain('"needs-review"');
    const saved = buildManualDecision({ ...input, supersede: true }, "OPS", [required], "u1", NOW);
    expect(saved).toMatchObject({ ok: true, retire: ["needs-review"] });
  });

  it("is refused outright when someone else confirmed the older one", () => {
    const theirs = { ...required, confirmedBy: "someone-else" };
    const out = buildManualDecision({ ...input, supersede: true }, "OPS", [theirs], "u1", NOW);
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.reason).toContain("Only the person who confirmed");
  });

  it("refuses plain Confirm of a clashing proposal and accepts Confirm and supersede", () => {
    const p: Proposal = { id: "p-1", title: "Skip legal review", scope: launch, constraints: [{ kind: "labelForbidden", label: "legal-reviewed" }], evidence: { quote: "skip the legal review", from: "OPS-1 description" }, proposedAt: NOW };
    expect(confirmProposal([p], [required], "p-1", "u1", NOW)).toMatchObject({ ok: false, reason: "clash" });
    const out = confirmProposal([p], [required], "p-1", "u1", NOW, true);
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.decisions.find((d) => d.id === "needs-review")?.status).toBe("superseded");
  });
});
