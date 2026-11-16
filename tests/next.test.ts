/// <reference types="vite/client" />
import { describe, expect, it } from "vitest";
import panel from "../src/frontend/index.tsx?raw";
import { nextStep, waitingFor } from "../src/guide/next";
import type { PanelState } from "../src/handoff/types";
import type { Decision, HandoffResult } from "../src/rules/types";

const decision = { id: "d1", title: "Ships by the end of 2026" } as Decision;
const record = { fromId: "me", toId: "you", acknowledged: [] as string[], preparedAt: "t", acknowledgedAt: {} };
const blocked: HandoffResult = { verdict: "needs_info", findings: [{ rule: "decision_not_acknowledged", severity: "info_needed", message: "m" }], binding: [decision] };
const clear: HandoffResult = { verdict: "clear", findings: [], binding: [decision] };

const state = (over: Partial<PanelState> = {}): PanelState =>
  ({ record: null, result: null, viewerId: "me", isReceiver: false, canManage: true, canPrepare: true, inForceCount: 2, exampleReadBack: "x", fixes: [], stale: [], ...over }) as PanelState;

describe("the viewer's next step", () => {
  it("is loading the demo rules, or asking an administrator, while no decision is in force", () => {
    expect(nextStep(state({ inForceCount: 0 })).kind).toBe("load_samples");
    expect(nextStep(state({ inForceCount: 0, canManage: false })).kind).toBe("ask_admin");
  });

  it("names the remove button when the demo rules are loaded but none is in force, and the panel shows it", () => {
    expect(nextStep(state({ inForceCount: 0, hasSamples: true })).how).toContain("Click Remove sample decisions, then Load sample decisions (demo)");
    // The empty state offers that button itself, not only behind "Show everything".
    expect(panel).toContain('{state.hasSamples && state.canManage && (\n            <Button appearance="primary" isDisabled={busy} onClick={() => call("removeSampleDecisions")}>');
  });

  it("is handing over for who may prepare, and practising for anyone else", () => {
    expect(nextStep(state()).kind).toBe("prepare");
    expect(nextStep(state({ canPrepare: false })).kind).toBe("practice");
    expect(nextStep(state({ canPrepare: false, exampleReadBack: "" })).kind).toBe("done");
  });

  it("is the read-back for the receiver while a decision waits, and nothing once Clear", () => {
    const viewer = { viewerId: "you", isReceiver: true, record };
    expect(nextStep(state({ ...viewer, result: blocked })).kind).toBe("read_back");
    expect(waitingFor(state({ ...viewer, result: blocked }))).toEqual(["d1"]);
    const acked = { ...record, acknowledged: ["d1"] };
    expect(nextStep(state({ ...viewer, record: acked, result: clear })).kind).toBe("done");
    expect(nextStep(state({ ...viewer, record: acked, result: clear, stale: ["d1"] })).kind).toBe("read_back");
  });

  it("is fixing the work item for the sender when a fix is known, else waiting for the receiver", () => {
    expect(nextStep(state({ record, result: blocked, fixes: ["Set the due date to 2026-12-31"] })).kind).toBe("fix");
    expect(nextStep(state({ record, result: blocked })).kind).toBe("wait_receiver");
  });

  it("is fixing the work item when a rule it breaks has no suggested edit, such as a Jira filter", () => {
    const filter: HandoffResult = { ...blocked, verdict: "blocked", findings: [{ rule: "contradicts_decision", severity: "block", message: "m" }] };
    expect(nextStep(state({ record, result: filter })).kind).toBe("fix");
    // The receiver cannot change the work item to match; their own next step stays what it was.
    expect(nextStep(state({ record, result: filter, isReceiver: true, viewerId: "you" })).kind).not.toBe("fix");
  });

  it("speaks plain words: every step explains itself without Jira or I-PASS terms", () => {
    const all = [
      state({ inForceCount: 0 }),
      state({ inForceCount: 0, canManage: false }),
      state(),
      state({ canPrepare: false }),
      state({ viewerId: "you", isReceiver: true, record, result: blocked }),
      state({ record, result: blocked }),
    ].map(nextStep);
    for (const s of all) for (const word of ["I-PASS", "Watcher", "Unstable", "binds", "JQL"]) expect(s.how).not.toContain(word);
  });
});

describe("focused panel", () => {
  it("opens on the next step and keeps the rest one click away", () => {
    expect(panel).toContain("const [everything, setEverything] = useState(false);");
    expect(panel).toContain("title={`Your next step: ${next.title}`}");
    expect(panel).toContain("{everything ? SHOW_LESS : SHOW_EVERYTHING}");
  });

  it("always shows the verdict and its findings, whatever the view", () => {
    const verdict = panel.indexOf("{record && result && (");
    const card = panel.indexOf("Your next step:");
    expect(verdict).toBeGreaterThan(-1);
    expect(verdict).toBeLessThan(card);
    const top = panel.slice(verdict, card);
    expect(top).toMatch(/\n\s*\{result\.findings\.map\(/);
    expect(top).toMatch(/\n\s*<VerdictCard\n\s*verdict=\{result\.verdict\}/);
    // The verdict word is a heading inside the card, so it is read out, not only coloured.
    expect(panel).toMatch(/<Heading as="h3" size="medium">\s*\{LOOK\[verdict\]\.text\}/);
    expect(top).toMatch(/\n\s*\{state\.gateHeld && \(/);
  });
});
