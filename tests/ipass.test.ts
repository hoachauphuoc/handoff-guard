/// <reference types="vite/client" />
import { describe, expect, it } from "vitest";
import actionsCore from "../src/actions/core?raw";
import actionsIndex from "../src/actions/index?raw";
import validator from "../src/validator?raw";
import acknowledgeSource from "../src/handoff/acknowledge?raw";
import contingencySource from "../src/handoff/contingency?raw";
import ipassSource from "../src/handoff/ipass?raw";
import panel from "../src/frontend/index.tsx?raw";
import resolvers from "../src/resolvers/index?raw";
import manifest from "../manifest.yml?raw";
import readme from "../README.md?raw";
import checkSource from "../src/rules/checkHandoff?raw";
import { acknowledge, acknowledgeAll } from "../src/handoff/acknowledge";
import { handoffFrom } from "../src/handoff/build";
import { withContingency } from "../src/handoff/contingency";
import { fingerprintOf } from "../src/handoff/drift";
import {
  BEFORE_READ_BACK,
  CONTINGENCY_MAX,
  READ_BACK_MAX,
  READ_BACK_NOTE,
  actionList,
  contingencyAdvisory,
  readBackProblems,
  severityOf,
  severityText,
  unaddressed,
} from "../src/handoff/ipass";
import type { HandoffRecord } from "../src/handoff/types";
import { bindingDecisions, checkHandoff } from "../src/rules/checkHandoff";
import { suggestFixes } from "../src/rules/feasible";
import type { Decision, WorkItem } from "../src/rules/types";
import muse1 from "../data/samples/muse-20261112T013558Z.json";
import muse2 from "../data/samples/muse-20261112T013950Z.json";
import muse3 from "../data/samples/muse-20261112T015137Z.json";
import adversarial from "../data/samples/sonnet-adversarial.json";

const item = (over: Partial<WorkItem> = {}): WorkItem => ({
  key: "OPS-1",
  projectKey: "OPS",
  summary: "Launch",
  description: "Body",
  labels: ["launch"],
  components: ["web"],
  dueDate: "2026-12-15",
  assigneeId: null,
  ...over,
});
const legal: Decision = {
  id: "d1",
  title: "Launch work needs legal review",
  status: "decided",
  source: { kind: "ledger", ref: "demo" },
  scope: { kind: "project", projectKey: "OPS" },
  constraints: [{ kind: "labelRequired", label: "legal-reviewed" }],
};
const due: Decision = { ...legal, id: "d2", title: "Ship by 31 December", constraints: [{ kind: "dueNotAfter", date: "2026-12-31" }] };
const record = (over: Partial<HandoffRecord> = {}): HandoffRecord => ({ fromId: "a", toId: "b", acknowledged: [], preparedAt: "t0", acknowledgedAt: {}, protocol: 1, ...over });
const people = { fromId: "a", toId: "b" };

describe("severity", () => {
  it("is a label for the verdict, one to one", () => {
    expect(severityOf("clear")).toBe("Stable");
    expect(severityOf("needs_info")).toBe("Watcher");
    expect(severityOf("blocked")).toBe("Unstable");
    expect(severityText("blocked")).toBe("I-PASS: Unstable");
  });
});

describe("action list", () => {
  it("has the blocking actions first, with an owner and the fix and hint wording", () => {
    const it1 = item({ dueDate: null, labels: [] });
    const result = checkHandoff(handoffFrom(it1, record(), [legal]), [legal]);
    const fixes = suggestFixes(it1, [legal]).changes;
    const actions = actionList(result, people, fixes);
    expect(actions.map((a) => a.owner)).toEqual(["sender", "sender", "receiver"]);
    expect(actions[0]).toMatchObject({ ownerId: "a", decisionId: "d1" });
    expect(actions[0]!.text).toContain('Add label "legal-reviewed"');
    expect(actions[1]!.text).toContain("Set a due date on the work item");
    expect(actions[2]).toMatchObject({ owner: "receiver", ownerId: "b" });
  });

  it("names the person who confirmed a decision with an invalid date as its owner", () => {
    const bad: Decision = { ...due, constraints: [{ kind: "dueNotAfter", date: "2026-02-30" }], confirmedBy: "carol" };
    const result = checkHandoff(handoffFrom(item(), record({ acknowledged: ["d2"] }), [bad]), [bad]);
    expect(actionList(result, people, [])).toEqual([{ owner: "decision owner", ownerId: "carol", text: expect.stringContaining("2026-02-30"), decisionId: "d2" }]);
  });

  type Sample = { handoff: { item: WorkItem; fromId: string | null; toId: string | null; acknowledged: string[] }; decisions: Decision[] };
  const samples = [muse1, muse2, muse3, adversarial].flatMap((f) => f.samples as unknown as Sample[]);

  it("is empty exactly when the verdict is clear, over every sample", () => {
    expect(samples.length).toBeGreaterThan(40);
    for (const s of samples) {
      const result = checkHandoff(s.handoff, s.decisions);
      const actions = actionList(result, { fromId: s.handoff.fromId ?? "", toId: s.handoff.toId ?? "" }, suggestFixes(s.handoff.item, s.decisions).changes);
      expect(actions.length === 0).toBe(result.verdict === "clear");
      expect(actions).toHaveLength(result.findings.length);
      expect(severityOf(result.verdict) === "Stable").toBe(result.verdict === "clear");
    }
  });
});

describe("contingency", () => {
  it("only advises when it is not written as if-then", () => {
    expect(contingencyAdvisory("If the vendor misses Friday, then ask Dana for the fallback key")).toBeNull();
    expect(contingencyAdvisory("Ask Dana about the key when the vendor is late")).toContain("if … then");
    expect(contingencyAdvisory("if then")).toContain("if … then");
  });

  it("is written only by the sender, capped, and cleared by empty text", () => {
    const r = record();
    expect(withContingency(r, "b", "If x then y, as always, please")).toEqual({ ok: false, reason: "not_sender" });
    expect(withContingency(r, null, "x")).toEqual({ ok: false, reason: "not_sender" });
    expect(withContingency(r, "a", "x".repeat(CONTINGENCY_MAX + 1))).toEqual({ ok: false, reason: "too_long" });
    const saved = withContingency(r, "a", "  If the vendor is late, then call Dana  ");
    expect(saved).toEqual({ ok: true, record: { ...r, contingency: "If the vendor is late, then call Dana" } });
    if (!saved.ok) throw new Error("expected ok");
    expect(withContingency(saved.record, "a", " ")).toEqual({ ok: true, record: r });
  });

  it("never changes a verdict: a record with and without it checks the same", () => {
    const base = checkHandoff(handoffFrom(item(), record(), [legal]), [legal]);
    const saved = checkHandoff(handoffFrom(item(), record({ contingency: "garbage" }), [legal]), [legal]);
    expect(saved).toEqual(base);
  });
});

describe("read-back", () => {
  it("addresses a decision by its title or by a constraint value, compared the way the rules compare", () => {
    expect(unaddressed("I will make sure the LEGAL-REVIEWED label is on before the launch", [legal])).toEqual([]);
    expect(unaddressed("Launch work needs legal review, understood and accepted", [legal])).toEqual([]);
    expect(unaddressed("The due date must be 2026-12-31 or earlier, got it", [due])).toEqual([]);
    expect(unaddressed("I read all of this and will follow it carefully", [legal, due])).toEqual([legal, due]);
  });

  it("counts a value only as a whole word", () => {
    const ui: Decision = { ...legal, constraints: [{ kind: "componentRequired", component: "ui" }] };
    expect(unaddressed("We will build and ship the thing carefully soon", [ui])).toEqual([ui]);
    expect(unaddressed("The ui component stays on this work item for sure", [ui])).toEqual([]);
  });

  it("accepts any read-back of the minimum length for a decision with no constraints", () => {
    const none: Decision = { ...legal, constraints: [] };
    expect(unaddressed("I have read the decision in full", [none])).toEqual([]);
  });

  it("names each decision it does not address, with the values it looked for", () => {
    expect(readBackProblems("I will follow everything that was decided here", [legal, due])).toEqual([
      'Your read-back does not mention "Launch work needs legal review" (label legal-reviewed).',
      'Your read-back does not mention "Ship by 31 December" (date 2026-12-31).',
    ]);
  });

  it("refuses text that is too short or longer than the cap", () => {
    expect(readBackProblems("legal-reviewed", [legal])).toHaveLength(1);
    expect(readBackProblems(`legal-reviewed ${"x".repeat(READ_BACK_MAX)}`, [legal])).toHaveLength(1);
    expect(READ_BACK_MAX).toBe(600);
  });
});

describe("acknowledging under protocol 1", () => {
  const binding = [legal, due];
  const text = "I will keep the legal-reviewed label on and finish by 2026-12-31 at the latest";
  const ok = item({ labels: ["legal-reviewed"] });
  const fp = fingerprintOf(ok);

  it("acknowledges every binding decision with one read-back and stores it", () => {
    const out = acknowledgeAll(record(), "b", binding, text, "t1", fp);
    expect(out).toEqual({
      ok: true,
      record: { ...record(), acknowledged: ["d1", "d2"], acknowledgedAt: { d1: "t1", d2: "t1" }, acknowledgedWith: { d1: fp, d2: fp }, readBack: text },
    });
  });

  it("refuses while any decision is unaddressed, and says which", () => {
    const out = acknowledgeAll(record(), "b", binding, "I will keep the legal-reviewed label on, thanks a lot", "t1", fp);
    expect(out).toEqual({ ok: false, reason: "read_back", problems: ['Your read-back does not mention "Ship by 31 December" (date 2026-12-31).'] });
  });

  it("answers a refused read-back with every reason as data and stores nothing", () => {
    const r = record();
    const out = acknowledgeAll(r, "b", binding, "I will follow everything that was decided here", "t1", fp);
    expect(out).toEqual({ ok: false, reason: "read_back", problems: expect.arrayContaining([expect.stringContaining("Launch work"), expect.stringContaining("Ship by")]) });
    expect("record" in out).toBe(false);
    expect(r).toEqual(record());
    // The resolver returns the reasons before it writes, and the panel shows them without the Forge prefix.
    const handler = resolvers.slice(resolvers.indexOf('resolver.define("acknowledgeAll"'), resolvers.indexOf('resolver.define("saveContingency"'));
    expect(handler.indexOf("return { reasons")).toBeGreaterThan(-1);
    expect(handler.indexOf("return { reasons")).toBeLessThan(handler.indexOf("putRecord"));
    expect(panel).toContain("plainError(e)");
  });

  it("refuses anyone but the receiver, a record without the protocol, and nothing to acknowledge", () => {
    expect(acknowledgeAll(record(), "a", binding, text, "t1", fp)).toEqual({ ok: false, reason: "not_receiver" });
    expect(acknowledgeAll(record({ protocol: undefined }), "b", binding, text, "t1", fp)).toEqual({ ok: false, reason: "no_protocol" });
    expect(acknowledgeAll(record(), "b", [], text, "t1", fp)).toEqual({ ok: false, reason: "nothing_to_acknowledge" });
  });

  it("does not let a per-decision acknowledgement bypass the read-back", () => {
    expect(acknowledge(record(), "b", "d1", ["d1"], "t1", fp, false)).toEqual({ ok: false, reason: "needs_read_back" });
  });

  it("keeps the per-decision acknowledgement for a record without the protocol", () => {
    const old = record({ protocol: undefined });
    expect(acknowledge(old, "b", "d1", ["d1"], "t1", fp, false)).toMatchObject({ ok: true });
  });

  it("clears a stale acknowledgement only by giving the read-back again, which replaces the old one", () => {
    const first = acknowledgeAll(record(), "b", binding, text, "t1", fp);
    if (!first.ok) throw new Error("expected ok");
    const moved = item({ labels: ["legal-reviewed"], dueDate: "2026-12-10" });
    const before = checkHandoff(handoffFrom(moved, first.record, binding), binding);
    expect(before.findings.map((f) => f.rule)).toEqual(["decision_not_acknowledged"]);
    expect(before.findings[0]!.decisionId).toBe("d2");
    const again = acknowledgeAll(first.record, "b", binding, `${text}, and the due date moved to 10 December`, "t2", fingerprintOf(moved));
    if (!again.ok) throw new Error("expected ok");
    expect(again.record.readBack).toContain("moved to 10 December");
    expect(again.record.acknowledgedAt).toEqual({ d1: "t2", d2: "t2" });
    expect(checkHandoff(handoffFrom(moved, again.record, binding), binding).verdict).toBe("clear");
  });

  it("leaves a new binding decision unacknowledged until a read-back addresses it too", () => {
    const first = acknowledgeAll(record(), "b", [legal], "I will keep the legal-reviewed label on this work item", "t1", fp);
    if (!first.ok) throw new Error("expected ok");
    expect(checkHandoff(handoffFrom(ok, first.record, binding), binding).findings.map((f) => f.decisionId)).toEqual(["d2"]);
    expect(acknowledgeAll(first.record, "b", binding, "I will keep the legal-reviewed label on this work item", "t2", fp).ok).toBe(false);
  });
});

describe("principle guards", () => {
  it("keeps the I-PASS functions free of Forge, the clock and the rules' source", () => {
    for (const src of [ipassSource, contingencySource, acknowledgeSource]) expect(src).not.toMatch(/@forge|Date\.now|new Date/);
  });

  it("keeps severity, read-back and contingency out of the verdict path", () => {
    for (const src of [checkSource, validator]) expect(src).not.toMatch(/ipass|readBack|contingency|severityOf|severityText/i);
  });

  it("gives no action a way to write a read-back or a contingency", () => {
    for (const src of [actionsCore, actionsIndex]) expect(src).not.toMatch(/putRecord|withContingency|acknowledgeAll|readBack/);
  });

  it("tells the agent that people write the action text, the contingency and the read-back", () => {
    for (const phrase of ["Never write an action, a contingency or a read-back yourself", "not that it was understood", "Contingency from the sender"]) {
      expect(manifest).toContain(phrase);
    }
  });

  it("shows the read-back limit and the old-record notice in the panel", () => {
    expect(READ_BACK_NOTE).toBe("The read-back checks that each decision is addressed, not that it was understood.");
    expect(panel).toContain("READ_BACK_NOTE");
    expect(panel).toMatch(/\{!protocol && <Text>\{BEFORE_READ_BACK\}<\/Text>\}/);
    expect(BEFORE_READ_BACK).toContain("no read-back was checked");
  });

  describe("README", () => {
    const section = (title: string): string => {
      const from = readme.indexOf(`## ${title}`);
      const next = readme.indexOf("\n## ", from + 1);
      return readme.slice(from, next === -1 ? undefined : next);
    };

    it("cites the hospital figures as clinical results, with the source, and says they are not this app's", () => {
      const ipass = section("I-PASS structure");
      expect(ipass).toContain("Starmer et al., N Engl J Med 2014");
      expect(ipass).toContain("clinical results from a hospital study");
      expect(ipass).toContain("not a result of this app");
      expect(ipass).toContain(READ_BACK_NOTE);
    });

    it("keeps I-PASS figures away from the measured figures and claims no effect for this app", () => {
      for (const title of ["Measurement", "Honesty notes"]) expect(section(title)).not.toMatch(/I-PASS|23%|30%/);
      expect(section("I-PASS structure")).not.toMatch(/97\.9|70\.8|agreement with Muse/);
      expect(readme).not.toMatch(/clinically validated|endorsed by|this app (reduces|reduced|prevents|lowers|improves)/i);
    });

    it("states the limits: an agent cannot acknowledge, and the read-back checks coverage", () => {
      const limits = section("Limits");
      expect(limits).toContain("it cannot acknowledge, so that handoff stays Needs info until a person changes the receiver");
      expect(limits).toContain(READ_BACK_NOTE);
    });
  });
});
