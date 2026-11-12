import type { HandoffRecord } from "./types";

export type AckResult =
  | { ok: true; record: HandoffRecord }
  | { ok: false; reason: "not_receiver" | "not_binding" | "already_acknowledged" };

/** Only the receiver acknowledges, and only a decision that binds this item; the caller passes the time. */
export function acknowledge(
  record: HandoffRecord,
  accountId: string | null,
  decisionId: string,
  bindingIds: string[],
  nowIso: string,
): AckResult {
  if (accountId === null || accountId !== record.toId) return { ok: false, reason: "not_receiver" };
  if (!bindingIds.includes(decisionId)) return { ok: false, reason: "not_binding" };
  if (record.acknowledged.includes(decisionId)) return { ok: false, reason: "already_acknowledged" };
  return {
    ok: true,
    record: {
      ...record,
      acknowledged: [...record.acknowledged, decisionId],
      acknowledgedAt: { ...record.acknowledgedAt, [decisionId]: nowIso },
    },
  };
}
