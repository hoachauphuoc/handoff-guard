import { isIsoDate, norm } from "../rules/checkHandoff";
import type { Constraint, Decision, DecisionScope } from "../rules/types";

const reachKey = (s: DecisionScope): string =>
  s.kind === "project" ? `project:${norm(s.projectKey)}` : s.kind === "label" ? `label:${norm(s.label)}` : `workItem:${norm(s.key)}`;

/**
 * True when every work item `b` can bind is also bound by `a`. Only what is certain counts: a project covers
 * its own work items; a label scope and a work item scope are never compared, since an item may or may not
 * carry the label.
 */
export function reachCovers(a: DecisionScope, b: DecisionScope): boolean {
  if (reachKey(a) === reachKey(b)) return true;
  return a.kind === "project" && b.kind === "workItem" && norm(b.key).startsWith(norm(a.projectKey) + "-");
}

const valueOf = (c: Constraint): string => (c.kind === "dueNotAfter" ? c.date.trim() : "label" in c ? norm(c.label) : norm(c.component));

/** True when meeting `strong` always meets `weak`: the same rule, or an earlier date limit. */
function implies(strong: Constraint, weak: Constraint): boolean {
  if (strong.kind !== weak.kind) return false;
  if (strong.kind === "dueNotAfter" && weak.kind === "dueNotAfter" && isIsoDate(strong.date) && isIsoDate(weak.date)) {
    return strong.date <= weak.date;
  }
  return valueOf(strong) === valueOf(weak);
}

const OPPOSITE: Partial<Record<Constraint["kind"], Constraint["kind"]>> = {
  labelRequired: "labelForbidden",
  labelForbidden: "labelRequired",
  componentRequired: "componentForbidden",
  componentForbidden: "componentRequired",
};

// The opposite answer to the same question. A later or earlier date limit needs no case here: a stricter
// candidate makes the older limit redundant, and a looser one is already met by it.
const opposes = (a: Constraint, b: Constraint): boolean => OPPOSITE[a.kind] === b.kind && valueOf(a) === valueOf(b);

export type Relation = { kind: "already_decided"; by: Decision[] } | { kind: "supersedes"; old: Decision[] } | null;

/**
 * How a candidate relates to the confirmed decisions. `already_decided`: every one of its constraints is met
 * by a decision of equal or wider reach, so there is nothing to add. `supersedes`: it would make older
 * decisions redundant (wider or equal reach, at least as strict) or it states the opposite rule for the
 * same work; the person decides whether to retire them. Superseded decisions are ignored.
 */
export function relate(decisions: Decision[], scope: DecisionScope, constraints: Constraint[]): Relation {
  const live = decisions.filter((d) => d.status === "decided");
  const covering = live.filter((d) => reachCovers(d.scope, scope));
  if (constraints.every((c) => covering.some((d) => d.constraints.some((sc) => implies(sc, c))))) {
    return { kind: "already_decided", by: covering.filter((d) => d.constraints.some((sc) => constraints.some((c) => implies(sc, c)))) };
  }
  const old = live.filter(
    (d) =>
      (reachCovers(scope, d.scope) && d.constraints.every((sc) => constraints.some((c) => implies(c, sc)))) ||
      (reachKey(scope) === reachKey(d.scope) && constraints.some((c) => d.constraints.some((sc) => opposes(c, sc)))),
  );
  return old.length > 0 ? { kind: "supersedes", old } : null;
}

/** Marks decisions as superseded. `by` is the replacing decision's id, absent when a person retires one by hand. */
export function supersede(decisions: Decision[], ids: string[], nowIso: string, by?: string): Decision[] {
  return decisions.map((d) =>
    ids.includes(d.id) && d.status === "decided"
      ? { ...d, status: "superseded", supersededAt: nowIso, ...(by !== undefined ? { supersededBy: by } : {}) }
      : d,
  );
}
