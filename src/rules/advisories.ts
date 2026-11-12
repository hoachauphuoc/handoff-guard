import { isIsoDate, norm } from "./checkHandoff";
import type { Decision, WorkItem } from "./types";
import { count } from "../plural";

export type Advisory = {
  kind: "due_before_limit" | "description_date_after_due" | "different_limits" | "decisions_disagree" | "assignee_differs_from_handoff" | "assignee_without_handoff";
  message: string;
  decisionIds: string[];
};

const MAX_DESCRIPTION_DATES = 3;
const NEAR_LIMIT_DAYS = 2;

const day = (iso: string): number => {
  const [y, m, d] = iso.split("-").map(Number) as [number, number, number];
  return Date.UTC(y, m - 1, d) / 86_400_000;
};

/**
 * Plain facts a person may want to look at. Not findings: nothing here changes a verdict, and the wording
 * states what is in the data without judging it. Pure: no clock, so "near" means near the decision's limit.
 */
export function watchConflicts(item: WorkItem, binding: Decision[]): Advisory[] {
  const out: Advisory[] = [];
  const due = item.dueDate !== null && isIsoDate(item.dueDate) ? item.dueDate : null;
  const limits = binding.flatMap((d) =>
    d.constraints.flatMap((c) => (c.kind === "dueNotAfter" && isIsoDate(c.date) ? [{ d, date: c.date }] : [])),
  );

  if (due !== null) {
    const later = [...new Set(item.description.match(/\b\d{4}-\d{2}-\d{2}\b/g) ?? [])]
      .filter((x) => isIsoDate(x) && x > due)
      .slice(0, MAX_DESCRIPTION_DATES);
    for (const date of later) {
      out.push({ kind: "description_date_after_due", message: `The description mentions ${date}, later than the due date ${due}.`, decisionIds: [] });
    }
    for (const { d, date } of limits) {
      const gap = day(date) - day(due);
      if (gap >= 0 && gap <= NEAR_LIMIT_DAYS) {
        out.push({
          kind: "due_before_limit",
          message: `The due date ${due} is ${count(gap, "day")} before the limit ${date} in "${d.title}".`,
          decisionIds: [d.id],
        });
      }
    }
  }

  if (new Set(limits.map((l) => l.date)).size > 1) {
    out.push({
      kind: "different_limits",
      message: `Decisions set different date limits: ${limits.map((l) => `${l.d.title} (${l.date})`).join(", ")}; the rule check uses the earliest.`,
      decisionIds: [...new Set(limits.map((l) => l.d.id))],
    });
  }

  // One decision requires what another forbids: the rule check reports a contradiction whichever way the
  // item is edited, so this names the disagreement instead of leaving the person to find it.
  for (const kind of ["label", "component"] as const) {
    const listed = (want: "Required" | "Forbidden") =>
      binding.flatMap((d) =>
        d.constraints.flatMap((c) => (c.kind === `${kind}${want}` ? [{ d, value: "label" in c ? c.label : "component" in c ? c.component : "" }] : [])),
      );
    const required = listed("Required");
    const forbidden = listed("Forbidden");
    for (const value of [...new Set(required.map((r) => norm(r.value)))]) {
      const need = required.filter((r) => norm(r.value) === value);
      const ban = forbidden.filter((f) => norm(f.value) === value);
      if (ban.length === 0) continue;
      const titles = (xs: typeof need) => [...new Set(xs.map((x) => `"${x.d.title}"`))].join(", ");
      out.push({
        kind: "decisions_disagree",
        message: `Decisions disagree about the ${kind} "${need[0]!.value}": ${titles(need)} requires it and ${titles(ban)} forbids it.`,
        decisionIds: [...new Set([...need, ...ban].map((x) => x.d.id))],
      });
    }
  }
  return out;
}

/**
 * The fallback for a reassignment the trigger did not catch, and for work handed over without anyone
 * preparing a handoff. States what the data shows; names no one, since account ids mean nothing in text.
 */
export function watchAssignee(item: WorkItem, record: { toId: string } | null, binding: Decision[]): Advisory[] {
  if (item.assigneeId === null) return [];
  if (record !== null) {
    return norm(record.toId) === norm(item.assigneeId)
      ? []
      : [{ kind: "assignee_differs_from_handoff", message: "The assignee is not the receiver of the prepared handoff.", decisionIds: [] }];
  }
  return binding.length === 0
    ? []
    : [
        {
          kind: "assignee_without_handoff",
          message: `This work item has an assignee and ${count(binding.length, "decision")} in force, but no handoff is prepared.`,
          decisionIds: binding.map((d) => d.id),
        },
      ];
}
