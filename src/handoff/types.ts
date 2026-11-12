import type { HandoffResult } from "../rules/types";

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
  record: HandoffRecord | null;
  result: HandoffResult | null;
  viewerId: string | null;
  isReceiver: boolean;
  decisionCount: number;
};
