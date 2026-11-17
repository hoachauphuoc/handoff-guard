import { checkHandoff } from "../rules/checkHandoff";
import type { Decision, Verdict, WorkItem, ProjectRules } from "../rules/types";
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
  /** What else the rule check says is missing, in its own words: an acknowledgement alone would not make these Clear. */
  missing: string[];
};

const DAY = 86_400_000;
const RANK: Record<InFlight["verdict"], number> = { blocked: 0, needs_info: 1 };

// Ten worst first fit above the fold; the rest wait behind a button so a long list does not bury the page.
export const IN_FLIGHT_SHOWN = 10;

const keyParts = (key: string): [string, number] => {
  const dash = key.lastIndexOf("-");
  return [key.slice(0, dash), Number(key.slice(dash + 1))];
};

/** Work item keys in the order Jira shows them: OPS-8 before OPS-11, which plain text order reverses. */
export const compareKeys = (a: string, b: string): number => {
  const [pa, na] = keyParts(a);
  const [pb, nb] = keyParts(b);
  return pa.localeCompare(pb) || na - nb || a.localeCompare(b);
};

/**
 * Prepared handoffs whose check is not Clear, worst first: blocked before needs info, then the oldest. The
 * order is plain code. The clock is passed in, so the same input always gives the same list.
 */
export function inFlight(entries: { item: WorkItem; record: HandoffRecord | null }[], decisions: Decision[], nowIso: string, rules?: ProjectRules): InFlight[] {
  const now = Date.parse(nowIso);
  const out: InFlight[] = [];
  for (const { item, record } of entries) {
    if (record === null) continue;
    const result = checkHandoff(handoffFrom(item, record, decisions, rules), decisions);
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
      missing: result.findings.filter((f) => f.rule !== "contradicts_decision" && f.rule !== "decision_not_acknowledged").map((f) => f.message),
    });
  }
  return out.sort((a, b) => RANK[a.verdict] - RANK[b.verdict] || b.ageDays - a.ageDays || compareKeys(a.key, b.key));
}

// The page shows the worst ten first; the rest only after the reader asks, never dropped by code.
export const shownInFlight = (list: InFlight[], all: boolean): InFlight[] => (all ? list : list.slice(0, IN_FLIGHT_SHOWN));

// A key of the form ABC-12 opens that work item; anything else stays plain text so no crafted key becomes a link.
export const browsePath = (key: string): string | null => (/^[A-Z][A-Z0-9_]+-\d+$/.test(key) ? `/browse/${key}` : null);
