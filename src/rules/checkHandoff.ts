import type { Constraint, Decision, Finding, Handoff, HandoffResult, Verdict, WorkItem } from "./types";

// People type labels, components and ids by hand; "Legal-Reviewed " and "legal-reviewed" mean the same thing.
const norm = (s: string): string => s.trim().toLowerCase();
const has = (list: string[], value: string): boolean => list.some((x) => norm(x) === norm(value));

// Dates are compared as strings, which is only correct for a real, zero-padded YYYY-MM-DD.
function isIsoDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

function applies(decision: Decision, item: WorkItem): boolean {
  // A superseded decision no longer binds anyone; showing it would block work on a dead rule.
  if (decision.status !== "decided") return false;
  switch (decision.scope.kind) {
    case "project":
      return decision.scope.projectKey === item.projectKey;
    case "label":
      return has(item.labels, decision.scope.label);
    case "workItem":
      return decision.scope.key === item.key;
  }
}

function violation(constraint: Constraint, item: WorkItem): string | null {
  switch (constraint.kind) {
    case "dueNotAfter":
      // An unset or malformed due date is reported once by its own rule, not again per decision.
      return item.dueDate !== null && isIsoDate(item.dueDate) && item.dueDate > constraint.date
        ? `due date ${item.dueDate} is after ${constraint.date}`
        : null;
    case "labelRequired":
      return has(item.labels, constraint.label) ? null : `label "${constraint.label}" is missing`;
    case "componentForbidden":
      return has(item.components, constraint.component)
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

  if (handoff.fromId === null) {
    findings.push({ rule: "no_sender", severity: "info_needed", message: "The handoff has no sender." });
  }
  if (handoff.toId === null) {
    findings.push({ rule: "no_receiver", severity: "block", message: "The handoff has no receiver." });
  } else if (handoff.fromId !== null && norm(handoff.toId) === norm(handoff.fromId)) {
    findings.push({ rule: "same_person", severity: "block", message: "Sender and receiver are the same person." });
  }
  if (item.description.trim() === "") {
    findings.push({ rule: "empty_description", severity: "info_needed", message: "The description is empty." });
  }
  if (item.dueDate === null) {
    findings.push({ rule: "no_due_date", severity: "info_needed", message: "No due date is set." });
  } else if (!isIsoDate(item.dueDate)) {
    findings.push({
      rule: "invalid_due_date",
      severity: "info_needed",
      message: `The due date "${item.dueDate}" is not a valid YYYY-MM-DD date.`,
    });
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
