import { checkHandoff } from "./checkHandoff";
import type { Decision, Handoff, Verdict, WorkItem } from "./types";

const at = (iso: string): number => Date.parse(iso);

/**
 * The decisions as they stood at `atIso`: confirmed by then and not yet superseded. A superseded decision
 * whose end was never recorded is left out: nothing says when it stopped binding, so showing it as in force
 * would be a guess; `undatedDecisions` names it. One with no confirmation time (the demo decisions) is kept as
 * in force throughout, and is named there too. Returned as `decided`: whether it binds is the whole question
 * at that instant. Pure: the instant is passed in.
 */
export function decisionsAsOf(decisions: Decision[], atIso: string): Decision[] {
  const t = at(atIso);
  return decisions
    .filter((d) => {
      if (d.status === "superseded") return d.supersededAt !== undefined && at(d.supersededAt) > t && (d.confirmedAt === undefined || at(d.confirmedAt) <= t);
      return d.confirmedAt === undefined || at(d.confirmedAt) <= t;
    })
    .map((d) => ({ ...d, status: "decided" as const }));
}

/** Titles the replay cannot date, to be said next to its result: left out (end unknown) and assumed (start unknown). */
export function undatedDecisions(decisions: Decision[]): { leftOut: string[]; assumed: string[] } {
  return {
    leftOut: decisions.filter((d) => d.status === "superseded" && d.supersededAt === undefined).map((d) => d.title),
    assumed: decisions.filter((d) => d.status === "decided" && d.confirmedAt === undefined).map((d) => d.title),
  };
}

export type ReplayInput = { item: WorkItem; fromId: string; toId: string; acknowledged: string[]; acknowledgedAt: Record<string, string>; preparedAt: string };

/**
 * The stored handoff checked against `decisions` as of `atIso`, or null when it had not been prepared yet.
 * The caller chooses the decisions: `decisionsAsOf` for a past date, the stored list for today (where the
 * stored status is authoritative). Only decisions and acknowledgements are replayed: the work item is as it
 * is now, because Jira's history is not read. An acknowledgement with no recorded time is kept as given.
 */
export function replayAt(input: ReplayInput, decisions: Decision[], atIso: string): { verdict: Verdict; findings: ReturnType<typeof checkHandoff>["findings"] } | null {
  if (at(input.preparedAt) > at(atIso)) return null;
  const handoff: Handoff = {
    item: input.item,
    fromId: input.fromId,
    toId: input.toId,
    acknowledged: input.acknowledged.filter((id) => input.acknowledgedAt[id] === undefined || at(input.acknowledgedAt[id]!) <= at(atIso)),
  };
  const { verdict, findings } = checkHandoff(handoff, decisions);
  return { verdict, findings };
}

export type ReplayResult = { changes: ReplayChange[]; leftOut: string[]; assumed: string[] };
export type ReplayChange = { key: string; summary: string; then: Verdict; now: Verdict; changedBy: string[] };

/**
 * Handoffs whose verdict on `thenIso` differs from `nowIso`, each with the titles of the decisions that
 * explain it: those named by a finding at one instant but not the other. The result also lists the decisions it could not date. Handoffs not yet prepared on the
 * earlier date are left out, because there was no verdict to compare.
 */
export function replayDiff(inputs: ReplayInput[], decisions: Decision[], thenIso: string, nowIso: string): ReplayResult {
  const out: ReplayChange[] = [];
  const past = decisionsAsOf(decisions, thenIso);
  for (const input of inputs) {
    const then = replayAt(input, past, thenIso);
    const now = replayAt(input, decisions, nowIso);
    if (then === null || now === null || then.verdict === now.verdict) continue;
    const ids = (r: typeof then) => new Set(r.findings.flatMap((f) => (f.decisionId === undefined ? [] : [f.decisionId])));
    const [a, b] = [ids(then), ids(now)];
    const changed = [...new Set([...a, ...b].filter((id) => a.has(id) !== b.has(id)))];
    out.push({
      key: input.item.key,
      summary: input.item.summary,
      then: then.verdict,
      now: now.verdict,
      changedBy: changed.map((id) => decisions.find((d) => d.id === id)?.title ?? id),
    });
  }
  return { changes: out.sort((x, y) => x.key.localeCompare(y.key)), ...undatedDecisions(decisions) };
}
