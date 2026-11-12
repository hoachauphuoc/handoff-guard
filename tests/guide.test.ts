/// <reference types="vite/client" />
import { describe, expect, it } from "vitest";
import actionsCore from "../src/actions/core?raw";
import actionsIndex from "../src/actions/index?raw";
import measure from "../scripts/measure.ts?raw";
import validator from "../src/validator?raw";
import { HINTS } from "../src/guide/hints";
import { GUIDE_SOURCE, PRACTICE_NONE, PRACTICE_TITLE, STEPS, guideView } from "../src/guide/steps";
import type { PanelState } from "../src/handoff/types";
import { walkthroughHandoff, WALKTHROUGH_RECEIVER } from "../src/handoff/build";
import { bindingDecisions, checkHandoff } from "../src/rules/checkHandoff";
import type { Decision, Finding, WorkItem } from "../src/rules/types";
import muse1 from "../data/samples/muse-20261112T013558Z.json";
import muse2 from "../data/samples/muse-20261112T013950Z.json";
import muse3 from "../data/samples/muse-20261112T015137Z.json";
import adversarial from "../data/samples/sonnet-adversarial.json";

const state = (over: Partial<PanelState> = {}): PanelState => ({
  issueKey: "OPS-1",
  record: null,
  result: null,
  viewerId: "me",
  isReceiver: false,
  decisionCount: 0,
  practiceFindings: [],
  proposals: [],
  fixes: [],
  advisories: [],
  ...over,
});
const record = { fromId: "me", toId: "you", acknowledged: [] as string[], preparedAt: "t", acknowledgedAt: {} };
const finding: Finding = { rule: "no_due_date", severity: "info_needed", message: "No due date is set." };

describe("guide steps", () => {
  it("has unique ids and every step has a done predicate", () => {
    const ids = STEPS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual(["load_samples", "item_ready", "prepare", "acknowledge", "real_clear", "rovo", "validator"]);
    for (const s of STEPS) expect(typeof s.done).toBe("function");
  });

  it("derives each step from the panel state", () => {
    const by = (id: string) => STEPS.find((s) => s.id === id)!;
    expect(by("load_samples").done(state())).toBe(false);
    expect(by("load_samples").done(state({ decisionCount: 2 }))).toBe(true);
    expect(by("item_ready").done(state({ practiceFindings: [finding] }))).toBe(false);
    expect(by("item_ready").done(state())).toBe(true);
    expect(by("prepare").done(state())).toBe(false);
    expect(by("prepare").done(state({ record: { ...record, toId: "me" } }))).toBe(false);
    expect(by("prepare").done(state({ record }))).toBe(true);
    expect(by("acknowledge").done(state({ record }))).toBe(false);
    expect(by("acknowledge").done(state({ record: { ...record, acknowledged: ["d1"] } }))).toBe(true);
    expect(by("real_clear").done(state())).toBe(false);
    expect(by("real_clear").done(state({ result: { verdict: "clear", findings: [], binding: [] } }))).toBe(true);
    expect(by("rovo").done(state())).toBeNull();
    expect(by("validator").done(state())).toBeNull();
  });

  it("picks the first unfinished step as next and never ticks manual steps", () => {
    const v = guideView(state());
    expect(v.nextId).toBe("load_samples");
    expect(v.steps.filter((s) => s.state === "next")).toHaveLength(1);
    expect(v.steps.find((s) => s.id === "rovo")?.state).toBe("manual");
    const mid = guideView(state({ decisionCount: 1 }));
    expect(mid.nextId).toBe("prepare");
    expect(mid.doneCount).toBe(2);
    const all = guideView(
      state({
        decisionCount: 1,
        record: { ...record, acknowledged: ["d1"] },
        result: { verdict: "clear", findings: [], binding: [] },
      }),
    );
    expect(all.nextId).toBeNull();
    expect(all.doneCount).toBe(5);
    expect(all.total).toBe(7);
  });

  it("keeps verdict words out of the practice texts and has no template leftovers", () => {
    // The mandated title says "not a verdict"; it is the only place the word may appear.
    const practice = [PRACTICE_NONE, ...Object.values(HINTS)];
    const item = STEPS.find((s) => s.id === "item_ready")!;
    const all = [PRACTICE_TITLE, ...practice, item.title, item.how, GUIDE_SOURCE, ...STEPS.flatMap((s) => [s.title, s.how])];
    for (const t of practice.concat(item.title, item.how)) {
      expect(t).not.toMatch(/clear|blocked|needs info|verdict/i);
    }
    for (const t of all) expect(t).not.toContain("${");
  });
});

describe("hints", () => {
  const rules: Finding["rule"][] = [
    "no_sender",
    "no_receiver",
    "same_person",
    "empty_description",
    "no_due_date",
    "invalid_due_date",
    "invalid_constraint",
    "contradicts_decision",
    "decision_not_acknowledged",
  ];
  it("covers every rule with one imperative sentence and no verdict language", () => {
    expect(Object.keys(HINTS).sort()).toEqual([...rules].sort());
    for (const h of Object.values(HINTS)) {
      expect(h.endsWith(".")).toBe(true);
      expect(h).not.toMatch(/clear|blocked|needs info|verdict|will pass|guarantee/i);
    }
  });
});

describe("practice handoff", () => {
  type Sample = { handoff: { item: WorkItem }; decisions: Decision[] };
  const samples = [muse1, muse2, muse3, adversarial].flatMap((f) => f.samples as unknown as Sample[]);
  const PRACTICE: Finding["rule"][] = ["empty_description", "no_due_date", "invalid_due_date", "contradicts_decision", "invalid_constraint"];

  it("filtered findings never include receiver or acknowledgement rules", () => {
    expect(samples.length).toBeGreaterThan(40);
    for (const s of samples) {
      const ids = bindingDecisions(s.decisions, s.handoff.item).map((d) => d.id);
      const out = checkHandoff(walkthroughHandoff(s.handoff.item, "viewer", ids), s.decisions);
      // The made-up receiver differs from the viewer and everything is acknowledged, so these cannot appear.
      for (const f of out.findings) expect(["no_receiver", "same_person", "no_sender", "decision_not_acknowledged"]).not.toContain(f.rule);
      for (const f of out.findings.filter((x) => PRACTICE.includes(x.rule))) expect(PRACTICE).toContain(f.rule);
    }
  });

  it("uses a placeholder sender when the viewer is unknown", () => {
    const h = walkthroughHandoff(samples[0]!.handoff.item, null, []);
    expect(h.fromId).toBe("example-sender (practice)");
    expect(h.toId).toBe(WALKTHROUGH_RECEIVER);
  });

  it("is imported only by the panel resolver", () => {
    for (const src of [validator, actionsCore, actionsIndex, measure]) {
      expect(src).not.toContain("walkthroughHandoff");
      expect(src).not.toContain("WALKTHROUGH_RECEIVER");
    }
  });
});
