import type { HandoffResult, Verdict } from "../rules/types";

/** The status Jira draws beside the collapsed issue context panel (dynamicProperties). */
export type ContextStatus = {
  status: { type: "lozenge"; value: { label: string; type: "default" | "success" | "moved" | "removed" } };
};

export const LOOK: Record<Verdict, { label: string; type: "success" | "moved" | "removed" }> = {
  clear: { label: "Clear", type: "success" },
  needs_info: { label: "Needs info", type: "moved" },
  blocked: { label: "Blocked", type: "removed" },
};

/** Shown whenever no rule-check result is at hand, so the header never shows a verdict that was not computed. */
export const NOT_CHECKED: ContextStatus = { status: { type: "lozenge", value: { label: "Not checked", type: "default" } } };
export const NO_HANDOFF: ContextStatus = { status: { type: "lozenge", value: { label: "No handoff", type: "default" } } };

// A clear verdict has no findings by the rules, so it is never given a count.
export function contextStatus(result: HandoffResult | null): ContextStatus {
  if (result === null) return NO_HANDOFF;
  const look = LOOK[result.verdict];
  const n = result.verdict === "clear" ? 0 : result.findings.length;
  return { status: { type: "lozenge", value: { label: n > 0 ? `${look.label} (${n})` : look.label, type: look.type } } };
}
