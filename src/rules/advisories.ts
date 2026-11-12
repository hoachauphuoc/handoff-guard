import { isIsoDate } from "./checkHandoff";
import type { Decision, WorkItem } from "./types";
import { count } from "../plural";

export type Advisory = {
  kind: "due_before_limit" | "description_date_after_due" | "different_limits";
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
  return out;
}
