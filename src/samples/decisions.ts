import type { Decision } from "../rules/types";

// Demo data for a site with no recorded decisions; ids are fixed so loading twice changes nothing.
export function sampleDecisions(projectKey: string): Decision[] {
  const source = { kind: "ledger" as const, ref: "Handoff Guard demo ledger" };
  return [
    {
      id: "d-sample-1",
      title: "Work ships by the end of 2026",
      status: "decided",
      source,
      scope: { kind: "project", projectKey },
      constraints: [{ kind: "dueNotAfter", date: "2026-12-31" }],
    },
    {
      id: "d-sample-2",
      title: "Stop using the legacy billing component",
      status: "decided",
      source,
      scope: { kind: "project", projectKey },
      constraints: [{ kind: "componentForbidden", component: "legacy-billing" }],
    },
    {
      id: "d-sample-3",
      title: "Launch work needs legal review",
      status: "decided",
      source,
      scope: { kind: "label", label: "launch" },
      constraints: [{ kind: "labelRequired", label: "legal-reviewed" }],
    },
    {
      id: "d-sample-4",
      title: "Old rule: freeze changes in November",
      status: "superseded",
      source,
      scope: { kind: "project", projectKey },
      constraints: [{ kind: "dueNotAfter", date: "2026-11-01" }],
    },
  ];
}

/** Upsert by id: incoming replaces a stored decision with the same id, others are kept. */
export function mergeDecisions(existing: Decision[], incoming: Decision[]): Decision[] {
  const byId = new Map(existing.map((d) => [d.id, d]));
  for (const d of incoming) byId.set(d.id, d);
  return [...byId.values()];
}
