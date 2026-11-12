import { kvs } from "@forge/kvs";
import { MAX_CANDIDATES } from "./decisions/validate";
import type { Proposal } from "./decisions/types";
import type { HandoffRecord } from "./handoff/types";
import type { Decision } from "./rules/types";

// Only get/set: kvs queries are eventually consistent, and a panel that just saved must read its own write.
const DECISIONS = "decisions";
const proposalsKey = (issueId: string) => `proposals:${issueId}`;
const recordKey = (issueId: string) => `handoff:${issueId}`;

export async function getDecisions(): Promise<Decision[]> {
  return (await kvs.get<Decision[]>(DECISIONS)) ?? [];
}

export async function putDecisions(decisions: Decision[]): Promise<void> {
  await kvs.set(DECISIONS, decisions);
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
