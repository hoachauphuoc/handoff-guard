import { kvs } from "@forge/kvs";
import { appendEvent, type AuditEvent } from "./audit";
import { touches } from "./decisions/page";
import { MAX_CANDIDATES } from "./decisions/validate";
import type { Proposal } from "./decisions/types";
import type { HandoffRecord } from "./handoff/types";
import type { Decision } from "./rules/types";

// Only get/set: kvs queries are eventually consistent, and a panel that just saved must read its own write.
// Decisions are stored per project, so a save in one project can not overwrite another's and no single value
// grows with the whole site. The old site-wide key is only read; nothing writes it except "Delete this project's app data".
const LEGACY_DECISIONS = "decisions";
const decisionsKey = (projectKey: string) => `decisions:${projectKey.toLowerCase()}`;
type Stored = { version: number; decisions: Decision[] };
const proposalsKey = (issueId: string) => `proposals:${issueId}`;
const recordKey = (issueId: string) => `handoff:${issueId}`;

async function readDecisions(projectKey: string): Promise<Stored> {
  const own = await kvs.get<Stored>(decisionsKey(projectKey));
  if (own) return own;
  // Not moved yet: read what the old key holds for this project. The first save writes the new key.
  const legacy = (await kvs.get<Decision[]>(LEGACY_DECISIONS)) ?? [];
  return { version: 0, decisions: legacy.filter((d) => touches(d, projectKey)) };
}

export async function getDecisions(projectKey: string): Promise<Decision[]> {
  return (await readDecisions(projectKey)).decisions;
}

/**
 * Read, change, write. The version is read again just before the write and a newer one stops the save with a
 * message to retry. This narrows the race, it does not close it: Forge storage has no atomic compare-and-set
 * here, so two saves within a few milliseconds (or two first saves of a project) can still lose one.
 */
export async function updateDecisions(projectKey: string, change: (current: Decision[]) => Decision[]): Promise<void> {
  const before = await readDecisions(projectKey);
  const next = change(before.decisions).filter((d) => touches(d, projectKey));
  const now = await readDecisions(projectKey);
  if (now.version !== before.version) throw new Error("Someone else changed the decisions a moment ago. Reload the page and try again.");
  await kvs.set(decisionsKey(projectKey), { version: before.version + 1, decisions: next } satisfies Stored);
}

export async function getRecord(issueId: string): Promise<HandoffRecord | null> {
  return (await kvs.get<HandoffRecord>(recordKey(issueId))) ?? null;
}

export const RECORD_CHANGED = "This handoff was changed a moment ago by someone else. Reload the panel and try again.";

/**
 * Saves a change to an existing record. The stored copy is read again first; if its save count differs from
 * the copy the change was made from, the save is refused, so an acknowledgement or a contingency written at
 * nearly the same moment is not silently dropped. As with decisions, this narrows the race, it does not close it.
 */
export async function putRecord(issueId: string, record: HandoffRecord): Promise<void> {
  const stored = await getRecord(issueId);
  if (stored !== null && (stored.rev ?? 0) !== (record.rev ?? 0)) throw new Error(RECORD_CHANGED);
  await kvs.set(recordKey(issueId), { ...record, rev: (record.rev ?? 0) + 1 });
}

/** Starts a new handoff: preparing (again) and a detected reassignment replace whatever was stored, on purpose. */
export async function replaceRecord(issueId: string, record: HandoffRecord): Promise<void> {
  await kvs.set(recordKey(issueId), record);
}

export async function getProposals(issueId: string): Promise<Proposal[]> {
  return (await kvs.get<Proposal[]>(proposalsKey(issueId))) ?? [];
}

// A bounded overwrite, never an append: the set can not grow past the cap however often it is saved.
export async function putProposals(issueId: string, proposals: Proposal[]): Promise<void> {
  await kvs.set(proposalsKey(issueId), proposals.slice(0, MAX_CANDIDATES));
}

const auditKey = (projectKey: string) => `audit:${projectKey.toLowerCase()}`;

export async function getAudit(projectKey: string): Promise<AuditEvent[]> {
  return (await kvs.get<AuditEvent[]>(auditKey(projectKey))) ?? [];
}

// The trail is written after the change it describes. A failed write here must not undo or hide that change,
// so it is reported to the log by name only and the action still succeeds.
export async function addAudit(projectKey: string, event: AuditEvent): Promise<void> {
  try {
    await kvs.set(auditKey(projectKey), appendEvent(await getAudit(projectKey), event));
  } catch (e) {
    console.log(`audit write failed: ${e instanceof Error ? e.name : typeof e}`);
  }
}

// Used only by "Delete this project's app data". The decisions key is emptied, not removed: a removed key
// would make the next read fall back to the old site-wide key and bring the decisions back.
export async function deleteItemData(issueId: string): Promise<void> {
  await Promise.all([kvs.delete(recordKey(issueId)), kvs.delete(proposalsKey(issueId))]);
}

// Delete is the one place that writes the old site-wide key: it takes this project's decisions out of it, so
// nothing of the project is left behind. An old label decision with no project belongs to every project and
// stays. Returns how many were removed.
export async function purgeLegacyDecisions(projectKey: string): Promise<number> {
  const legacy = (await kvs.get<Decision[]>(LEGACY_DECISIONS)) ?? [];
  const p = projectKey.toLowerCase();
  const names = (d: Decision): boolean =>
    d.scope.kind === "project"
      ? d.scope.projectKey.toLowerCase() === p
      : d.scope.kind === "workItem"
        ? d.scope.key.toLowerCase().startsWith(`${p}-`)
        : d.scope.projectKey?.toLowerCase() === p;
  const kept = legacy.filter((d) => !names(d));
  if (kept.length !== legacy.length) await kvs.set(LEGACY_DECISIONS, kept);
  return legacy.length - kept.length;
}

export async function resetAudit(projectKey: string, first: AuditEvent): Promise<void> {
  await kvs.set(auditKey(projectKey), [first]);
}
