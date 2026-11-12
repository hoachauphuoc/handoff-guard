import { HINTS } from "../guide/hints";
import { norm } from "../rules/checkHandoff";
import { changeText, type Change } from "../rules/feasible";
import type { Constraint, Decision, Finding, HandoffResult, Verdict } from "../rules/types";

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

export const CONTINGENCY_MIN = 20;
export const CONTINGENCY_MAX = 300;
const IF_THEN = /\bif\b.+\bthen\b/i;

/** Length is a hard limit on what is stored; the if-then form is only a hint to the sender. */
export const contingencyTooLong = (text: string): boolean => text.trim().length > CONTINGENCY_MAX;

/** Advice for the person reading a stored contingency. Never a finding, so it cannot change a verdict. */
export function contingencyAdvisory(text: string): string | null {
  const t = text.trim();
  if (t.length >= CONTINGENCY_MIN && IF_THEN.test(t)) return null;
  return `The contingency is not written as "if … then …" (at least ${CONTINGENCY_MIN} characters), so the receiver may not read it as a plan.`;
}

export const READ_BACK_MIN = 20;
/** Room for about seven decisions at roughly 80 characters each. */
export const READ_BACK_MAX = 600;

const valueOf = (c: Constraint): { text: string; value: string } =>
  c.kind === "dueNotAfter"
    ? { text: `date ${c.date}`, value: c.date }
    : "label" in c
      ? { text: `label ${c.label}`, value: c.label }
      : { text: `component ${c.component}`, value: c.component };

const escape = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// A value counts only as a whole word, so the label "ui" is not found inside "build".
const mentions = (text: string, value: string): boolean => new RegExp(`(?<![a-z0-9])${escape(norm(value))}(?![a-z0-9])`).test(norm(text));

/**
 * The binding decisions the read-back does not address: it neither contains the decision's title nor one of
 * its constraint values (date, label or component), compared the way the rules compare. A decision with no
 * constraints is addressed by any read-back of the minimum length. This checks that each decision is
 * addressed, not that it was understood.
 */
export function unaddressed(readBack: string, binding: Decision[]): Decision[] {
  const t = readBack.trim();
  return binding.filter((d) => (d.constraints.length === 0 ? t.length < READ_BACK_MIN : !mentions(t, d.title) && !d.constraints.some((c) => mentions(t, valueOf(c).value))));
}

/** The reasons a read-back is refused, in words for the receiver. Empty when it is accepted. */
export function readBackProblems(readBack: string, binding: Decision[]): string[] {
  const t = readBack.trim();
  if (t.length < READ_BACK_MIN || t.length > READ_BACK_MAX) return [`Write a read-back of ${READ_BACK_MIN} to ${READ_BACK_MAX} characters in your own words.`];
  return unaddressed(t, binding).map((d) => {
    const values = d.constraints.map((c) => valueOf(c).text).join(" or ");
    return `Your read-back does not mention "${d.title}"${values ? ` (${values})` : ""}.`;
  });
}

export const READ_BACK_NOTE = "The read-back checks that each decision is addressed, not that it was understood.";
export const BEFORE_READ_BACK = "Prepared before read-back existed: decisions are acknowledged one by one and no read-back was checked.";
