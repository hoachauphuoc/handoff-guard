import type { Advisory } from "../rules/advisories";
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
  /** Facts beside the verdict, never inside it. Empty without a prepared handoff. */
  advisories: Advisory[];
};
