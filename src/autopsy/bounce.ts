import type { HandoffRecord } from "../handoff/types";

export type Bounce = { kind: "returned_to_sender" | "reopened"; at: string };

/** One entry of a Jira changelog, reduced to what a bounce is read from. */
export type Change = { created: string; items: { field: string; from: string | null; to: string | null }[] };

export const BOUNCE_WINDOW_DAYS = 7;

/** Status ids of the Done category, from the body of GET /project/{key}/statuses. */
export function doneStatusIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const ids = raw.flatMap((type) => {
    const statuses = (type as { statuses?: unknown } | null)?.statuses;
    if (!Array.isArray(statuses)) return [];
    return statuses.flatMap((s) => {
      const st = s as { id?: unknown; statusCategory?: { key?: unknown } };
      return typeof st?.id === "string" && st.statusCategory?.key === "done" ? [st.id] : [];
    });
  });
  return [...new Set(ids)];
}

const DAY_MS = 24 * 60 * 60 * 1000;
const same = (a: string | null, b: string): boolean => a !== null && a.trim().toLowerCase() === b.trim().toLowerCase();

/** When the receiver last acknowledged, or null when nothing was acknowledged. */
export function lastAcknowledgedAt(record: HandoffRecord): string | null {
  const times = Object.values(record.acknowledgedAt);
  return times.length === 0 ? null : times.reduce((a, b) => (Date.parse(a) >= Date.parse(b) ? a : b));
}

/**
 * Reads the untyped changelog Jira returns, either a changelog page (`values`) or the one expanded on a work
 * item (`histories`). Anything that is not an entry with a time and items is dropped.
 */
export function toChanges(raw: unknown): Change[] {
  const body = raw as { values?: unknown; histories?: unknown } | null;
  const values = body?.values ?? body?.histories;
  if (!Array.isArray(values)) return [];
  return values.flatMap((v) => {
    const e = v as { created?: unknown; items?: unknown };
    if (typeof e?.created !== "string" || !Array.isArray(e.items)) return [];
    const items = e.items.flatMap((i) => {
      const it = i as { field?: unknown; fieldId?: unknown; from?: unknown; to?: unknown };
      const field = typeof it?.fieldId === "string" ? it.fieldId : typeof it?.field === "string" ? it.field : null;
      return field === null ? [] : [{ field, from: typeof it.from === "string" ? it.from : null, to: typeof it.to === "string" ? it.to : null }];
    });
    return [{ created: e.created, items }];
  });
}

/**
 * A handoff bounced when, within the window after the receiver's last acknowledgement, the work item went
 * back to the sender or left a Done status. Earlier changes are part of the handoff itself, and later ones
 * are too far away to lay at its door. The earliest such change is returned.
 */
export function bounceOf(changes: Change[], record: HandoffRecord, doneStatusIds: string[], windowDays = BOUNCE_WINDOW_DAYS): Bounce | null {
  const ack = lastAcknowledgedAt(record);
  if (ack === null) return null;
  const from = Date.parse(ack);
  const until = from + windowDays * DAY_MS;
  const hits = changes.flatMap((c): Bounce[] => {
    const at = Date.parse(c.created);
    if (!(at > from && at <= until)) return [];
    return c.items.flatMap((i): Bounce[] => {
      if (i.field === "assignee" && same(i.to, record.fromId) && !same(i.from, record.fromId)) return [{ kind: "returned_to_sender", at: c.created }];
      if (i.field === "status" && i.from !== null && i.to !== null && doneStatusIds.includes(i.from) && !doneStatusIds.includes(i.to)) return [{ kind: "reopened", at: c.created }];
      return [];
    });
  });
  return hits.sort((a, b) => Date.parse(a.at) - Date.parse(b.at))[0] ?? null;
}
