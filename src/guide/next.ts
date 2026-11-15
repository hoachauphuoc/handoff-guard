import type { PanelState } from "../handoff/types";

// The one thing the viewer can do next, so the panel can open on it and keep the rest behind "Show everything".
// Plain words: someone who has never used Jira reads this first.
export type NextKind = "load_samples" | "ask_admin" | "prepare" | "practice" | "read_back" | "fix" | "wait_receiver" | "done";
export type NextStep = { kind: NextKind; title: string; how: string };

export const SHOW_EVERYTHING = "Show everything";
export const SHOW_LESS = "Show only my next step";

/** Decisions the receiver still has to read back: not acknowledged, or acknowledged before the work item changed. */
export function waitingFor(s: PanelState): string[] {
  const { record, result } = s;
  if (!record || !result) return [];
  return result.binding.filter((d) => !record.acknowledged.includes(d.id) || s.stale.includes(d.id)).map((d) => d.id);
}

export function nextStep(s: PanelState): NextStep {
  if (s.inForceCount === 0) {
    return s.canManage
      ? { kind: "load_samples", title: "Load the demo rules", how: "A decision is a rule your team agreed, such as a latest date. This project has none yet. Click Load sample decisions (demo) to add three demo rules; nothing is written to Jira." }
      : { kind: "ask_admin", title: "Ask a project administrator", how: "This project has no decisions yet (a decision is a rule your team agreed). Only a project administrator can add them." };
  }
  const { record, result } = s;
  if (record && result) {
    if (s.isReceiver && waitingFor(s).length > 0) {
      return { kind: "read_back", title: "Say what you will do", how: "This work was handed to you. Below are the rules that apply to it. Write in your own words what you will do about each one, then click Acknowledge all with this read-back. One that breaks a rule, such as a later date, is refused." };
    }
    if (result.verdict === "clear") return { kind: "done", title: "Nothing to do", how: "The handoff is Clear: nothing is missing and the receiver has confirmed every rule." };
    if (!s.isReceiver && s.fixes.length > 0) {
      return { kind: "fix", title: "Fix the work item", how: "The work item breaks a rule that applies to it. Make the change below in Jira, then reload this panel." };
    }
    return { kind: "wait_receiver", title: "Wait for the receiver", how: "The person who takes over opens this work item and says in their own words what they will do. The list above says what is still missing." };
  }
  if (s.exampleReadBack === "" && !s.canPrepare) {
    return { kind: "done", title: "Nothing to do here", how: "No rule your team agreed applies to this work item, and only its assignee or a project administrator can hand it over." };
  }
  if (s.canPrepare) {
    return { kind: "prepare", title: "Hand it over", how: "Pick the person who takes over this work, then click Prepare handoff. That person is asked to confirm the rules that apply to it." };
  }
  return { kind: "practice", title: "Try it yourself", how: "Write what you would do about each rule that applies to this work item, then click the practice button. Nothing is saved." };
}
