/// <reference types="vite/client" />
import { describe, expect, it } from "vitest";
import { confirmProposal } from "../src/decisions/confirm";
import { capParts } from "../src/decisions/cap";
import { MAX_CHECKED_PAGES, pagesToCheck, sourceNotes } from "../src/decisions/sourcecheck";
import { validateCandidates } from "../src/decisions/validate";
import type { Decision } from "../src/rules/types";
import rulesSource from "../src/rules/checkHandoff?raw";
import validatorSource from "../src/validator?raw";

const fromPage = (over: Partial<Decision> = {}): Decision => ({
  id: "d1",
  title: "Launch needs legal",
  status: "decided",
  source: { kind: "confluence", ref: "Launch plan" },
  scope: { kind: "project", projectKey: "OPS" },
  constraints: [{ kind: "labelRequired", label: "legal" }],
  evidence: { quote: "Launch work needs the legal label", from: "Confluence page Launch plan", pageId: "77", version: 3 },
  ...over,
});

describe("the page version is stored with the decision", () => {
  it("travels from the source part through the proposal to the confirmed decision", () => {
    const quote = "Launch work needs the legal label";
    const parts = [{ from: "Confluence page Launch plan", text: `${quote}.`, page: { pageId: "77", version: 3 } }];
    const out = validateCandidates(
      [{ title: "Launch needs legal", scope: { kind: "project", projectKey: "OPS" }, constraints: [{ kind: "labelRequired", label: "legal" }], evidence: { quote } }],
      parts,
      { issueKey: "OPS-1", projectKey: "OPS", labels: [] },
      "t",
    );
    expect(out.kept[0]?.evidence).toEqual({ quote, from: "Confluence page Launch plan", pageId: "77", version: 3 });
    const done = confirmProposal(out.kept, [], out.kept[0]!.id, "u", "t");
    if (!done.ok) throw new Error("expected ok");
    expect(done.decisions[0]?.evidence).toMatchObject({ pageId: "77", version: 3 });
  });

  it("is kept by capParts and absent for Jira text", () => {
    expect(capParts([{ from: "a", text: "abc", page: { pageId: "1", version: 2 } }], 10).parts[0]).toEqual({ from: "a", text: "abc", page: { pageId: "1", version: 2 } });
    const out = validateCandidates(
      [{ title: "t", scope: { kind: "project", projectKey: "OPS" }, constraints: [{ kind: "labelRequired", label: "x" }], evidence: { quote: "all work needs the x label" } }],
      [{ from: "OPS-1 description", text: "all work needs the x label" }],
      { issueKey: "OPS-1", projectKey: "OPS", labels: [] },
      "t",
    );
    expect(out.kept[0]?.evidence).toEqual({ quote: "all work needs the x label", from: "OPS-1 description" });
  });
});

describe("sourceNotes", () => {
  it("says a page changed, naming the decision and both versions, and is silent when it did not", () => {
    const same = sourceNotes([fromPage()], { "77": { ok: true, title: "Launch plan", version: 3 } });
    expect(same).toEqual({ notes: [], notChecked: 0 });
    const changed = sourceNotes([fromPage()], { "77": { ok: true, title: "Launch plan", version: 5 } });
    expect(changed.notes).toEqual([
      {
        kind: "changed",
        message: 'The Confluence page "Launch plan" changed since "Launch needs legal" was confirmed (version 3 then, version 5 now). The decision still applies until a person supersedes it.',
        decisionIds: ["d1"],
      },
    ]);
  });

  it("names a page that cannot be read instead of skipping it", () => {
    const out = sourceNotes([fromPage()], { "77": { ok: false } });
    expect(out.notes[0]).toMatchObject({ kind: "unreadable", decisionIds: ["d1"] });
    expect(out.notes[0]?.message).toContain("could not be read as you now");
  });

  it("leaves out decisions with no stored page version and superseded ones, and counts pages beyond the cap", () => {
    const jira = fromPage({ id: "j", evidence: { quote: "q", from: "OPS-1 description" } });
    const old = fromPage({ id: "o", status: "superseded" });
    expect(sourceNotes([jira, old], {})).toEqual({ notes: [], notChecked: 0 });
    const many = Array.from({ length: MAX_CHECKED_PAGES + 2 }, (_, i) => fromPage({ id: `d${i}`, evidence: { quote: "q", from: "Confluence page P", pageId: String(i), version: 1 } }));
    expect(pagesToCheck(many)).toHaveLength(MAX_CHECKED_PAGES);
    const reads = Object.fromEntries(pagesToCheck(many).map((id) => [id, { ok: true as const, title: "P", version: 1 }]));
    expect(sourceNotes(many, reads)).toEqual({ notes: [], notChecked: 2 });
  });
});

describe("source checks stay advisory", () => {
  it("is not read by the rule check or the validator", () => {
    for (const src of [rulesSource, validatorSource]) expect(src).not.toMatch(/sourcecheck|sourceNotes|pageId/);
  });
});
