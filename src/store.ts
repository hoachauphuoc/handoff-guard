import { Filter, FilterConditions, kvs, WhereConditions } from "@forge/kvs";
import { appendEvent, type AuditEvent } from "./audit";
import { touches } from "./decisions/page";
import { MAX_CANDIDATES } from "./decisions/validate";
import { MAX_CONDITION_DRAFTS, type ConditionDraft } from "./decisions/conditions";
import type { Proposal } from "./decisions/types";
import type { HandoffRecord } from "./handoff/types";
import { NO_RULES, type Decision, type ProjectRules } from "./rules/types";

// Reads are gets, not queries (the one exception is storedItemIds below): kvs queries are eventually consistent, and a panel that just saved must read its own write.
// Decisions are stored per project, so a save in one project can not overwrite another's and no single value
// grows with the whole site. The old site-wide key is only read; nothing writes it except "Delete this project's app data".
const LEGACY_DECISIONS = "decisions";
const decisionsKey = (projectKey: string) => `decisions:${projectKey.toLowerCase()}`;
type Stored = { version: number; decisions: Decision[] };
const proposalsKey = (issueId: string) => `proposals:${issueId}`;
const recordKey = (issueId: string) => `handoff:${issueId}`;

// A plain key-value write has no condition, but a transaction may hold a condition on a custom entity. Each
// versioned value (a handoff record, a project's decisions) has a "revision" entity holding its save count; the
// value and the next count are written in one transaction that holds only while the count is still the one read.
// Two saves made from the same copy can then not both land: the second is refused, never silently dropped.
const REVISION = "revision";
type Revision = { rev: number };
const revisionKey = (key: string) => `rev:${key}`;

async function storedRevision(key: string): Promise<number | null> {
  return (await kvs.entity<Revision>(REVISION).get(revisionKey(key)))?.rev ?? null;
}

/**
 * Writes `value` with save count `next`, only if the stored count is still `expected` (null: none stored yet, as
 * for a value saved before revisions existed). Returns false when someone else saved in between.
 */
async function writeIfUnchanged(key: string, value: unknown, expected: number | null, next: number): Promise<boolean> {
  const unchanged = new Filter<Revision>().and("rev", expected === null ? FilterConditions.notExists() : FilterConditions.equalTo(expected));
  try {
    await kvs.transact().set(key, value).set(revisionKey(key), { rev: next }, { entityName: REVISION, conditions: unchanged }).execute();
    return true;
  } catch (e) {
    // A failed condition is told apart by reading the count again, not by the error's wording.
    if ((await storedRevision(key)) !== expected) return false;
    throw e;
  }
}

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

export const DECISIONS_CHANGED = "Someone else changed the decisions a moment ago. Reload the page and try again.";

/** Read, change, write; the write holds only if nobody saved this project's decisions in between. */
export async function updateDecisions(projectKey: string, change: (current: Decision[]) => Decision[]): Promise<void> {
  const key = decisionsKey(projectKey);
  const revision = await storedRevision(key);
  const before = await readDecisions(projectKey);
  if (revision !== null && revision !== before.version) throw new Error(DECISIONS_CHANGED);
  const next = change(before.decisions).filter((d) => touches(d, projectKey));
  const version = before.version + 1;
  if (!(await writeIfUnchanged(key, { version, decisions: next } satisfies Stored, revision, version))) throw new Error(DECISIONS_CHANGED);
}

export async function getRecord(issueId: string): Promise<HandoffRecord | null> {
  return (await kvs.get<HandoffRecord>(recordKey(issueId))) ?? null;
}

export const RECORD_CHANGED = "This handoff was changed a moment ago by someone else. Reload the panel and try again.";

/**
 * Saves a change to an existing record, made from the copy whose save count is `record.rev`. If anyone saved
 * the record since that copy was read, the save is refused, so an acknowledgement or a contingency written at
 * the same moment is never silently dropped.
 */
export async function putRecord(issueId: string, record: HandoffRecord): Promise<void> {
  const key = recordKey(issueId);
  const base = record.rev ?? 0;
  const revision = await storedRevision(key);
  const stored = await getRecord(issueId);
  if ((stored !== null && (stored.rev ?? 0) !== base) || (revision !== null && revision !== base)) throw new Error(RECORD_CHANGED);
  if (!(await writeIfUnchanged(key, { ...record, rev: base + 1 }, revision, base + 1))) throw new Error(RECORD_CHANGED);
}

/** Starts a new handoff: preparing (again) and a detected reassignment replace whatever was stored, on purpose. */
export async function replaceRecord(issueId: string, record: HandoffRecord): Promise<void> {
  // The save count keeps rising across a replacement, so a change made from the old record can no longer match
  // and overwrite the new receiver's record. A replacement wins over a change saved in the same instant, so it
  // reads again and retries instead of refusing.
  const key = recordKey(issueId);
  for (let attempt = 0; attempt < 3; attempt++) {
    const revision = await storedRevision(key);
    const next = Math.max(revision ?? 0, (await getRecord(issueId))?.rev ?? 0) + 1;
    if (await writeIfUnchanged(key, { ...record, rev: next }, revision, next)) return;
  }
  throw new Error(RECORD_CHANGED);
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

const ITEM_PREFIXES = ["handoff:", "proposals:", "receipt-draft:"];
export const STORED_ITEM_CAP = 2000;

/**
 * Every work item id the app holds a handoff, proposals or a read-back draft for, on the whole site. The one
 * query in this file: export and delete run long after the writes they list, so an eventually consistent
 * list is enough. Past the cap the list is cut and says so.
 */
export async function storedItemIds(): Promise<{ ids: string[]; capped: boolean }> {
  const ids = new Set<string>();
  for (const prefix of ITEM_PREFIXES) {
    let cursor: string | undefined;
    do {
      const query = kvs.query().where("key", WhereConditions.beginsWith(prefix)).limit(100);
      const page = await (cursor ? query.cursor(cursor) : query).getMany<unknown>();
      for (const r of page.results) ids.add(r.key.slice(prefix.length));
      if (ids.size > STORED_ITEM_CAP) return { ids: [...ids].slice(0, STORED_ITEM_CAP), capped: true };
      cursor = page.nextCursor;
    } while (cursor);
  }
  return { ids: [...ids], capped: false };
}

// Used only by "Delete this project's app data". The decisions key is emptied, not removed: a removed key
// would make the next read fall back to the old site-wide key and bring the decisions back.
export async function deleteItemData(issueId: string): Promise<void> {
  await Promise.all([
    kvs.delete(recordKey(issueId)),
    kvs.entity(REVISION).delete(revisionKey(recordKey(issueId))),
    kvs.delete(proposalsKey(issueId)),
    kvs.delete(draftKey(issueId)),
  ]);
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

const rulesKey = (projectKey: string) => `settings:${projectKey.toLowerCase()}`;

/** The optional rules a project administrator switched on. Nothing stored means none. */
export async function getRules(projectKey: string): Promise<ProjectRules> {
  return { ...NO_RULES, ...((await kvs.get<Partial<ProjectRules>>(rulesKey(projectKey))) ?? {}) };
}

/**
 * Changes one rule. The stored rules are read once, just before the write, so a rule another administrator
 * switched earlier is kept. There is no version check like the one for decisions: two switches within
 * milliseconds can still lose one.
 */
export async function setRule(projectKey: string, rule: keyof ProjectRules, on: boolean): Promise<ProjectRules> {
  const next = { ...(await getRules(projectKey)), [rule]: on };
  await kvs.set(rulesKey(projectKey), next);
  return next;
}

// Used only by "Delete this project's app data": no stored rules means none are switched on.
export async function deleteRules(projectKey: string): Promise<void> {
  await kvs.delete(rulesKey(projectKey));
}

const conditionDraftsKey =(projectKey: string) => `condition-drafts:${projectKey.toLowerCase()}`;

/** Conditions Rovo drafted for an administrator. A draft binds nothing until a person confirms it. */
export async function getConditionDrafts(projectKey: string): Promise<ConditionDraft[]> {
  return (await kvs.get<ConditionDraft[]>(conditionDraftsKey(projectKey))) ?? [];
}

export async function putConditionDrafts(projectKey: string, drafts: ConditionDraft[]): Promise<void> {
  await kvs.set(conditionDraftsKey(projectKey), drafts.slice(0, MAX_CONDITION_DRAFTS));
}

export async function deleteConditionDrafts(projectKey: string): Promise<void> {
  await kvs.delete(conditionDraftsKey(projectKey));
}

const draftKey = (issueId: string) => `receipt-draft:${issueId}`;

/** Typed answers an agent drafted for the receiver. Unsigned: it acknowledges nothing until the receiver signs it. */
export async function getDraft(issueId: string): Promise<Record<string, string> | null> {
  return (await kvs.get<Record<string, string>>(draftKey(issueId))) ?? null;
}

export async function putDraft(issueId: string, draft: Record<string, string>): Promise<void> {
  await kvs.set(draftKey(issueId), draft);
}

export async function deleteDraft(issueId: string): Promise<void> {
  await kvs.delete(draftKey(issueId));
}
