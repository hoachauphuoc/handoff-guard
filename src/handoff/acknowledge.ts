import type { Fingerprint } from "./drift";
import type { HandoffRecord } from "./types";

export type AckResult =
  | { ok: true; record: HandoffRecord }
  | { ok: false; reason: "not_receiver" | "not_binding" | "already_acknowledged" };

/**
 * Only the receiver acknowledges, and only a decision that binds this item; the caller passes the time. A
 * decision already acknowledged can be acknowledged again only when that acknowledgement went stale, and the
 * new one replaces the old time and baseline. `fingerprint` is the work item as the receiver sees it now.
 */
export function acknowledge(
  record: HandoffRecord,
  accountId: string | null,
  decisionId: string,
  bindingIds: string[],
  nowIso: string,
  fingerprint: Fingerprint,
  stale: boolean,
): AckResult {
  if (accountId === null || accountId !== record.toId) return { ok: false, reason: "not_receiver" };
  if (!bindingIds.includes(decisionId)) return { ok: false, reason: "not_binding" };
  if (record.acknowledged.includes(decisionId) && !stale) return { ok: false, reason: "already_acknowledged" };
  return {
    ok: true,
    record: {
      ...record,
      acknowledged: record.acknowledged.includes(decisionId) ? record.acknowledged : [...record.acknowledged, decisionId],
      acknowledgedAt: { ...record.acknowledgedAt, [decisionId]: nowIso },
      acknowledgedWith: { ...record.acknowledgedWith, [decisionId]: fingerprint },
    },
  };
}
