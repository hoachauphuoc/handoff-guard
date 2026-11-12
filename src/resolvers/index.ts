import Resolver from "@forge/resolver";
import { runGatherHandoffContext } from "../actions/core";
import { depsFor } from "../actions/deps";
import { confirmProposal, dismissProposal } from "../decisions/confirm";
import { unrecordedMarked, type MarkedState } from "../decisions/marked";
import { pageStatusText } from "../decisions/pages";
import { acknowledge } from "../handoff/acknowledge";
import { handoffFrom, walkthroughHandoff } from "../handoff/build";
import type { HandoffRecord, PanelState } from "../handoff/types";
import { readItemAsUser as readItem } from "../jira";
import { bindingDecisions, checkHandoff } from "../rules/checkHandoff";
import { watchAssignee, watchConflicts } from "../rules/advisories";
import { changeText, suggestFixes } from "../rules/feasible";
import type { Finding } from "../rules/types";
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

async function panelState(ctx: Ctx): Promise<PanelState> {
  const { item, issueId } = await readItem(ctx.extension.issue.key);
  const [decisions, record, proposals] = await Promise.all([getDecisions(), getRecord(issueId), getProposals(issueId)]);
  const viewerId = ctx.accountId ?? null;
  const practice = checkHandoff(
    walkthroughHandoff(item, viewerId, bindingDecisions(decisions, item).map((d) => d.id)),
    decisions,
  );
  return {
    issueKey: ctx.extension.issue.key,
    record,
    result: record ? checkHandoff(handoffFrom(item, record), decisions) : null,
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
  const out = acknowledge(record, ctx.accountId ?? null, decisionId, binding, new Date().toISOString());
  if (!out.ok) throw new Error(`Cannot acknowledge: ${out.reason}.`);
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
  const out = confirmProposal(proposals, decisions, id, ctx.accountId, new Date().toISOString());
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

export const handler = resolver.getDefinitions();
