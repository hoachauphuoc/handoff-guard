import Resolver from "@forge/resolver";
import { acknowledge } from "../handoff/acknowledge";
import { handoffFrom } from "../handoff/build";
import type { HandoffRecord, PanelState } from "../handoff/types";
import { readItemAsUser as readItem } from "../jira";
import { bindingDecisions, checkHandoff } from "../rules/checkHandoff";
import { mergeDecisions, sampleDecisions } from "../samples/decisions";
import { getDecisions, getRecord, putDecisions, putRecord } from "../store";

const resolver = new Resolver();

type Ctx = { accountId?: string; extension: { issue: { key: string; id: string } } };

async function panelState(ctx: Ctx): Promise<PanelState> {
  const { item, issueId } = await readItem(ctx.extension.issue.key);
  const [decisions, record] = await Promise.all([getDecisions(), getRecord(issueId)]);
  const viewerId = ctx.accountId ?? null;
  return {
    record,
    result: record ? checkHandoff(handoffFrom(item, record), decisions) : null,
    viewerId,
    isReceiver: record !== null && viewerId !== null && viewerId === record.toId,
    decisionCount: decisions.length,
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

export const handler = resolver.getDefinitions();
