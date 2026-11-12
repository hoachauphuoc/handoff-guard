import type { Advisory } from "../rules/advisories";
import type { Fingerprint } from "./drift";
import type { Proposal } from "../decisions/types";
import type { Finding, HandoffResult } from "../rules/types";

/** A prepared handoff, stored per work item. Sender and receiver are Atlassian account ids. */
export type HandoffRecord = {
  fromId: string;
  toId: string;
  acknowledged: string[];
  preparedAt: string;
  /** Decision id -> ISO time the receiver acknowledged it. */
  acknowledgedAt: Record<string, string>;
  /** How the record came about. Absent on records saved before reassignment detection: those were manual. */
  origin?: "manual" | "reassignment";
  /** What the work item looked like when each decision was acknowledged. Absent on older acknowledgements. */
  acknowledgedWith?: Record<string, Fingerprint>;
};

export type ValidatorResponse = { result: boolean; errorMessage?: string };

export type PanelState = {
  issueKey: string;
  record: HandoffRecord | null;
  result: HandoffResult | null;
  viewerId: string | null;
  isReceiver: boolean;
  decisionCount: number;
  /** Findings about the work item itself from a made-up handoff. Deliberately not a verdict. */
  practiceFindings: Finding[];
  /** Unconfirmed decisions found by Rovo for this work item. They bind nothing. */
  proposals: Proposal[];
  /** Plain-text edits that would stop the item contradicting its binding decisions. Advice only. */
  fixes: string[];
  /** Facts beside the verdict, never inside it. */
  advisories: Advisory[];
  /** Open work items of the project each proposal would contradict; null when they could not be counted. */
  /** Per proposal: the confirmed decisions it would make redundant or answer differently. A person may retire them while confirming. */
  supersedes: Record<string, { id: string; title: string }[]>;
  /** Decision ids whose acknowledgement went stale because a field the decision reads changed. */
  stale: string[];
  /** Per acknowledged decision: everything that changed on the work item since it was acknowledged. */
  drift: Record<string, string[]>;
  /** Acknowledged decisions with no stored baseline, so changes since then cannot be told. */
  untracked: string[];
  proposalImpact: Record<string, { count: number; capped: boolean }> | null;
};
