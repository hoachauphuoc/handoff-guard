import type { Constraint, DecisionScope } from "../rules/types";

/** Plain words for who a decision would apply to, shown before a person confirms it. */
export function reachText(scope: DecisionScope): string {
  switch (scope.kind) {
    case "project":
      return `Applies to: every work item in project ${scope.projectKey}`;
    case "label":
      return `Applies to: every work item with label ${scope.label}${scope.projectKey === undefined ? "" : ` in project ${scope.projectKey}`}`;
    case "workItem":
      return "Applies to: this work item only";
  }
}

/** Plain words for one rule a decision sets. */
export function constraintText(c: Constraint): string {
  switch (c.kind) {
    case "dueNotAfter":
      return `The due date must be on or before ${c.date}.`;
    case "labelRequired":
      return `The label "${c.label}" is required.`;
    case "labelForbidden":
      return `The label "${c.label}" is not allowed.`;
    case "componentRequired":
      return `The component "${c.component}" is required.`;
    case "componentForbidden":
      return `The component "${c.component}" is not allowed.`;
  }
}
