import { contingencyAdvisory } from "../handoff/ipass";
import type { HandoffRecord } from "../handoff/types";
import type { Bounce } from "./bounce";

/** A handoff that was Clear at its last acknowledgement, with what later happened to it. */
export type AutopsyHandoff = {
  key: string;
  record: HandoffRecord;
  bounce: Bounce | null;
  /** The work item changed, in a field a decision reads, after the receiver acknowledged. */
  drifted: boolean;
  /** Decisions that bound the work item at that time. */
  bindingCount: number;
};

/** The optional rules a project administrator can switch on. Each matches one cause below. */
export type ProjectRule = "requireContingency" | "requireIfThen" | "requireReceiverAssigned";

export type CauseId = "no_contingency" | "contingency_not_if_then" | "changed_after_read_back" | "no_read_back" | "no_binding_decision";

type Cause = { id: CauseId; text: string; rule: ProjectRule | null; holds: (h: AutopsyHandoff) => boolean };

// A fixed list, each read from the stored record alone, so the same handoff always gets the same answer and
// nothing here is a guess about why people did what they did.
export const CAUSES: Cause[] = [
  { id: "no_contingency", text: "The sender wrote no contingency", rule: "requireContingency", holds: (h) => (h.record.contingency ?? "").trim() === "" },
  {
    id: "contingency_not_if_then",
    text: 'The contingency was not written as "if … then …"',
    rule: "requireIfThen",
    holds: (h) => (h.record.contingency ?? "").trim() !== "" && contingencyAdvisory(h.record.contingency ?? "") !== null,
  },
  { id: "changed_after_read_back", text: "The work item changed after the receiver's read-back", rule: null, holds: (h) => h.drifted },
  { id: "no_read_back", text: "Acknowledged one by one, with no read-back", rule: null, holds: (h) => h.record.protocol !== 1 },
  { id: "no_binding_decision", text: "No recorded decision bound the work item", rule: null, holds: (h) => h.bindingCount === 0 },
];

export type CauseCount = { id: CauseId; text: string; rule: ProjectRule | null; bouncedWith: number; othersWith: number };

export type Autopsy = {
  /** Handoffs that were Clear at their last acknowledgement. */
  total: number;
  bounced: { key: string; kind: Bounce["kind"]; at: string }[];
  /** Per cause: how many bounced handoffs had it, and how many of the others did. Both, so a count is not read as a proof. */
  causes: CauseCount[];
};

export function autopsy(handoffs: AutopsyHandoff[]): Autopsy {
  const bounced = handoffs.filter((h) => h.bounce !== null);
  const others = handoffs.filter((h) => h.bounce === null);
  return {
    total: handoffs.length,
    bounced: bounced.map((h) => ({ key: h.key, kind: h.bounce!.kind, at: h.bounce!.at })),
    causes: CAUSES.map((c) => ({ id: c.id, text: c.text, rule: c.rule, bouncedWith: bounced.filter(c.holds).length, othersWith: others.filter(c.holds).length })),
  };
}
