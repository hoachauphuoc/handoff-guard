import type { Decision } from "../rules/types";

/**
 * A read-back a newcomer can start from, built only from the decisions that bind the item: each is named by
 * its title and answered in a way the check accepts. It is text for a box, never stored and never a verdict.
 */
export function exampleReadBack(binding: Decision[]): string {
  return binding
    .map((d) => {
      const due = d.constraints.find((c) => c.kind === "dueNotAfter");
      return due ? `${d.title}: I will deliver by ${due.date}.` : `${d.title}: understood, I will follow it.`;
    })
    .join(" ");
}
