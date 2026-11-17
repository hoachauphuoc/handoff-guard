import { HINTS } from "../guide/hints";
import { CONTINGENCY_MIN, isIfThen, norm } from "../rules/checkHandoff";
import { changeText, type Change } from "../rules/feasible";
import type { Constraint, Decision, Finding, HandoffResult, Verdict } from "../rules/types";
import { datesIn } from "./teachback";

/*
 * The I-PASS structure over the rule check, as plain functions. Nothing here decides a verdict: severity is
 * a label for it, the action list is read from its findings, and the read-back and contingency checks look
 * only at text a person wrote. No clock, no Forge.
 */

export type Severity = "Stable" | "Watcher" | "Unstable";

const SEVERITY: Record<Verdict, Severity> = { clear: "Stable", needs_info: "Watcher", blocked: "Unstable" };

export const severityOf = (verdict: Verdict): Severity => SEVERITY[verdict];
export const severityText = (verdict: Verdict): string => `I-PASS: ${SEVERITY[verdict]}`;

export type Owner = "sender" | "receiver" | "decision owner";
export type Action = { owner: Owner; ownerId: string | null; text: string; decisionId?: string };

const OWNER: Record<Finding["rule"], Owner> = {
  no_sender: "sender",
  no_receiver: "sender",
  same_person: "sender",
  empty_description: "sender",
  no_due_date: "sender",
  invalid_due_date: "sender",
  contradicts_decision: "sender",
  invalid_constraint: "decision owner",
  decision_not_acknowledged: "receiver",
  no_contingency: "sender",
  contingency_not_if_then: "sender",
  receiver_not_assignee: "sender",
};
const WITH_HINT: Finding["rule"][] = ["empty_description", "no_due_date", "invalid_due_date"];

/**
 * One action per finding, blocking ones first and otherwise in the rule's order. Read from the findings
 * only, so it cannot disagree with the verdict: no findings, no actions, and that is exactly Clear.
 */
export function actionList(result: HandoffResult, people: { fromId: string; toId: string }, fixes: Change[]): Action[] {
  const actions = result.findings.map((f): { severity: Finding["severity"]; action: Action } => {
    const decision = result.binding.find((d) => d.id === f.decisionId);
    const owner = OWNER[f.rule];
    const advice = WITH_HINT.includes(f.rule)
      ? [HINTS[f.rule]]
      : f.rule === "contradicts_decision" && decision
        ? fixes.filter((c) => c.because.includes(decision.title)).map(changeText)
        : [];
    const ownerId = owner === "sender" ? people.fromId : owner === "receiver" ? people.toId : (decision?.confirmedBy ?? null);
    return {
      severity: f.severity,
      action: { owner, ownerId, text: [f.message, ...advice].join(" "), ...(f.decisionId ? { decisionId: f.decisionId } : {}) },
    };
  });
  return [...actions.filter((a) => a.severity === "block"), ...actions.filter((a) => a.severity !== "block")].map((a) => a.action);
}

export { CONTINGENCY_MIN };
export const CONTINGENCY_MAX = 300;

/** Length is a hard limit on what is stored; the if-then form is only a hint to the sender. */
export const contingencyTooLong = (text: string): boolean => text.trim().length > CONTINGENCY_MAX;

/** Advice for the person reading a stored contingency. Never a finding, so it cannot change a verdict. */
export function contingencyAdvisory(text: string): string | null {
  const t = text.trim();
  if (isIfThen(t)) return null;
  return `The contingency is not written as "if … then …" (at least ${CONTINGENCY_MIN} characters), so the receiver may not read it as a plan.`;
}

export const READ_BACK_MIN = 20;
/** Room for about seven decisions at roughly 80 characters each. */
export const READ_BACK_MAX = 600;

// Exhaustive on purpose: a new kind must name its own value, never fall through as a component.
const valueOf = (c: Constraint): { text: string; value: string } => {
  switch (c.kind) {
    case "dueNotAfter":
      return { text: `date ${c.date}`, value: c.date };
    case "labelRequired":
    case "labelForbidden":
      return { text: `label ${c.label}`, value: c.label };
    case "componentRequired":
    case "componentForbidden":
      return { text: `component ${c.component}`, value: c.component };
    case "condition":
      return { text: `condition ${c.jql}`, value: c.jql };
  }
};

const escape = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// A value counts only as a whole word, so the label "ui" is not found inside "build".
const mentions = (text: string, value: string): boolean => new RegExp(`(?<![a-z0-9])${escape(norm(value))}(?![a-z0-9])`).test(norm(text));

// A receiver names their own date ("I'll ship by 15 December 2026"), not the limit itself, so any date the
// teach-back reads addresses a date limit; one later than the limit is then refused as a contradiction.
const addresses = (text: string, c: Constraint, fromIso: string): boolean =>
  mentions(text, valueOf(c).value) || (c.kind === "dueNotAfter" && datesIn(text, fromIso, Number(c.date.slice(0, 4))).length > 0);

/**
 * The binding decisions the read-back does not address: it contains neither the decision's title nor one of
 * its constraint values (date, label or component), compared the way the rules compare, nor, for a date limit,
 * any date at all. A decision with no constraints is addressed by any read-back of the minimum length.
 * `fromIso` is the time of the read-back, for a date written without a year. This checks that each decision
 * is addressed, not that it was understood.
 */
export function unaddressed(readBack: string, binding: Decision[], fromIso: string): Decision[] {
  const t = readBack.trim();
  return binding.filter((d) => (d.constraints.length === 0 ? t.length < READ_BACK_MIN : !mentions(t, d.title) && !d.constraints.some((c) => addresses(t, c, fromIso))));
}

/** The reasons a read-back is refused, in words for the receiver. Empty when it is accepted. */
export function readBackProblems(readBack: string, binding: Decision[], fromIso: string): string[] {
  const t = readBack.trim();
  if (t.length < READ_BACK_MIN || t.length > READ_BACK_MAX) return [`Write a read-back of ${READ_BACK_MIN} to ${READ_BACK_MAX} characters in your own words.`];
  return unaddressed(t, binding, fromIso).map((d) => {
    const values = d.constraints.map((c) => valueOf(c).text).join(" or ");
    return `Your read-back does not mention "${d.title}"${values ? ` (${values})` : ""}.`;
  });
}

export const READ_BACK_NOTE = "The read-back checks that each decision is addressed, not that it was understood.";
export const BEFORE_READ_BACK = "Prepared before read-back existed: decisions are acknowledged one by one and no read-back was checked.";
