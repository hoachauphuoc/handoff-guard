// A short record of who changed what, per project. Work records only: an action, a person, a time and the id
// or key it was about. No text anyone typed is kept here, so a read-back or a title never lands in the trail.
export type AuditAction =
  | "decision_added"
  | "decision_confirmed"
  | "decision_superseded"
  | "samples_loaded"
  | "samples_removed"
  | "handoff_prepared"
  | "handoff_acknowledged"
  | "readback_refused"
  | "data_deleted";

export type AuditEvent = { at: string; who: string; action: AuditAction; ref: string };

export const AUDIT_CAP = 300;

/** Newest first, cut at the cap, so the stored value cannot grow without bound. */
export function appendEvent(events: AuditEvent[], event: AuditEvent): AuditEvent[] {
  return [event, ...events].slice(0, AUDIT_CAP);
}

export const AUDIT_TEXT: Record<AuditAction, string> = {
  decision_added: "added a decision",
  decision_confirmed: "confirmed a proposed decision",
  decision_superseded: "superseded a decision",
  samples_loaded: "loaded the sample decisions",
  samples_removed: "removed the sample decisions",
  handoff_prepared: "prepared a handoff",
  handoff_acknowledged: "acknowledged with a read-back",
  readback_refused: "had a read-back refused",
  data_deleted: "deleted this project's app data",
};

export type MonthCounts = { month: string; prepared: number; acknowledged: number; refused: number; decisions: number };

/** Counts per calendar month (UTC), newest month first, from the events that are still in the trail. */
export function monthCounts(events: AuditEvent[]): MonthCounts[] {
  const by = new Map<string, MonthCounts>();
  for (const e of events) {
    const month = e.at.slice(0, 7);
    const row = by.get(month) ?? { month, prepared: 0, acknowledged: 0, refused: 0, decisions: 0 };
    if (e.action === "handoff_prepared") row.prepared += 1;
    else if (e.action === "handoff_acknowledged") row.acknowledged += 1;
    else if (e.action === "readback_refused") row.refused += 1;
    else if (e.action === "decision_added" || e.action === "decision_confirmed") row.decisions += 1;
    by.set(month, row);
  }
  return [...by.values()].sort((a, b) => (a.month < b.month ? 1 : -1));
}
