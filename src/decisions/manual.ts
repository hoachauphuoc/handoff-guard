import { isIsoDate } from "../rules/checkHandoff";
import type { Constraint, Decision, DecisionScope } from "../rules/types";
import { CONDITION_CAP, CONDITION_MAX_LENGTH, conditionJqls } from "./conditions";
import { fnv1a } from "./hash";
import { clashText } from "./confirm";
import { canSupersede, clashes, relate } from "./supersede";
import { MAX_TITLE } from "./validate";

export type ManualInput = {
  title: string;
  scope: "project" | "label" | "workItem";
  scopeValue: string;
  /** "commitment": a decision with nothing to check on the work item; the receiver confirms it by name. */
  constraint: Constraint["kind"] | "commitment";
  constraintValue: string;
  /** Where the decision was made; optional, https only, never opened by the app. */
  sourceUrl?: string;
  /** The person chose to retire the decisions in force that this one clashes with. */
  supersede: boolean;
};

export type ManualResult = { ok: true; decision: Decision; retire: string[] } | { ok: false; reason: string };

const KINDS: ManualInput["constraint"][] = ["dueNotAfter", "labelRequired", "labelForbidden", "componentRequired", "componentForbidden", "condition", "commitment"];
export const SOURCE_URL_MAX = 300;

const text = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

/** Reads untrusted payload fields into a ManualInput, or says which one is wrong. */
export function readManualInput(raw: unknown): ManualInput | string {
  const r = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;
  const scope = r.scope;
  const constraint = r.constraint;
  if (scope !== "project" && scope !== "label" && scope !== "workItem") return "Pick where the decision applies.";
  if (typeof constraint !== "string" || !KINDS.includes(constraint as ManualInput["constraint"])) return "Pick what the decision requires.";
  return {
    title: text(r.title),
    scope,
    scopeValue: text(r.scopeValue),
    constraint: constraint as ManualInput["constraint"],
    constraintValue: text(r.constraintValue),
    sourceUrl: text(r.sourceUrl),
    supersede: r.supersede === true,
  };
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

// A link is stored and shown, never fetched, so it only has to be a plain https address.
function sourceLinkOf(url: string): string | null | { error: string } {
  if (url === "") return null;
  if (url.length > SOURCE_URL_MAX) return { error: `The source link is at most ${SOURCE_URL_MAX} characters.` };
  try {
    const u = new URL(url);
    if (u.protocol === "https:" && !/\s/.test(url)) return u.toString();
  } catch {
    // Falls through to the refusal below.
  }
  return { error: "The source link must be a web address that starts with https://." };
}

function constraintOf(kind: Constraint["kind"], v: string): Constraint | string {
  if (kind === "dueNotAfter") return isIsoDate(v) ? { kind: "dueNotAfter", date: v } : "The date must be a real calendar date written YYYY-MM-DD.";
  if (kind === "condition") return conditionOf(v);
  if (v === "") return "Write the label or component the decision names.";
  if (kind === "labelRequired" || kind === "labelForbidden") return { kind, label: v };
  return { kind, component: v };
}

// Only the shape is checked here; whether Jira can run it is asked of Jira before saving.
function conditionOf(jql: string): Constraint | string {
  if (jql === "") return "Write the Jira filter (JQL) the work item must match, for example priority = Highest.";
  if (jql.length > CONDITION_MAX_LENGTH) return `A Jira filter here is at most ${CONDITION_MAX_LENGTH} characters.`;
  if (/\border\s+by\b/i.test(jql)) return "A filter here cannot sort: remove ORDER BY.";
  return { kind: "condition", jql };
}

/**
 * Builds a decision a person typed in. The title is the person's own words and so is the source: there is
 * no quote to check, so nothing here pretends a document says it. The id comes from the content, so
 * typing the same decision twice cannot store it twice. `replaces` is a decision the caller retires in the
 * same save (a Rovo draft that supersedes one), so its filter does not count against the cap.
 */
export function buildManualDecision(input: ManualInput, projectKey: string, stored: Decision[], who: string, nowIso: string, replaces: string | null = null): ManualResult {
  if (input.title === "" || input.title.length > MAX_TITLE) return { ok: false, reason: `Write a title of 1 to ${MAX_TITLE} characters.` };
  const scope = scopeOf(input, projectKey);
  if (typeof scope === "string") return { ok: false, reason: scope };
  const link = sourceLinkOf(input.sourceUrl ?? "");
  if (link !== null && typeof link === "object") return { ok: false, reason: link.error };
  let constraints: Constraint[] = [];
  if (input.constraint !== "commitment") {
    const constraint = constraintOf(input.constraint, input.constraintValue);
    if (typeof constraint === "string") return { ok: false, reason: constraint };
    constraints = [constraint];
  }
  if (relate(stored, scope, constraints, input.title)?.kind === "already_decided") {
    return { ok: false, reason: "A decision in force already says this for the same work or wider. Nothing was added." };
  }
  const clash = clashes(stored, scope, constraints);
  const mayRetire = clash.every((d) => canSupersede(d, who));
  if (clash.length > 0 && (!input.supersede || !mayRetire)) return { ok: false, reason: clashText(clash.map((d) => d.title), mayRetire) };
  // Only CONDITION_CAP filters are asked of Jira; one more would read as not checked and the validator would
  // refuse every transition it binds. So the save is refused instead, while the way out is still clear.
  const jql = constraints[0]?.kind === "condition" ? constraints[0].jql : null;
  const kept = conditionJqls(stored.filter((d) => d.id !== replaces && !clash.some((c) => c.id === d.id)));
  // A filter already in force counts only if it is among the first CONDITION_CAP: a project that had more
  // before this guard existed would otherwise let a new decision reuse one that is never asked.
  const at = jql === null ? -1 : kept.indexOf(jql);
  if (jql !== null && (at >= CONDITION_CAP || (at < 0 && kept.length >= CONDITION_CAP))) {
    return { ok: false, reason: `${kept.length} Jira filters are already in force in this project; Handoff Guard checks at most ${CONDITION_CAP}. Supersede one before adding another. Nothing was added.` };
  }
  return {
    ok: true,
    retire: clash.map((d) => d.id),
    decision: {
      id: "d-m-" + fnv1a([input.title, JSON.stringify(scope), JSON.stringify(constraints[0] ?? "commitment")].join("|")),
      title: input.title,
      status: "decided",
      source: { kind: "ledger", ref: `Added by hand in project ${projectKey}`, ...(link ? { link } : {}) },
      scope,
      constraints,
      confirmedBy: who,
      confirmedAt: nowIso,
    },
  };
}
