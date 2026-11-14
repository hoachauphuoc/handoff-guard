import { isIsoDate } from "../rules/checkHandoff";
import type { Constraint, Decision, DecisionScope } from "../rules/types";
import { fnv1a } from "./hash";
import { relate } from "./supersede";
import { MAX_TITLE } from "./validate";

export type ManualInput = {
  title: string;
  scope: "project" | "label" | "workItem";
  scopeValue: string;
  constraint: Constraint["kind"];
  constraintValue: string;
};

export type ManualResult = { ok: true; decision: Decision } | { ok: false; reason: string };

const KINDS: Constraint["kind"][] = ["dueNotAfter", "labelRequired", "labelForbidden", "componentRequired", "componentForbidden"];

const text = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

/** Reads untrusted payload fields into a ManualInput, or says which one is wrong. */
export function readManualInput(raw: unknown): ManualInput | string {
  const r = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;
  const scope = r.scope;
  const constraint = r.constraint;
  if (scope !== "project" && scope !== "label" && scope !== "workItem") return "Pick where the decision applies.";
  if (typeof constraint !== "string" || !KINDS.includes(constraint as Constraint["kind"])) return "Pick what the decision requires.";
  return { title: text(r.title), scope, scopeValue: text(r.scopeValue), constraint: constraint as Constraint["kind"], constraintValue: text(r.constraintValue) };
}

function scopeOf(input: ManualInput, projectKey: string): DecisionScope | string {
  if (input.scope === "project") return { kind: "project", projectKey };
  if (input.scopeValue === "") return input.scope === "label" ? "Write the label this decision applies to." : "Write the work item key this decision applies to.";
  // A label is bound to the project, as with confirmed proposals, so it cannot reach another project on the site.
  if (input.scope === "label") return { kind: "label", label: input.scopeValue, projectKey };
  const key = input.scopeValue.toUpperCase();
  return key.startsWith(`${projectKey.toUpperCase()}-`) && /^[A-Z][A-Z0-9_]*-\d+$/.test(key)
    ? { kind: "workItem", key }
    : `The work item key must belong to project ${projectKey}, for example ${projectKey}-12.`;
}

function constraintOf(input: ManualInput): Constraint | string {
  const v = input.constraintValue;
  if (input.constraint === "dueNotAfter") return isIsoDate(v) ? { kind: "dueNotAfter", date: v } : "The date must be a real calendar date written YYYY-MM-DD.";
  if (v === "") return "Write the label or component the decision names.";
  if (input.constraint === "labelRequired" || input.constraint === "labelForbidden") return { kind: input.constraint, label: v };
  return { kind: input.constraint, component: v };
}

/**
 * Builds a decision a person typed in. The title is the person's own words and so is the source: there is
 * no quote to check, so nothing here pretends a document says it. The id comes from the content, so
 * typing the same decision twice cannot store it twice.
 */
export function buildManualDecision(input: ManualInput, projectKey: string, stored: Decision[], who: string, nowIso: string): ManualResult {
  if (input.title === "" || input.title.length > MAX_TITLE) return { ok: false, reason: `Write a title of 1 to ${MAX_TITLE} characters.` };
  const scope = scopeOf(input, projectKey);
  if (typeof scope === "string") return { ok: false, reason: scope };
  const constraint = constraintOf(input);
  if (typeof constraint === "string") return { ok: false, reason: constraint };
  if (relate(stored, scope, [constraint])?.kind === "already_decided") {
    return { ok: false, reason: "A decision in force already says this for the same work or wider. Nothing was added." };
  }
  return {
    ok: true,
    decision: {
      id: "d-m-" + fnv1a([input.title, JSON.stringify(scope), JSON.stringify(constraint)].join("|")),
      title: input.title,
      status: "decided",
      source: { kind: "ledger", ref: `Added by hand in project ${projectKey}` },
      scope,
      constraints: [constraint],
      confirmedBy: who,
      confirmedAt: nowIso,
    },
  };
}
