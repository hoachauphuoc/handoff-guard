import { checkHandoff } from "../rules/checkHandoff";
import type { Decision, Verdict, WorkItem } from "../rules/types";
import { handoffFrom } from "./build";
import type { HandoffRecord } from "./types";

export type InFlight = {
  key: string;
  summary: string;
  fromId: string;
  toId: string;
  ageDays: number;
  verdict: Exclude<Verdict, "clear">;
  /** Titles of the decisions the work item contradicts. */
  blockedBy: string[];
  unacknowledged: number;
};

const DAY = 86_400_000;
const RANK: Record<InFlight["verdict"], number> = { blocked: 0, needs_info: 1 };

/**
 * Prepared handoffs whose check is not Clear, worst first: blocked before needs info, then the oldest. The
 * order is plain code. The clock is passed in, so the same input always gives the same list.
 */
export function inFlight(entries: { item: WorkItem; record: HandoffRecord | null }[], decisions: Decision[], nowIso: string): InFlight[] {
  const now = Date.parse(nowIso);
  const out: InFlight[] = [];
  for (const { item, record } of entries) {
    if (record === null) continue;
    const result = checkHandoff(handoffFrom(item, record), decisions);
    if (result.verdict === "clear") continue;
    const title = (id: string | undefined) => result.binding.find((d) => d.id === id)?.title;
    out.push({
      key: item.key,
      summary: item.summary,
      fromId: record.fromId,
      toId: record.toId,
      ageDays: Math.max(0, Math.floor((now - Date.parse(record.preparedAt)) / DAY)),
      verdict: result.verdict,
      blockedBy: [
        ...new Set(
          result.findings
            .filter((f) => f.rule === "contradicts_decision")
            .map((f) => title(f.decisionId))
            .filter((t): t is string => t !== undefined),
        ),
      ],
      unacknowledged: result.findings.filter((f) => f.rule === "decision_not_acknowledged").length,
    });
  }
  return out.sort((a, b) => RANK[a.verdict] - RANK[b.verdict] || b.ageDays - a.ageDays || a.key.localeCompare(b.key));
}
