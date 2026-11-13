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
  invalid_constraint: "Ask the decision owner to correct the date written in that decision.",
  contradicts_decision: "Change the work item to fit the decision, or ask the decision owner to supersede it.",
  decision_not_acknowledged: "The receiver acknowledges it in the panel; a handoff prepared now takes one read-back for all its decisions.",
};
