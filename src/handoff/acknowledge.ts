import type { Decision } from "../rules/types";
import type { Fingerprint } from "./drift";
import { READ_BACK_MAX, READ_BACK_MIN, readBackProblems } from "./ipass";
import { contradictions, type Contradiction } from "./teachback";
import type { HandoffRecord } from "./types";

export type AckResult =
  | { ok: true; record: HandoffRecord }
  | { ok: false; reason: "not_receiver" | "not_binding" | "already_acknowledged" | "needs_read_back" };

/**
 * Only the receiver acknowledges, and only a decision that binds this item; the caller passes the time. A
 * decision already acknowledged can be acknowledged again only when that acknowledgement went stale, and the
 * new one replaces the old time and baseline. `fingerprint` is the work item as the receiver sees it now.
 * A record under the I-PASS protocol is acknowledged only through `acknowledgeAll`, with a read-back.
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
  if (record.protocol === 1) return { ok: false, reason: "needs_read_back" };
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

export type AckAllResult =
  | { ok: true; record: HandoffRecord }
  | { ok: false; reason: "not_receiver" | "no_protocol" | "nothing_to_acknowledge" }
  | { ok: false; reason: "read_back"; problems: string[]; contradictions: Contradiction[] };

/**
 * Whether a read-back would be refused or accepted, without a record: the coverage reasons followed by
 * each contradiction's reason, in the same order `acknowledgeAll` reports them.
 */
export function checkReadBack(readBack: string, binding: Decision[], nowIso: string): { problems: string[]; contradictions: Contradiction[] } {
  const reasons = readBackProblems(readBack, binding);
  const length = readBack.trim().length;
  // A read-back of the wrong length gets only the length reason; there is nothing to compare yet.
  const contradicted = length < READ_BACK_MIN || length > READ_BACK_MAX ? [] : contradictions(readBack, binding, nowIso);
  return { problems: [...reasons, ...contradicted.map((c) => c.reason)], contradictions: contradicted };
}

/**
 * One read-back acknowledges every binding decision. It must address all of them, not only the ones that are
 * new or stale: it replaces the earlier read-back, and each acknowledgement takes a new time and baseline, so
 * a stale acknowledgement is cleared by giving the read-back again. A read-back that addresses a decision but
 * contradicts it (teach-back) is refused too, with the code's reason.
 */
export function acknowledgeAll(
  record: HandoffRecord,
  accountId: string | null,
  binding: Decision[],
  readBack: string,
  nowIso: string,
  fingerprint: Fingerprint,
): AckAllResult {
  if (accountId === null || accountId !== record.toId) return { ok: false, reason: "not_receiver" };
  if (record.protocol !== 1) return { ok: false, reason: "no_protocol" };
  if (binding.length === 0) return { ok: false, reason: "nothing_to_acknowledge" };
  const { problems, contradictions: contradicted } = checkReadBack(readBack, binding, nowIso);
  if (problems.length > 0 || contradicted.length > 0)
    return { ok: false, reason: "read_back", problems, contradictions: contradicted };
  const ids = binding.map((d) => d.id);
  return {
    ok: true,
    record: {
      ...record,
      acknowledged: [...new Set([...record.acknowledged, ...ids])],
      acknowledgedAt: { ...record.acknowledgedAt, ...Object.fromEntries(ids.map((id) => [id, nowIso])) },
      acknowledgedWith: { ...record.acknowledgedWith, ...Object.fromEntries(ids.map((id) => [id, fingerprint])) },
      readBack: readBack.trim(),
    },
  };
}
