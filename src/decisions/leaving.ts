import { handoffFrom } from "../handoff/build";
import type { HandoffRecord } from "../handoff/types";
import { checkHandoff, norm } from "../rules/checkHandoff";
import type { Decision, Verdict, WorkItem } from "../rules/types";
import { touches } from "./page";
import { reachText } from "./reach";

export type LeavingView = {
  personId: string;
  assigned: { key: string; summary: string; handoff: "none" | { toId: string; verdict: Verdict } }[];
  toAcknowledge: { key: string; summary: string; fromId: string; waiting: number }[];
  decisions: { id: string; title: string; reach: string }[];
  scanned: number;
  capped: boolean;
};

// Missing handoffs first: they are the work nobody started. Then worst verdict first, then by key.
const RANK: Record<Verdict | "none", number> = { none: 0, blocked: 1, needs_info: 2, clear: 3 };

/**
 * What one person still holds in a project: their open items, the handoffs they have not
 * acknowledged, and the decisions only they can supersede. Pure: the caller reads everything.
 */
export function leavingView(
  personId: string,
  entries: { item: WorkItem; record: HandoffRecord | null }[],
  decisions: Decision[],
  projectKey: string,
  scanned: number,
  capped: boolean,
): LeavingView {
  const assigned = entries
    .filter((e) => e.item.assigneeId !== null && norm(e.item.assigneeId) === norm(personId))
    .map((e) => ({
      key: e.item.key,
      summary: e.item.summary,
      // A handoff that made this person the receiver is how they got the work, not how they pass it on.
      handoff:
        e.record === null || norm(e.record.toId) === norm(personId)
          ? ("none" as const)
          : { toId: e.record.toId, verdict: checkHandoff(handoffFrom(e.item, e.record, decisions), decisions).verdict },
    }))
    .sort((a, b) => RANK[a.handoff === "none" ? "none" : a.handoff.verdict] - RANK[b.handoff === "none" ? "none" : b.handoff.verdict] || a.key.localeCompare(b.key));
  const toAcknowledge = entries
    .flatMap((e) => {
      if (e.record === null || norm(e.record.toId) !== norm(personId)) return [];
      const missing = checkHandoff(handoffFrom(e.item, e.record, decisions), decisions).binding.filter((d) => !e.record?.acknowledged.includes(d.id));
      return missing.length === 0 ? [] : [{ key: e.item.key, summary: e.item.summary, fromId: e.record.fromId, waiting: missing.length }];
    })
    .sort((a, b) => a.key.localeCompare(b.key));
  const mine = decisions
    .filter((d) => d.status === "decided" && d.confirmedBy === personId && touches(d, projectKey))
    .map((d) => ({ id: d.id, title: d.title, reach: reachText(d.scope) }))
    .sort((a, b) => a.title.localeCompare(b.title));
  return { personId, assigned, toAcknowledge, decisions: mine, scanned, capped };
}
