import type { Constraint, Decision, Finding, Handoff, HandoffResult, Verdict, WorkItem } from "./types";

function applies(decision: Decision, item: WorkItem): boolean {
  // A superseded decision no longer binds anyone; showing it would block work on a dead rule.
  if (decision.status !== "decided") return false;
  switch (decision.scope.kind) {
    case "project":
      return decision.scope.projectKey === item.projectKey;
    case "label":
      return item.labels.includes(decision.scope.label);
    case "workItem":
      return decision.scope.key === item.key;
  }
}

function violation(constraint: Constraint, item: WorkItem): string | null {
  switch (constraint.kind) {
    case "dueNotAfter":
      // An unset due date is reported once by the no_due_date rule, not again per decision.
      return item.dueDate !== null && item.dueDate > constraint.date
        ? `due date ${item.dueDate} is after ${constraint.date}`
        : null;
    case "labelRequired":
      return item.labels.includes(constraint.label) ? null : `label "${constraint.label}" is missing`;
    case "componentForbidden":
      return item.components.includes(constraint.component)
        ? `component "${constraint.component}" is not allowed`
        : null;
  }
}

export function bindingDecisions(decisions: Decision[], item: WorkItem): Decision[] {
  return decisions.filter((d) => applies(d, item));
}

export function checkHandoff(handoff: Handoff, decisions: Decision[]): HandoffResult {
  const { item } = handoff;
  const findings: Finding[] = [];

  if (handoff.toId === null) {
    findings.push({ rule: "no_receiver", severity: "block", message: "The handoff has no receiver." });
  } else if (handoff.toId === handoff.fromId) {
    findings.push({ rule: "same_person", severity: "block", message: "Sender and receiver are the same person." });
  }
  if (item.description.trim() === "") {
    findings.push({ rule: "empty_description", severity: "info_needed", message: "The description is empty." });
  }
  if (item.dueDate === null) {
    findings.push({ rule: "no_due_date", severity: "info_needed", message: "No due date is set." });
  }

  const binding = bindingDecisions(decisions, item);
  for (const decision of binding) {
    const broken = decision.constraints.map((c) => violation(c, item)).filter((v): v is string => v !== null);
    for (const reason of broken) {
      findings.push({
        rule: "contradicts_decision",
        severity: "block",
        message: `Contradicts "${decision.title}": ${reason}.`,
        decisionId: decision.id,
      });
    }
    if (!handoff.acknowledged.includes(decision.id)) {
      findings.push({
        rule: "decision_not_acknowledged",
        severity: "info_needed",
        message: `The receiver has not acknowledged "${decision.title}".`,
        decisionId: decision.id,
      });
    }
  }

  // The verdict is derived from the findings alone, so a `clear` result can never carry one.
  const verdict: Verdict = findings.some((f) => f.severity === "block")
    ? "blocked"
    : findings.length > 0
      ? "needs_info"
      : "clear";
  return { verdict, findings, binding };
}
