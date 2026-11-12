import type { PanelState } from "../handoff/types";

export type GuideStepId = "load_samples" | "item_ready" | "prepare" | "acknowledge" | "real_clear" | "rovo" | "validator";
export type StepNeed = "teammate" | "rovo" | "admin";

export type GuideStep = {
  id: GuideStepId;
  title: string;
  how: string;
  needs?: StepNeed;
  /** null: the app cannot tell from its own state, so the step is shown but never ticked. */
  done: (s: PanelState) => boolean | null;
};

export const GUIDE_SOURCE = "Source: built-in guide";
export const PRACTICE_TITLE = "Practice check (not a verdict, nothing is saved)";
export const PRACTICE_NONE =
  "No problems found in the work item itself. A real handoff still needs a receiver, and the receiver must acknowledge each binding decision.";

export const STEPS: GuideStep[] = [
  {
    id: "load_samples",
    title: "Decisions are loaded",
    how: "Click Load sample decisions (demo). They are demo rules for this project; nothing is written to Jira.",
    done: (s) => s.decisionCount > 0,
  },
  {
    id: "item_ready",
    title: "The work item has what a receiver needs",
    how: "Add a description and a due date and follow the decisions. The practice check lists what is still missing.",
    done: (s) => s.practiceFindings.length === 0,
  },
  {
    id: "prepare",
    title: "A handoff is prepared",
    how: "Pick a receiver who is not you, then click Prepare handoff.",
    needs: "teammate",
    done: (s) => s.record !== null && s.record.toId !== s.record.fromId,
  },
  {
    id: "acknowledge",
    title: "The receiver has acknowledged the decisions",
    how: "The receiver opens this work item and clicks Acknowledge under each decision.",
    needs: "teammate",
    done: (s) => s.record !== null && s.record.acknowledged.length > 0,
  },
  {
    id: "real_clear",
    title: "Every finding is resolved",
    how: "When every finding is gone the lozenge reads Clear and the validator lets the transition through.",
    done: (s) => s.result?.verdict === "clear",
  },
  {
    id: "rovo",
    title: "Ask Rovo to explain",
    how: "Click Explain with Rovo.",
    needs: "rovo",
    done: () => null,
  },
  {
    id: "validator",
    title: "Gate a transition with the validator",
    how: "Jira admin: Project settings > Workflows > edit a transition > Validators > add Handoff Guard.",
    needs: "admin",
    done: () => null,
  },
];

export type StepState = "done" | "next" | "todo" | "manual";
export type GuideView = {
  steps: { id: GuideStepId; title: string; how: string; needs?: StepNeed; state: StepState }[];
  doneCount: number;
  total: number;
  nextId: GuideStepId | null;
};

export function guideView(s: PanelState): GuideView {
  const flags = STEPS.map((step) => step.done(s));
  const nextIndex = flags.findIndex((f) => f === false);
  const steps = STEPS.map((step, i) => {
    const f = flags[i];
    const state: StepState = f === null ? "manual" : f ? "done" : i === nextIndex ? "next" : "todo";
    return { id: step.id, title: step.title, how: step.how, ...(step.needs ? { needs: step.needs } : {}), state };
  });
  return {
    steps,
    doneCount: steps.filter((x) => x.state === "done").length,
    total: steps.length,
    nextId: nextIndex === -1 ? null : (STEPS[nextIndex]?.id ?? null),
  };
}
