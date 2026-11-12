import { norm } from "../rules/checkHandoff";
import type { HandoffRecord } from "./types";

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const id = (v: unknown): string | null => (typeof v === "string" && v.trim() !== "" ? v : null);

/**
 * Reads a Jira changelog for a change of assignee and returns the handoff it implies: the old assignee
 * hands to the new one. Null when there is nothing to record: no assignee change, an assignee removed or
 * newly set (no one handed anything), the same person, or a stored handoff that already names this
 * receiver, whose acknowledgements must survive. A different receiver replaces the record, as preparing
 * a handoff does, so acknowledgements are never carried to a new person. Pure: the clock is passed in.
 */
export function detectReassignment(items: unknown, existing: HandoffRecord | null, nowIso: string): HandoffRecord | null {
  if (!Array.isArray(items)) return null;
  const changes = items.filter((i) => isObj(i) && (i.fieldId === "assignee" || i.field === "assignee"));
  const last = changes[changes.length - 1];
  if (!isObj(last)) return null;
  const from = id(last.from);
  const to = id(last.to);
  if (from === null || to === null || norm(from) === norm(to)) return null;
  if (existing !== null && norm(existing.toId) === norm(to)) return null;
  return { fromId: from, toId: to, acknowledged: [], preparedAt: nowIso, acknowledgedAt: {}, origin: "reassignment" };
}
