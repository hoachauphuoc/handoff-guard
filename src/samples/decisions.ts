import type { Decision } from "../rules/types";

const LEDGER = "Handoff Guard demo ledger";

// Demo data for one project. Ids carry the project key so loading in a second project does not move the
// first project's samples, and are fixed so loading twice changes nothing.
export function sampleDecisions(projectKey: string): Decision[] {
  const source = { kind: "ledger" as const, ref: LEDGER };
  const id = (n: number) => `d-sample-${n}-${projectKey.toLowerCase()}`;
  return [
    {
      id: id(1),
      title: "Work ships by the end of 2026",
      status: "decided",
      source,
      scope: { kind: "project", projectKey },
      constraints: [{ kind: "dueNotAfter", date: "2026-12-31" }],
    },
    {
      id: id(2),
      title: "Stop using the legacy billing component",
      status: "decided",
      source,
      scope: { kind: "project", projectKey },
      constraints: [{ kind: "componentForbidden", component: "legacy-billing" }],
    },
    {
      id: id(3),
      title: "Launch work needs legal review",
      status: "decided",
      source,
      scope: { kind: "label", label: "launch", projectKey },
      constraints: [{ kind: "labelRequired", label: "legal-reviewed" }],
    },
    {
      id: id(4),
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

/** Whether this project already has the demo decisions, including ones stored before ids carried the project key. */
export function hasSamples(decisions: Decision[], projectKey: string): boolean {
  const p = projectKey.toLowerCase();
  return decisions.some(
    (d) => d.source.kind === "ledger" && d.source.ref === LEDGER && d.scope.kind === "project" && d.scope.projectKey.toLowerCase() === p,
  );
}
