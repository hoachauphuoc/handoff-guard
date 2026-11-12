import Resolver from "@forge/resolver";
import { runGatherHandoffContext } from "../actions/core";
import { depsFor } from "../actions/deps";
import { confirmProposal, dismissProposal } from "../decisions/confirm";
import { relate, supersede } from "../decisions/supersede";
import { unrecordedMarked, type MarkedState } from "../decisions/marked";
import { hypothetical } from "../decisions/hypothetical";
import { pageStatusText } from "../decisions/pages";
import { pagesToCheck, sourceNotes, type PageVersion, type SourceChecks } from "../decisions/sourcecheck";
import { buildDecisionsPage, type DecisionsPageState } from "../decisions/page";
import { acknowledge, acknowledgeAll } from "../handoff/acknowledge";
import { withContingency } from "../handoff/contingency";
import { actionList, contingencyAdvisory, severityText } from "../handoff/ipass";
import { handoffFrom, walkthroughHandoff } from "../handoff/build";
import { driftByDecision, fingerprintOf, staleAcks } from "../handoff/drift";
import type { AcknowledgeAllReply, HandoffRecord, PanelState } from "../handoff/types";
import { readPageVersionAsUser } from "../confluence";
import { explainRefusal } from "../llm";
import { openItemsAsUser, readItemAsUser as readItem } from "../jira";
import { bindingDecisions, checkHandoff } from "../rules/checkHandoff";
import { watchAssignee, watchConflicts } from "../rules/advisories";
import { changeText, suggestFixes } from "../rules/feasible";
import { impactOf } from "../rules/impact";
import { replayDiff, replayInstant, type ReplayChange } from "../rules/replay";
import type { Proposal } from "../decisions/types";
import type { Decision, Finding } from "../rules/types";
import { mergeDecisions, sampleDecisions } from "../samples/decisions";
import { readSourceAsUser } from "../source";
import { getDecisions, getProposals, getRecord, putDecisions, putProposals, putRecord } from "../store";

const resolver = new Resolver();

// Only findings about the work item itself: the practice handoff has made-up people, so receiver and
// acknowledgement findings would be noise.
const PRACTICE_RULES: Finding["rule"][] = [
  "empty_description",
  "no_due_date",
  "invalid_due_date",
  "contradicts_decision",
  "invalid_constraint",
];

type Ctx = { accountId?: string; cloudId?: string; extension: { issue: { key: string; id: string } } };

// How many open work items of the project would contradict each proposal. A read that fails is reported as
// null so the panel can say the count is missing, never show zero.
async function impactFor(projectKey: string, proposals: Proposal[]): Promise<PanelState["proposalImpact"]> {
  if (proposals.length === 0) return {};
  try {
    const open = await openItemsAsUser(projectKey);
    const items = open.items.map((i) => i.item);
    return Object.fromEntries(proposals.map((p) => [p.id, { count: impactOf(hypothetical(p), items).length, capped: open.capped }]));
  } catch {
    return null;
  }
}

async function panelState(ctx: Ctx): Promise<PanelState> {
  const { item, issueId } = await readItem(ctx.extension.issue.key);
  const [decisions, record, proposals] = await Promise.all([getDecisions(), getRecord(issueId), getProposals(issueId)]);
  const viewerId = ctx.accountId ?? null;
  const result = record ? checkHandoff(handoffFrom(item, record, decisions), decisions) : null;
  const practice = checkHandoff(
    walkthroughHandoff(item, viewerId, bindingDecisions(decisions, item).map((d) => d.id)),
    decisions,
  );
  return {
    issueKey: ctx.extension.issue.key,
    record,
    result,
    viewerId,
    isReceiver: record !== null && viewerId !== null && viewerId === record.toId,
    decisionCount: decisions.length,
    proposals,
    practiceFindings: practice.findings.filter((f) => PRACTICE_RULES.includes(f.rule)),
    // Computed from confirmed decisions only; proposals never reach it.
    advisories: [
      ...(record ? watchConflicts(item, bindingDecisions(decisions, item)) : []),
      ...watchAssignee(item, record, bindingDecisions(decisions, item)),
    ],
    fixes: suggestFixes(item, decisions).changes.map(changeText),
    stale: record ? Object.keys(staleAcks(record.acknowledged, record.acknowledgedWith, item, bindingDecisions(decisions, item))) : [],
    drift: record ? driftByDecision(record.acknowledged, record.acknowledgedWith, item) : {},
    untracked: record ? record.acknowledged.filter((id) => record.acknowledgedWith?.[id] === undefined) : [],
    severity: result ? severityText(result.verdict) : null,
    actions: record && result ? actionList(result, record, suggestFixes(item, decisions).changes) : [],
    contingency: record?.contingency ? { text: record.contingency, advisory: contingencyAdvisory(record.contingency) } : null,
    proposalImpact: await impactFor(item.projectKey, proposals),
    supersedes: Object.fromEntries(
      proposals.map((p) => {
        const rel = relate(decisions, p.scope, p.constraints);
        return [p.id, rel?.kind === "supersedes" ? rel.old.map((d) => ({ id: d.id, title: d.title })) : []];
      }),
    ),
  };
}

resolver.define("getPanel", ({ context }) => panelState(context as Ctx));

resolver.define("prepareHandoff", async ({ context, payload }) => {
  const ctx = context as Ctx;
  const toId = String((payload as { toId?: string }).toId ?? "");
  if (!ctx.accountId || !toId) throw new Error("Pick a receiver first.");
  const { issueId } = await readItem(ctx.extension.issue.key);
  // Preparing again replaces the record, so earlier acknowledgements never carry over to a new receiver.
  const record: HandoffRecord = {
    fromId: ctx.accountId,
    toId,
    acknowledged: [],
    preparedAt: new Date().toISOString(),
    acknowledgedAt: {},
    origin: "manual",
    protocol: 1,
  };
  await putRecord(issueId, record);
  return panelState(ctx);
});

resolver.define("acknowledgeDecision", async ({ context, payload }) => {
  const ctx = context as Ctx;
  const decisionId = String((payload as { decisionId?: string }).decisionId ?? "");
  const { item, issueId } = await readItem(ctx.extension.issue.key);
  const [decisions, record] = await Promise.all([getDecisions(), getRecord(issueId)]);
  if (!record) throw new Error("No handoff has been prepared for this work item.");
  const binding = bindingDecisions(decisions, item).map((d) => d.id);
  // The receiver is checked here, on the server; the button in the panel is only a convenience.
  const stale = decisionId in staleAcks(record.acknowledged, record.acknowledgedWith, item, bindingDecisions(decisions, item));
  const out = acknowledge(record, ctx.accountId ?? null, decisionId, binding, new Date().toISOString(), fingerprintOf(item), stale);
  if (!out.ok) throw new Error(`Cannot acknowledge: ${out.reason}.`);
  await putRecord(issueId, out.record);
  return panelState(ctx);
});

// One read-back acknowledges every binding decision of a record prepared under the I-PASS design. The checks
// run here, on the server; the panel only shows the same reasons.
resolver.define("acknowledgeAll", async ({ context, payload }) => {
  const ctx = context as Ctx;
  const readBack = String((payload as { readBack?: string }).readBack ?? "");
  const { item, issueId } = await readItem(ctx.extension.issue.key);
  const [decisions, record] = await Promise.all([getDecisions(), getRecord(issueId)]);
  if (!record) throw new Error("No handoff has been prepared for this work item.");
  const out = acknowledgeAll(record, ctx.accountId ?? null, bindingDecisions(decisions, item), readBack, new Date().toISOString(), fingerprintOf(item));
  // A model sentence is asked for only when the code found a contradiction; it is shown beside the reasons.
  if (!out.ok && out.reason === "read_back")
    return {
      reasons: out.problems,
      ...(out.contradictions.length > 0 ? { explanation: await explainRefusal(readBack, out.contradictions) } : {}),
    } satisfies AcknowledgeAllReply;
  if (!out.ok) throw new Error(`Cannot acknowledge: ${out.reason}.`);
  await putRecord(issueId, out.record);
  return { state: await panelState(ctx) } satisfies AcknowledgeAllReply;
});

// Only the sender writes it, and only as text typed in the panel: no action or agent reaches this.
resolver.define("saveContingency", async ({ context, payload }) => {
  const ctx = context as Ctx;
  const { issueId } = await readItem(ctx.extension.issue.key);
  const record = await getRecord(issueId);
  if (!record) throw new Error("No handoff has been prepared for this work item.");
  const out = withContingency(record, ctx.accountId ?? null, String((payload as { text?: string }).text ?? ""));
  if (!out.ok) throw new Error(out.reason === "too_long" ? "Write at most 300 characters." : "Only the sender can write the contingency.");
  await putRecord(issueId, out.record);
  return panelState(ctx);
});

resolver.define("loadSampleDecisions", async ({ context }) => {
  const ctx = context as Ctx;
  const { item } = await readItem(ctx.extension.issue.key);
  // Demo data for this project only; nothing is written to Jira.
  await putDecisions(mergeDecisions(await getDecisions(), sampleDecisions(item.projectKey)));
  return panelState(ctx);
});

// Both take only a proposal id. The proposal itself is read from storage for this work item, so nothing a
// caller sends can become a decision.
resolver.define("confirmProposal", async ({ context, payload }) => {
  const ctx = context as Ctx;
  if (!ctx.accountId) throw new Error("Confirming a decision needs a signed-in person.");
  const id = String((payload as { proposalId?: string }).proposalId ?? "");
  const { issueId } = await readItem(ctx.extension.issue.key);
  const [proposals, decisions] = await Promise.all([getProposals(issueId), getDecisions()]);
  const retire = (payload as { supersede?: boolean }).supersede === true;
  const out = confirmProposal(proposals, decisions, id, ctx.accountId, new Date().toISOString(), retire);
  if (!out.ok) throw new Error("That proposal is no longer there. Reload the page to see the current list.");
  // The decision is saved first: if the second write fails the proposal is still listed and confirming
  // again changes nothing, whereas the other order could lose the decision.
  await putDecisions(out.decisions);
  await putProposals(issueId, out.proposals);
  return panelState(ctx);
});

resolver.define("dismissProposal", async ({ context, payload }) => {
  const ctx = context as Ctx;
  if (!ctx.accountId) throw new Error("Dismissing a proposal needs a signed-in person.");
  const id = String((payload as { proposalId?: string }).proposalId ?? "");
  const { issueId } = await readItem(ctx.extension.issue.key);
  await putProposals(issueId, dismissProposal(await getProposals(issueId), id));
  return panelState(ctx);
});

// The brief only reads. It runs the same function the Rovo action runs, as the viewer, so what the panel
// shows and what Rovo is given cannot differ.
resolver.define("gatherContext", ({ context }) => {
  const ctx = context as Ctx;
  return runGatherHandoffContext({ issueKey: ctx.extension.issue.key }, ctx.accountId ?? null, depsFor(ctx.cloudId ?? null));
});

// Read separately from the panel state so a slow or refused comment read never delays the verdict. Nothing
// returned here is stored, and it is not an input to the rule check.
resolver.define("getMarked", async ({ context }): Promise<MarkedState> => {
  const ctx = context as Ctx;
  const [src, decisions] = await Promise.all([readSourceAsUser(ctx.extension.issue.key), getDecisions()]);
  return {
    notInLedger: unrecordedMarked(src.parts, decisions),
    truncated: src.truncated,
    pagesText: src.pages ? pageStatusText(src.pages) : "",
  };
});

// The Decisions project page. Open items are read as the viewer, so the counts only cover work the viewer
// may see, and the page says when the cap cut the list. Nothing is written.
resolver.define("getDecisionsPage", async ({ context }): Promise<DecisionsPageState> => {
  const projectKey = String((context as { extension: { project: { key: string } } }).extension.project.key);
  const [open, decisions] = await Promise.all([openItemsAsUser(projectKey), getDecisions()]);
  const records = await Promise.all(open.items.map((i) => getRecord(i.issueId)));
  return buildDecisionsPage(
    projectKey,
    decisions,
    open.items.map((i, n) => ({ item: i.item, record: records[n] ?? null })),
    open.capped,
    new Date().toISOString(),
  );
});

// Reads the version of each page behind the given decisions, as the viewer, and compares it with the version
// stored when the decision was confirmed. Advisory: it changes nothing and no rule reads it.
async function checkSources(decisions: Decision[]): Promise<SourceChecks> {
  const ids = pagesToCheck(decisions);
  const reads: Record<string, PageVersion> = {};
  await Promise.all(ids.map(async (id) => void (reads[id] = await readPageVersionAsUser(id))));
  return sourceNotes(decisions, reads);
}

// For the panel: the decisions that bind this work item.
resolver.define("getSourceChecks", async ({ context }): Promise<SourceChecks> => {
  const { item } = await readItem((context as Ctx).extension.issue.key);
  return checkSources(bindingDecisions(await getDecisions(), item));
});

// For the project page: every decision in force that can bind work here.
resolver.define("getProjectSourceChecks", async ({ context }): Promise<SourceChecks> => {
  const projectKey = String((context as { extension: { project: { key: string } } }).extension.project.key).toLowerCase();
  const inProject = (d: Decision) => d.scope.kind === "project" ? d.scope.projectKey.toLowerCase() === projectKey : d.scope.kind === "workItem" ? d.scope.key.toLowerCase().startsWith(`${projectKey}-`) : true;
  return checkSources((await getDecisions()).filter(inProject));
});

export type ReplayState = { date: string; changes: ReplayChange[]; leftOut: string[]; assumed: string[]; scanned: number; capped: boolean };

// Replays the project's stored handoffs against the decisions of an earlier date. The clock is read here, at
// the edge, and passed to the pure functions; nothing is written.
resolver.define("replayOn", async ({ context, payload }): Promise<ReplayState> => {
  const projectKey = String((context as { extension: { project: { key: string } } }).extension.project.key);
  const date = String((payload as { date?: string }).date ?? "");
  const now = new Date();
  const thenIso = replayInstant(date, now.toISOString());
  if (thenIso === null) throw new Error("Pick a date that is today or earlier.");
  const [open, decisions] = await Promise.all([openItemsAsUser(projectKey), getDecisions()]);
  const records = await Promise.all(open.items.map((i) => getRecord(i.issueId)));
  const inputs = open.items.flatMap((i, n) => {
    const r = records[n];
    return r ? [{ item: i.item, fromId: r.fromId, toId: r.toId, acknowledged: r.acknowledged, acknowledgedAt: r.acknowledgedAt, preparedAt: r.preparedAt }] : [];
  });
  return { date, ...replayDiff(inputs, decisions, thenIso, now.toISOString()), scanned: open.items.length, capped: open.capped };
});

// A person retires a decision from the Decisions page. The rules already ignore anything not "decided".
resolver.define("supersedeDecision", async ({ context, payload }) => {
  if (!(context as { accountId?: string }).accountId) throw new Error("Superseding a decision needs a signed-in person.");
  const id = String((payload as { decisionId?: string }).decisionId ?? "");
  const decisions = await getDecisions();
  if (!decisions.some((d) => d.id === id && d.status === "decided")) throw new Error("That decision is not in force. Reload the page.");
  await putDecisions(supersede(decisions, [id], new Date().toISOString()));
});

export const handler = resolver.getDefinitions();
