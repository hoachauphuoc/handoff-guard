import { inFlight, type InFlight } from "../handoff/inflight";
import type { HandoffRecord } from "../handoff/types";
import { impactOf } from "../rules/impact";
import type { Decision, WorkItem } from "../rules/types";
import { canSupersede } from "./supersede";
import { constraintText, reachText } from "./reach";

export type DecisionRow = {
  id: string;
  title: string;
  reach: string;
  constraints: string[];
  source: string;
  status: Decision["status"];
  confirmedBy: string | null;
  confirmedAt: string | null;
  /** When it stopped binding and what replaced it (a title), if anything. */
  supersededAt: string | null;
  supersededBy: string | null;
  /** Open work items in this project that contradict it now; null for a decision that no longer binds. */
  impact: { count: number; keys: string[] } | null;
  /** Whether the viewer may retire it; the resolver checks again, so this only decides whether the button is shown. */
  canSupersede: boolean;
};

export type DecisionsPageState = {
  projectKey: string;
  rows: DecisionRow[];
  /** Open work items looked at, and whether the cap cut the list. Said on the page so a count is not read as complete. */
  scanned: number;
  capped: boolean;
  inFlight: InFlight[];
  nowIso: string;
};

const MAX_KEYS = 10;

// A decision belongs on this project's page when it can bind work here; a label scope can bind anywhere.
const touches = (d: Decision, projectKey: string): boolean => {
  const p = projectKey.toLowerCase();
  switch (d.scope.kind) {
    case "project":
      return d.scope.projectKey.toLowerCase() === p;
    case "workItem":
      return d.scope.key.toLowerCase().startsWith(`${p}-`);
    case "label":
      return true;
  }
};

export function buildDecisionsPage(
  projectKey: string,
  decisions: Decision[],
  open: { item: WorkItem; record: HandoffRecord | null }[],
  capped: boolean,
  nowIso: string,
  viewerId: string | null,
): DecisionsPageState {
  const items = open.map((o) => o.item);
  const rows = decisions
    .filter((d) => touches(d, projectKey))
    .map((d): DecisionRow => {
      const hit = d.status === "decided" ? impactOf(d, items) : null;
      return {
        id: d.id,
        title: d.title,
        reach: reachText(d.scope),
        constraints: d.constraints.map(constraintText),
        source: `${d.source.kind} ${d.source.ref}`,
        status: d.status,
        confirmedBy: d.confirmedBy ?? null,
        confirmedAt: d.confirmedAt ?? null,
        supersededAt: d.supersededAt ?? null,
        supersededBy: decisions.find((x) => x.id === d.supersededBy)?.title ?? null,
        canSupersede: d.status === "decided" && viewerId !== null && canSupersede(d, viewerId),
        impact: hit === null ? null : { count: hit.length, keys: hit.slice(0, MAX_KEYS).map((h) => h.key) },
      };
    });
  return { projectKey, rows, scanned: open.length, capped, inFlight: inFlight(open, decisions, nowIso), nowIso };
}
