import type { DecisionScope } from "../rules/types";

/** Plain words for who a decision would apply to, shown before a person confirms it. */
export function reachText(scope: DecisionScope): string {
  switch (scope.kind) {
    case "project":
      return `Applies to: every work item in project ${scope.projectKey}`;
    case "label":
      return `Applies to: every work item with label ${scope.label}`;
    case "workItem":
      return "Applies to: this work item only";
  }
}
