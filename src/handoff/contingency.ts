import { contingencyTooLong } from "./ipass";
import type { HandoffRecord } from "./types";

export type ContingencyResult = { ok: true; record: HandoffRecord } | { ok: false; reason: "not_sender" | "too_long" };

/** Only the sender writes it. Empty text clears it. The length limit is enforced here, where it is stored. */
export function withContingency(record: HandoffRecord, accountId: string | null, text: string): ContingencyResult {
  if (accountId === null || accountId !== record.fromId) return { ok: false, reason: "not_sender" };
  if (contingencyTooLong(text)) return { ok: false, reason: "too_long" };
  const { contingency: _old, ...rest } = record;
  const t = text.trim();
  return { ok: true, record: t === "" ? rest : { ...rest, contingency: t } };
}
