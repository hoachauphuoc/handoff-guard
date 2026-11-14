import { kvs } from "@forge/kvs";
import { touches } from "./decisions/page";
import { MAX_CANDIDATES } from "./decisions/validate";
import type { Proposal } from "./decisions/types";
import type { HandoffRecord } from "./handoff/types";
import type { Decision } from "./rules/types";

// Only get/set: kvs queries are eventually consistent, and a panel that just saved must read its own write.
// Decisions are stored per project, so a save in one project can not overwrite another's and no single value
// grows with the whole site. The old site-wide key is only read, never written or deleted: it stays as the
// backup until the owner confirms the per-project keys work.
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
 * Read, change, write. The version is read again just before the write and a newer one stops the save, so two
 * people saving at nearly the same moment cannot silently drop one change. Forge storage has no atomic
 * compare-and-set here, so a window of a few milliseconds remains; the message tells the person to retry.
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

export async function putRecord(issueId: string, record: HandoffRecord): Promise<void> {
  await kvs.set(recordKey(issueId), record);
}

export async function getProposals(issueId: string): Promise<Proposal[]> {
  return (await kvs.get<Proposal[]>(proposalsKey(issueId))) ?? [];
}

// A bounded overwrite, never an append: the set can not grow past the cap however often it is saved.
export async function putProposals(issueId: string, proposals: Proposal[]): Promise<void> {
  await kvs.set(proposalsKey(issueId), proposals.slice(0, MAX_CANDIDATES));
}
