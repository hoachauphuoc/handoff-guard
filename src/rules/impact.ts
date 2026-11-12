import { checkItem } from "./checkHandoff";
import type { Decision, WorkItem } from "./types";

export type Impact = { key: string; reasons: string[] };

/**
 * The work items that contradict one decision right now. Uses the same per-decision check as the rule check
 * and the validator, so this count can never disagree with a verdict. A date limit that is not a real date is
 * not a contradiction (the rule check reports it as missing information), so it is not counted here either.
 */
export function impactOf(decision: Decision, items: WorkItem[]): Impact[] {
  const out: Impact[] = [];
  for (const item of items) {
    const reasons = checkItem(item, [decision])
      .filter((f) => f.rule === "contradicts_decision")
      .map((f) => f.message);
    if (reasons.length > 0) out.push({ key: item.key, reasons });
  }
  return out;
}
