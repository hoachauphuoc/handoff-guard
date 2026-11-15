import type { Finding } from "../rules/types";

// Panel-only wording. Kept out of src/rules so a hint can never change a finding's message, an action
// quote or the validator message, and never states or promises a verdict.
export const HINTS: Record<Finding["rule"], string> = {
  no_sender: "Prepare the handoff from this panel so it records who is handing over.",
  no_receiver: "Pick a receiver above, then click Prepare handoff.",
  same_person: "Pick a receiver who is not you.",
  empty_description: "Write a description that tells the receiver what the work is and where it stands.",
  no_due_date: "Set a due date on the work item. If the project does not show a Due date field, add it to the work item layout first.",
  invalid_due_date: "Replace the due date with a real calendar date.",
  invalid_constraint: "Ask the person who recorded that decision to correct it; if it is a Jira filter, reload this panel in a moment, as Jira may not have answered in time.",
  contradicts_decision: "Change the work item so it follows that rule, or ask the person who recorded it to replace it.",
  no_contingency: "The sender writes it in the panel: if something goes wrong, then what.",
  contingency_not_if_then: "Rewrite the contingency as: if something happens, then what the receiver should do.",
  receiver_not_assignee: "Assign the work item to the receiver, or prepare the handoff again for the current assignee.",
  decision_not_acknowledged: "The receiver opens this work item and says in their own words what they will do about each rule (one read-back covers them all).",
};
