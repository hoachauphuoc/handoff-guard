/// <reference types="vite/client" />
import { describe, expect, it } from "vitest";
import { adfToText, markedDecisions } from "../src/adf";
import { capParts } from "../src/decisions/cap";
import { confirmProposal } from "../src/decisions/confirm";
import { unrecordedMarked } from "../src/decisions/marked";
import { buildParts } from "../src/decisions/parts";
import type { Proposal } from "../src/decisions/types";
import { validateCandidates } from "../src/decisions/validate";
import rulesSource from "../src/rules/checkHandoff?raw";
import validatorSource from "../src/validator?raw";

const p = (text: string) => ({ type: "paragraph", content: [{ type: "text", text }] });
const decided = (text: string, state = "DECIDED") => ({ type: "decisionItem", attrs: { localId: "x", state }, content: [{ type: "text", text }] });
const doc = (...content: unknown[]) => ({ type: "doc", version: 1, content });
const body = doc(
  p("Kick-off notes."),
  { type: "decisionList", attrs: { localId: "l" }, content: [decided("All launch work needs the legal-reviewed label"), decided("Maybe move the date", "UNDECIDED")] },
  { type: "bulletList", content: [{ type: "listItem", content: [p("Owner: "), p("second paragraph")] }] },
);

describe("adf", () => {
  it("takes only DECIDED decision items, as written", () => {
    expect(markedDecisions(body)).toEqual(["All launch work needs the legal-reviewed label"]);
  });

  it("puts blocks on their own lines and joins inline runs as written", () => {
    const text = adfToText(doc(p("Hello "), { type: "paragraph", content: [{ type: "text", text: "a" }, { type: "hardBreak" }, { type: "mention", attrs: { text: "@Ana" } }] }));
    expect(text).toBe("Hello \na\n@Ana");
  });

  it("returns a plain string unchanged and treats junk as empty", () => {
    expect(adfToText("plain wiki text")).toBe("plain wiki text");
    for (const junk of [null, undefined, 5, [], { content: "x" }]) expect(adfToText(junk)).toBe("");
    expect(markedDecisions("text")).toEqual([]);
  });

  it("makes every marked decision a quotable substring of the same document's text", () => {
    const text = adfToText(body);
    for (const m of markedDecisions(body)) expect(text).toContain(m);
  });
});

describe("buildParts", () => {
  it("marks decisions on the part they are in and skips restricted comments", () => {
    const parts = buildParts("OPS-1", body, [
      { id: "1", body: doc(p("Plain comment.")) },
      { id: "2", body: doc({ type: "decisionList", content: [decided("Ship by 2026-12-15 at the latest")] }) },
      { id: "3", body: doc(p("Secret")), visibility: { type: "group", value: "staff" } },
    ]);
    expect(parts.map((x) => x.from)).toEqual(["OPS-1 description", "OPS-1 comment 1", "OPS-1 comment 2"]);
    expect(parts[0]?.marked).toEqual(["All launch work needs the legal-reviewed label"]);
    expect(parts[1]).not.toHaveProperty("marked");
    expect(parts[2]?.marked).toEqual(["Ship by 2026-12-15 at the latest"]);
  });

  it("lets a quote from a marked decision pass the evidence check", () => {
    const parts = buildParts("OPS-1", body, []);
    const out = validateCandidates(
      [{ title: "Launch needs legal", scope: { kind: "project", projectKey: "OPS" }, constraints: [{ kind: "labelRequired", label: "legal-reviewed" }], evidence: { quote: parts[0]!.marked![0]! } }],
      parts,
      { issueKey: "OPS-1", projectKey: "OPS", labels: [], stored: [] },
      "2026-11-12T00:00:00.000Z",
    );
    expect(out.rejected).toEqual([]);
    expect(out.kept).toHaveLength(1);
  });
});

describe("capParts keeps only marked decisions that survive the cut", () => {
  it("drops a marked decision that was cut off", () => {
    const text = "intro. first decided. second decided.";
    const out = capParts([{ from: "a", text, marked: ["first decided.", "second decided."] }], 24);
    expect(out.parts[0]?.marked).toEqual(["first decided."]);
    expect(capParts([{ from: "a", text, marked: ["second decided."] }], 10).parts[0]).not.toHaveProperty("marked");
  });
});

describe("unrecordedMarked", () => {
  const proposal: Proposal = {
    id: "p-1",
    title: "Launch needs legal",
    scope: { kind: "project", projectKey: "OPS" },
    constraints: [{ kind: "labelRequired", label: "legal-reviewed" }],
    evidence: { quote: "All launch work needs the legal-reviewed label", from: "OPS-1 description" },
    proposedAt: "t",
  };
  const parts = buildParts("OPS-1", body, []);

  it("lists a marked decision no one confirmed, and none once the proposal made from it is confirmed", () => {
    expect(unrecordedMarked(parts, [])).toEqual([{ from: "OPS-1 description", text: "All launch work needs the legal-reviewed label" }]);
    const out = confirmProposal([proposal], [], "p-1", "u", "t");
    if (!out.ok) throw new Error("expected ok");
    expect(out.decisions[0]?.evidence).toEqual(proposal.evidence);
    expect(unrecordedMarked(parts, out.decisions)).toEqual([]);
  });

  it("does not count a decision from another part, and a superseded one still counts", () => {
    const out = confirmProposal([{ ...proposal, evidence: { ...proposal.evidence, from: "OPS-1 comment 9" } }], [], "p-1", "u", "t");
    if (!out.ok) throw new Error("expected ok");
    expect(unrecordedMarked(parts, out.decisions)).toHaveLength(1);
    const same = confirmProposal([proposal], [], "p-1", "u", "t");
    if (!same.ok) throw new Error("expected ok");
    expect(unrecordedMarked(parts, same.decisions.map((d) => ({ ...d, status: "superseded" as const })))).toEqual([]);
  });
});

describe("marked decisions stay out of the verdict path", () => {
  it("is not read by the rules or the validator", () => {
    for (const src of [rulesSource, validatorSource]) expect(src).not.toMatch(/marked|adf|unrecorded/i);
  });
});
