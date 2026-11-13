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
const billing: Decision = { ...base, id: "d5", title: "Stop using the legacy billing component", constraints: [{ kind: "componentForbidden", component: "legacy-billing" }] };
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

  it("reads a month and year as the first of the month, without adding a date to a full one", () => {
    expect(datesIn("by March 2027 or in Jan 2027", FROM, 2026)).toEqual(["2027-03-01", "2027-01-01"]);
    expect(datesIn("on 15 Dec 2026 and Jan 5, 2027", FROM, 2026)).toEqual(["2026-12-15", "2027-01-05"]);
  });

  it("reads a numeric date with the earlier of its valid readings, so it is late only when every reading is", () => {
    expect(datesIn("on 01/10/2027", FROM, 2026)).toEqual(["2027-01-10"]);
    expect(datesIn("on 12/15/2026 or on 15-12-2026", FROM, 2026)).toEqual(["2026-12-15"]);
    expect(datesIn("on 31/02/2027 and on 13/13/2027", FROM, 2026)).toEqual([]);
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

  it("refuse a month-only or ambiguous numeric date that is late, and accept one that is not", () => {
    expect(ids("We ship by March 2027.", [due])).toEqual(["d2"]);
    expect(ids("We ship on 01/10/2027.", [due])).toEqual(["d2"]);
    expect(ids("We ship by Dec 2026.", [due])).toEqual([]);
    expect(ids("We ship on 12/15/2026.", [due])).toEqual([]);
  });

  it("read a month alone or a numeric date only after a preposition", () => {
    expect(ids("We ship by 20 Dec; the cleanup retro is Jan 2027.", [due])).toEqual([]);
    expect(ids("We ship 20 Dec; the cleanup retro is Jan 2027.", [due])).toEqual([]);
    expect(ids("We ship 20 Dec; release 1/2/2027 is the next train.", [due])).toEqual([]);
    expect(ids("We ship 20 Dec, see ticket OPS-12-1-2027.", [due])).toEqual([]);
    expect(ids("We ship 20 Dec, deliver in Feb 2027.", [due])).toEqual(["d2"]);
  });

  it("accept a double negation before a required value, and still refuse a plain one", () => {
    expect(ids("I won't ship without legal-reviewed, won't touch legacy-billing, will deliver by Dec 30, 2026.", [legal, due])).toEqual([]);
    expect(ids("I will not ship without legal-reviewed.", [legal])).toEqual([]);
    expect(ids("I will not go without legal-reviewed.", [legal])).toEqual([]);
    expect(ids("I'll ship without legal-reviewed.", [legal])).toEqual(["d1"]);
    expect(ids("I won't wait, ship without legal-reviewed.", [legal])).toEqual(["d1"]);
    for (const text of ["not now skip legal review", "whether or not we skip legal review", "don't worry skip legal review", "never mind skip legal review"])
      expect(ids(text, [legal])).toEqual(["d1"]);
  });

  it("accept a negated intent and refuse a plain one", () => {
    for (const text of ["I don't want to skip legal review.", "We do not plan to skip legal review."]) expect(ids(text, [legal])).toEqual([]);
    for (const text of ["I am not going to keep using legacy-billing.", "I don't want to use legacy-billing."]) expect(contradictions(text, [billing], FROM)).toEqual([]);
    expect(ids("I want to skip legal review.", [legal])).toEqual(["d1"]);
    for (const text of ["We plan to use legacy-billing.", "I am going to keep using legacy-billing."]) expect(contradictions(text, [billing], FROM).map((c) => c.decisionId)).toEqual(["d5"]);
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

describe("a forbidding decision's own words", () => {
  const sms: Decision = { ...base, id: "d6", title: "Campaign work must not use the component legacy-sms", constraints: [{ kind: "componentForbidden", component: "legacy-sms" }] };

  // Seen on production 3.1.0: the panel asks the receiver to mention each decision by its title.
  it("are not a contradiction when the receiver repeats the title", () => {
    expect(contradictions("Stop using the legacy billing component: understood.", [billing], "2026-12-01T00:00:00.000Z")).toEqual([]);
    expect(contradictions("Campaign work must not use the component legacy-sms, noted.", [sms], "2026-12-01T00:00:00.000Z")).toEqual([]);
    expect(contradictions("I will avoid using legacy-billing and never use legacy-sms.", [billing, sms], "2026-12-01T00:00:00.000Z")).toEqual([]);
  });

  it("are contradicted when the receiver refuses to stop", () => {
    for (const text of ["I can't stop using legacy-billing yet.", "I won't stop using legacy-billing.", "I will not avoid using legacy-billing."])
      expect(contradictions(text, [billing], "2026-12-01T00:00:00.000Z").map((c) => c.decisionId)).toEqual(["d5"]);
  });

  it("are not contradicted by a halt the receiver goes beyond", () => {
    for (const text of ["We not only stop using legacy-billing, we remove it.", "I will not only stop using legacy-billing but delete it.", "Not just stop using legacy-billing: delete it.", "I won't remove or use legacy-billing."])
      expect(contradictions(text, [billing], "2026-12-01T00:00:00.000Z")).toEqual([]);
  });

  it("are still contradicted by a plain statement of using the value", () => {
    expect(contradictions("I will keep using the legacy-billing component for now.", [billing], "2026-12-01T00:00:00.000Z").map((c) => c.decisionId)).toEqual(["d5"]);
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
