import { isIsoDate, norm } from "../rules/checkHandoff";
import type { Decision } from "../rules/types";
import type { Fingerprint } from "./drift";
import type { HandoffRecord } from "./types";

/**
 * One typed answer the receiver owes for one constraint of a binding decision: a date for a date limit, a
 * yes for a label or component that must be kept, a yes for one that must stay off. A decision with no
 * constraint gets a single slot that only records it was read.
 */
export type Slot =
  | { key: string; decisionId: string; title: string; kind: "date"; limit: string; ask: string }
  | { key: string; decisionId: string; title: string; kind: "confirm"; ask: string };

/** Slot key to answer: an ISO date for a date slot, "yes" or "no" for a confirm slot. Typed values only, no free text. */
export type Receipt = Record<string, string>;

export function slotsFor(binding: Decision[]): Slot[] {
  return binding.flatMap((d): Slot[] => {
    const base = { decisionId: d.id, title: d.title };
    if (d.constraints.length === 0) return [{ ...base, key: `${d.id}:0`, kind: "confirm", ask: `I have read "${d.title}".` }];
    return d.constraints.map((c, i): Slot => {
      const key = `${d.id}:${i}`;
      // Exhaustive on purpose: a new kind must get its own slot, never fall through as a component.
      switch (c.kind) {
        case "dueNotAfter":
          return { ...base, key, kind: "date", limit: c.date, ask: `The date I will deliver by (no later than ${c.date}).` };
        case "labelRequired":
          return { ...base, key, kind: "confirm", ask: `I will keep the label "${c.label}" on this work item.` };
        case "componentRequired":
          return { ...base, key, kind: "confirm", ask: `I will keep the component "${c.component}" on this work item.` };
        case "labelForbidden":
          return { ...base, key, kind: "confirm", ask: `I will not add the label "${c.label}" to this work item.` };
        case "componentForbidden":
          return { ...base, key, kind: "confirm", ask: `I will not add the component "${c.component}" to this work item.` };
        case "condition":
          return { ...base, key, kind: "confirm", ask: `I will keep this work item matching the Jira filter: ${c.jql}` };
      }
    });
  });
}

/**
 * Why a receipt is refused, one sentence per slot, in slot order; empty when every slot is answered within
 * its decision. Plain comparison of typed values: nothing here reads free text.
 */
export function checkReceipt(receipt: Receipt, binding: Decision[]): string[] {
  return slotsFor(binding).flatMap((s): string[] => {
    const answer = (receipt[s.key] ?? "").trim();
    if (answer === "") return [`"${s.title}" has no answer yet.`];
    if (s.kind === "date") {
      if (!isIsoDate(answer)) return [`The date for "${s.title}" must be a real calendar date written YYYY-MM-DD.`];
      // An unreadable limit is the decision's fault and already a finding of the rule check; it is not held against the receiver.
      return isIsoDate(s.limit) && answer > s.limit ? [`Your receipt gives ${answer}, later than ${s.limit}, the latest date "${s.title}" allows.`] : [];
    }
    return norm(answer) === "yes" ? [] : [`"${s.title}" is not met: the receipt does not confirm "${s.ask}"`];
  });
}

export type ReceiptResult =
  | { ok: true; record: HandoffRecord }
  | { ok: false; reason: "not_receiver" | "no_protocol" | "nothing_to_acknowledge" }
  | { ok: false; reason: "receipt"; problems: string[] };

/**
 * A second way to acknowledge every binding decision, beside the free-text read-back: typed answers checked
 * slot by slot. Same guards and same effect on the record as `acknowledgeAll`; the receipt replaces an
 * earlier read-back, and only its typed values are stored.
 */
export function acknowledgeWithReceipt(
  record: HandoffRecord,
  accountId: string | null,
  binding: Decision[],
  receipt: Receipt,
  nowIso: string,
  fingerprint: Fingerprint,
): ReceiptResult {
  if (accountId === null || accountId !== record.toId) return { ok: false, reason: "not_receiver" };
  if (record.protocol !== 1) return { ok: false, reason: "no_protocol" };
  if (binding.length === 0) return { ok: false, reason: "nothing_to_acknowledge" };
  const problems = checkReceipt(receipt, binding);
  if (problems.length > 0) return { ok: false, reason: "receipt", problems };
  const ids = binding.map((d) => d.id);
  const slots = slotsFor(binding);
  const { readBack: _replaced, ...rest } = record;
  return {
    ok: true,
    record: {
      ...rest,
      acknowledged: [...new Set([...record.acknowledged, ...ids])],
      acknowledgedAt: { ...record.acknowledgedAt, ...Object.fromEntries(ids.map((id) => [id, nowIso])) },
      acknowledgedWith: { ...record.acknowledgedWith, ...Object.fromEntries(ids.map((id) => [id, fingerprint])) },
      // Only the slots that exist now: an answer for a decision that no longer binds is not kept.
      receipt: Object.fromEntries(slots.map((s) => [s.key, (receipt[s.key] ?? "").trim()])),
    },
  };
}
