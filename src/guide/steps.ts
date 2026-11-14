import type { PanelState } from "../handoff/types";

export type GuideStepId =
  | "load_samples"
  | "item_ready"
  | "prepare"
  | "acknowledge"
  | "real_clear"
  | "rovo"
  | "validator"
  | "join_decisions"
  | "join_binding"
  | "join_brief"
  | "join_page"
  | "leave_view"
  | "leave_this"
  | "leave_decisions";
export type StepNeed = "teammate" | "rovo" | "admin";
export type GuidePath = "join" | "handover" | "leave";

export const PATH_NAMES: Record<GuidePath, string> = {
  join: "New to this project",
  handover: "Handing over this work",
  leave: "Leaving the project",
};

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
export const PRACTICE_READBACK_HOW =
  "Try it alone: say what you would do about each decision that binds this work item, naming it by its title. A read-back that contradicts a decision, such as a later date, is refused.";
export const PRACTICE_READBACK_BUTTON = "Try a read-back (practice, nothing is saved)";
export const PRACTICE_READBACK_ACCEPTED = "This read-back would be accepted. Practice only: nothing is saved and there is no verdict. In a real handoff the receiver's read-back gets this same check.";
export const PRACTICE_READBACK_REFUSED = "This read-back would be refused:";

export const STEPS: GuideStep[] = [
  {
    id: "load_samples",
    title: "Decisions are loaded",
    how: "Click Load sample decisions (demo). They are demo rules for this project; nothing is written to Jira.",
    done: (s) => s.inForceCount > 0,
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
    how: "The receiver opens this work item, writes one read-back that mentions each decision, then clicks Acknowledge all with this read-back.",
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
    how: "Click Explain with Rovo. Click Find decisions with Rovo to have it propose decisions from this work item's description and comments. On a site without Rovo the buttons say so, and the verdict still comes from the rule check.",
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

export const JOIN_STEPS: GuideStep[] = [
  {
    id: "join_decisions",
    title: "Decisions are loaded",
    how: "If none are stored yet, click Load sample decisions (demo).",
    done: (s) => s.inForceCount > 0,
  },
  {
    id: "join_binding",
    title: "Read the decisions that bind this work item",
    how: "They are listed under the handoff, each with its source.",
    done: () => null,
  },
  {
    id: "join_brief",
    title: "Ask Rovo for the handoff brief",
    how: "Click Gather handoff context, then ask the Handoff Guard agent for a brief.",
    needs: "rovo",
    done: () => null,
  },
  {
    id: "join_page",
    title: "See every decision in the project",
    how: "Open the project's Decisions page from the project sidebar.",
    done: () => null,
  },
];

export const LEAVE_STEPS: GuideStep[] = [
  {
    id: "leave_view",
    title: "See what you hold",
    how: "Open the project's Decisions page and use Leaving the project with your name.",
    done: () => null,
  },
  {
    id: "leave_this",
    title: "This work item is handed over",
    how: "Pick a receiver who is not you, then click Prepare handoff.",
    done: (s) => s.record !== null && s.viewerId !== null && s.record.fromId === s.viewerId && s.record.toId !== s.viewerId,
  },
  {
    id: "leave_decisions",
    title: "Your decisions are superseded or passed on",
    how: "Only the person who confirmed a decision can supersede it. Do it on the Decisions page before you leave, or ask a teammate to record a replacement.",
    done: () => null,
  },
];

export const PATHS: Record<GuidePath, GuideStep[]> = {
  join: JOIN_STEPS,
  handover: STEPS,
  leave: LEAVE_STEPS,
};

export type StepState = "done" | "next" | "todo" | "manual";
export type GuideView = {
  steps: { id: GuideStepId; title: string; how: string; needs?: StepNeed; state: StepState }[];
  doneCount: number;
  total: number;
  nextId: GuideStepId | null;
};

export function guideView(s: PanelState, path: GuidePath = "handover"): GuideView {
  const list = PATHS[path];
  const flags = list.map((step) => step.done(s));
  const nextIndex = flags.findIndex((f) => f === false);
  const steps = list.map((step, i) => {
    const f = flags[i];
    const state: StepState = f === null ? "manual" : f ? "done" : i === nextIndex ? "next" : "todo";
    return { id: step.id, title: step.title, how: step.how, ...(step.needs ? { needs: step.needs } : {}), state };
  });
  return {
    steps,
    doneCount: steps.filter((x) => x.state === "done").length,
    total: steps.length,
    nextId: nextIndex === -1 ? null : (list[nextIndex]?.id ?? null),
  };
}
