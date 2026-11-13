import type { Constraint, Decision, Finding, Handoff, HandoffResult, Verdict, WorkItem } from "./types";

// People type labels, components and ids by hand; "Legal-Reviewed " and "legal-reviewed" mean the same thing.
export const norm = (s: string): string => s.trim().toLowerCase();
export const has = (list: string[], value: string): boolean => list.some((x) => norm(x) === norm(value));

// Dates are compared as strings, which is only correct for a real, zero-padded YYYY-MM-DD.
export function isIsoDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

function applies(decision: Decision, item: WorkItem): boolean {
  // A superseded decision no longer binds anyone; showing it would block work on a dead rule.
  if (decision.status !== "decided") return false;
  switch (decision.scope.kind) {
    case "project":
      return norm(decision.scope.projectKey) === norm(item.projectKey);
    case "label":
      return has(item.labels, decision.scope.label) && (decision.scope.projectKey === undefined || norm(decision.scope.projectKey) === norm(item.projectKey));
    case "workItem":
      return norm(decision.scope.key) === norm(item.key);
  }
}

type Problem = { rule: "contradicts_decision" | "invalid_constraint"; message: string };

function violation(constraint: Constraint, item: WorkItem, decision: Decision): Problem | null {
  switch (constraint.kind) {
    case "dueNotAfter":
      // A bad limit cannot be compared; report it as missing information instead of guessing a contradiction.
      if (!isIsoDate(constraint.date)) {
        return {
          rule: "invalid_constraint",
          message: `"${decision.title}" has a date limit "${constraint.date}" that is not a valid YYYY-MM-DD date.`,
        };
      }
      // An unset or malformed due date is reported once by its own rule, not again per decision.
      return item.dueDate !== null && isIsoDate(item.dueDate) && item.dueDate > constraint.date
        ? contradiction(decision, `due date ${item.dueDate} is after ${constraint.date}`)
        : null;
    case "labelRequired":
      return has(item.labels, constraint.label)
        ? null
        : contradiction(decision, `label "${constraint.label}" is missing`);
    case "labelForbidden":
      return has(item.labels, constraint.label) ? contradiction(decision, `label "${constraint.label}" is not allowed`) : null;
    case "componentRequired":
      return has(item.components, constraint.component)
        ? null
        : contradiction(decision, `component "${constraint.component}" is missing`);
    case "componentForbidden":
      return has(item.components, constraint.component)
        ? contradiction(decision, `component "${constraint.component}" is not allowed`)
        : null;
  }
}

const contradiction = (decision: Decision, reason: string): Problem => ({
  rule: "contradicts_decision",
  message: `Contradicts "${decision.title}": ${reason}.`,
});

export function bindingDecisions(decisions: Decision[], item: WorkItem): Decision[] {
  return decisions.filter((d) => applies(d, item));
}

function decisionFindings(decision: Decision, item: WorkItem): Finding[] {
  const findings: Finding[] = [];
  for (const c of decision.constraints) {
    const problem = violation(c, item, decision);
    if (!problem) continue;
    findings.push({
      rule: problem.rule,
      severity: problem.rule === "invalid_constraint" ? "info_needed" : "block",
      message: problem.message,
      decisionId: decision.id,
    });
  }
  return findings;
}

/**
 * What the work item itself gets wrong against its binding decisions, with no handoff involved. Used to
 * gate a transition that is not a handoff; it never produces a verdict.
 */
export function checkItem(item: WorkItem, decisions: Decision[]): Finding[] {
  return bindingDecisions(decisions, item).flatMap((d) => decisionFindings(d, item));
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
    findings.push(...decisionFindings(decision, item));
    // A stale acknowledgement counts as not given, with the reason. It is the same finding and the same
    // severity, so no new verdict appears and `clear` still never carries a finding.
    const stale = handoff.stale?.[decision.id];
    if (!handoff.acknowledged.includes(decision.id) || stale !== undefined) {
      findings.push({
        rule: "decision_not_acknowledged",
        severity: "info_needed",
        message:
          stale !== undefined
            ? `The receiver acknowledged "${decision.title}", but ${stale}; it needs to be acknowledged again.`
            : `The receiver has not acknowledged "${decision.title}".`,
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
