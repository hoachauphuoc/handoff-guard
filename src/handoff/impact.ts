import { checkHandoff } from "../rules/checkHandoff";
import type { Decision, ProjectRules, WorkItem } from "../rules/types";
import { handoffFrom } from "./build";
import type { HandoffRecord } from "./types";

export type RuleImpact = { checked: number; wouldTurn: number; keys: string[] };

const MAX_KEYS = 10;

/**
 * What releasing one rule would do to the handoffs stored today: how many that are Clear now would need
 * information. Plain code over the same check as everything else; it writes nothing.
 */
export function ruleImpact(
  entries: { item: WorkItem; record: HandoffRecord | null }[],
  decisions: Decision[],
  current: ProjectRules,
  rule: keyof ProjectRules,
): RuleImpact {
  const turned: string[] = [];
  let checked = 0;
  for (const { item, record } of entries) {
    if (record === null) continue;
    checked += 1;
    const before = checkHandoff(handoffFrom(item, record, decisions, current), decisions);
    if (before.verdict !== "clear") continue;
    const after = checkHandoff(handoffFrom(item, record, decisions, { ...current, [rule]: true }), decisions);
    if (after.verdict !== "clear") turned.push(item.key);
  }
  return { checked, wouldTurn: turned.length, keys: turned.slice(0, MAX_KEYS) };
}
