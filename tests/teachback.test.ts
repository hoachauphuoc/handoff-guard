/// <reference types="vite/client" />
import { describe, expect, it } from "vitest";
import teachbackSource from "../src/handoff/teachback?raw";
import checkSource from "../src/rules/checkHandoff?raw";
import validator from "../src/validator?raw";
import acknowledgeSource from "../src/handoff/acknowledge?raw";
import explainSource from "../src/handoff/explain?raw";
import llmSource from "../src/llm?raw";
import resolvers from "../src/resolvers/index?raw";
import actionsIndex from "../src/actions/index?raw";
import manifest from "../manifest.yml?raw";
import { EXPLAIN_BY, EXPLAIN_MAX, explainMessages, explanationNote, explanationText } from "../src/handoff/explain";
import { acknowledgeAll } from "../src/handoff/acknowledge";
import { fingerprintOf } from "../src/handoff/drift";
import { contradictions, datesIn } from "../src/handoff/teachback";
import type { HandoffRecord } from "../src/handoff/types";
import type { Decision, WorkItem } from "../src/rules/types";

const base = { status: "decided" as const, source: { kind: "ledger" as const, ref: "demo" }, scope: { kind: "project" as const, projectKey: "OPS" } };
const legal: Decision = { ...base, id: "d1", title: "Legal review required", constraints: [{ kind: "labelRequired", label: "legal-reviewed" }] };
const due: Decision = { ...base, id: "d2", title: "Ship before 31 Dec", constraints: [{ kind: "dueNotAfter", date: "2026-12-31" }] };
const noHotfix: Decision = { ...base, id: "d3", title: "No hotfix label on launch work", constraints: [{ kind: "labelForbidden", label: "hotfix" }] };
const web: Decision = { ...base, id: "d4", title: "Web component required", constraints: [{ kind: "componentRequired", component: "web" }] };
const all = [legal, due, noHotfix, web];
const FROM = "2026-12-01T00:00:00.000Z";
const ids = (text: string, binding = all, from = FROM) => contradictions(text, binding, from).map((c) => c.decisionId);

describe("dates in a read-back", () => {
  it("reads ISO, day-month and month-day; a date with no year is its next occurrence from the read-back day", () => {
    expect(datesIn("by 2027-01-05", FROM, 2026)).toEqual(["2027-01-05"]);
    expect(datesIn("by 15 Dec and then 3rd of January 2027", FROM, 2026)).toEqual(["2026-12-15", "2027-01-03"]);
    expect(datesIn("by December 15th, 2026", FROM, 2026)).toEqual(["2026-12-15"]);
    expect(datesIn("31 Feb and 2026-13-01 are not dates", FROM, 2026)).toEqual([]);
    expect(datesIn("15 Jan", FROM, 2026)).toEqual(["2027-01-15"]);
    expect(datesIn("1 Dec", FROM, 2026)).toEqual(["2026-12-01"]);
    expect(datesIn("29 Feb", FROM, 2026)).toEqual(["2028-02-29"]);
  });

  it("uses the fallback year when the start is not a date", () => {
    expect(datesIn("15 Jan", "t1", 2026)).toEqual(["2026-01-15"]);
    expect(datesIn("15 Jan", "2026-13-40T00:00:00Z", 2025)).toEqual(["2025-01-15"]);
  });
});

describe("contradictions", () => {
  it("catch the video's read-back: a required review said to be skipped", () => {
    const out = contradictions("Got it, I will ship by Dec 15 and skip legal review.", all, FROM);
    expect(out.map((c) => c.decisionId)).toEqual(["d1"]);
    expect(out[0]!.reason).toContain('"Legal review required" requires label legal-reviewed');
  });

  it("refuse a date later than a date limit and accept an earlier one", () => {
    expect(ids("We ship on 5 January 2027.")).toEqual(["d2"]);
    expect(ids("We ship on 2027-01-05.")).toEqual(["d2"]);
    expect(ids("We ship on 15 December, before 31 Dec.")).toEqual([]);
  });

  it("read a date with no year as its next occurrence from the read-back day", () => {
    const now = "2026-12-20T10:00:00.000Z";
    expect(ids("We ship on 15 Jan.", [due], now)).toEqual(["d2"]);
    expect(ids("We ship on 28 Dec.", [due], now)).toEqual([]);
  });

  it("refuse a required value said to be optional or not needed", () => {
    expect(ids("The legal-reviewed label is optional here.")).toEqual(["d1"]);
    expect(ids("Legal review is not needed for this one.")).toEqual(["d1"]);
    expect(ids("We can ship without the web component.")).toEqual(["d4"]);
  });

  it("refuse a forbidden value said to be added", () => {
    expect(ids("I will add the hotfix label to speed it up.")).toEqual(["d3"]);
  });

  it("accept read-backs that agree, including undone negations and negations about something else", () => {
    expect(ids("I can't skip legal review, so legal-reviewed stays on.")).toEqual([]);
    expect(ids("No problem, legal review will be done first.")).toEqual([]);
    expect(ids("Legal review is not optional.")).toEqual([]);
    expect(ids("No hotfix label, and the web component stays.")).toEqual([]);
    expect(ids("I will not add the hotfix label.")).toEqual([]);
  });

  it("does not read a removal word after a forbidden value as adding it", () => {
    expect(ids("I will keep the hotfix label off.", [noHotfix])).toEqual([]);
    expect(ids("I will keep the hotfix label.", [noHotfix])).toEqual(["d3"]);
  });

  it("give one entry per decision and nothing for decisions that do not bind", () => {
    expect(ids("Skip legal review, skip the legal-reviewed label.", [legal])).toEqual(["d1"]);
    expect(ids("Skip legal review.", [due])).toEqual([]);
  });
});

describe("in acknowledgeAll", () => {
  const item: WorkItem = { key: "OPS-1", projectKey: "OPS", summary: "s", description: "d", labels: [], components: [], dueDate: "2026-12-15", assigneeId: "b" };
  const record: HandoffRecord = { fromId: "a", toId: "b", acknowledged: [], preparedAt: "t0", acknowledgedAt: {}, protocol: 1 };
  const fp = fingerprintOf(item);

  // The coverage check still wants a decision's title or value as written; teach-back adds to it, not replaces it.
  it("refuses a read-back that mentions every decision but contradicts one, and stores nothing", () => {
    const out = acknowledgeAll(record, "b", [legal, due], "Ship before 31 Dec is fine. Legal review required? I will skip the legal-reviewed label.", "t1", fp);
    expect(out.ok).toBe(false);
    if (out.ok || out.reason !== "read_back") throw new Error("expected a read-back refusal");
    expect(out.contradictions.map((c) => c.decisionId)).toEqual(["d1"]);
    expect(out.problems).toEqual(out.contradictions.map((c) => c.reason));
  });

  it("accepts the corrected read-back", () => {
    const out = acknowledgeAll(record, "b", [legal, due], "Ship before 31 Dec: I ship by 15 Dec. Legal review required: legal-reviewed stays on.", "t1", fp);
    expect(out.ok).toBe(true);
  });

  it("does not compare a read-back of the wrong length", () => {
    const out = acknowledgeAll(record, "b", [legal], "skip legal review", "t1", fp);
    if (out.ok || out.reason !== "read_back") throw new Error("expected a read-back refusal");
    expect(out.contradictions).toEqual([]);
  });
});

describe("principles", () => {
  it("teach-back is plain code and never reaches the rule check or the validator", () => {
    expect(teachbackSource).not.toMatch(/@forge|Date\.now|new Date\(\)/);
    expect(checkSource).not.toContain("teachback");
    expect(validator).not.toContain("teachback");
  });
});

describe("model explanation", () => {
  const found = contradictions("Got it, I will ship by Dec 15 and skip legal review.", [legal], FROM);

  it("quotes the read-back and gives the code's reasons, never asks the model to decide", () => {
    const [system, user] = explainMessages("Got it, I will ship by Dec 15 and skip legal review.", found);
    expect(system!.content).toContain("Do not judge, do not overrule the code");
    expect(user!.content).toContain('"""Got it, I will ship by Dec 15 and skip legal review."""');
    expect(user!.content).toContain(found[0]!.reason);
  });

  it("reads the array-of-parts answer seen on the dev site, and caps it", () => {
    expect(explanationText([{ type: "text", text: " Legal review  is mandatory. " }])).toBe("Legal review is mandatory.");
    expect(explanationText("plain")).toBe("plain");
    expect(explanationText([])).toBeNull();
    expect(explanationText([{ type: "text", text: "x".repeat(400) }])!.length).toBe(EXPLAIN_MAX);
  });

  it("names who wrote it, or why it is missing", () => {
    expect(explanationNote({ text: "t", by: EXPLAIN_BY })).toContain("Written by a model (Forge LLMs");
    expect(explanationNote({ unavailable: "Forge LLMs did not answer (HTTP 429)." })).toContain("No model explanation: Forge LLMs did not answer (HTTP 429).");
  });

  it("is called only by the panel resolver, after a refusal, and nothing it writes is stored", () => {
    expect(llmSource).toContain("@forge/llm");
    expect(explainSource).not.toMatch(/@forge/);
    for (const src of [checkSource, validator, acknowledgeSource, actionsIndex]) expect(src).not.toMatch(/llm|explainRefusal/);
    const handler = resolvers.slice(resolvers.indexOf('resolver.define("acknowledgeAll"'), resolvers.indexOf('resolver.define("saveContingency"'));
    expect(handler.indexOf("explainRefusal")).toBeLessThan(handler.indexOf("putRecord"));
    expect(handler.slice(handler.indexOf("explainRefusal"), handler.indexOf("putRecord"))).toContain("satisfies AcknowledgeAllReply");
  });

  it("is declared in the manifest as Forge LLMs, with no egress", () => {
    expect(manifest).toMatch(/^ {2}llm:\r?\n {4}- key: llm-app\r?\n {6}model:\r?\n {8}- claude\r?$/m);
    expect(manifest).not.toMatch(/webtrigger|external:/);
  });
});
