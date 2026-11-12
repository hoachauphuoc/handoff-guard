import api, { route } from "@forge/api";
import Resolver from "@forge/resolver";
import { checkHandoff } from "../rules/checkHandoff";
import type { HandoffResult, WorkItem } from "../rules/types";

const resolver = new Resolver();

// API v2 returns the description as plain text; v3 returns a document tree the rules cannot read.
const FIELDS = "summary,description,labels,components,duedate,assignee,project";

resolver.define("previewHandoff", async ({ context }): Promise<HandoffResult> => {
  const key: string = context.extension.issue.key;
  const res = await api.asApp().requestJira(route`/rest/api/2/issue/${key}?fields=${FIELDS}`);
  if (!res.ok) throw new Error(`Jira returned ${res.status} for ${key}`);
  const { fields } = await res.json();

  const item: WorkItem = {
    key,
    projectKey: fields.project.key,
    summary: fields.summary ?? "",
    description: fields.description ?? "",
    labels: fields.labels ?? [],
    components: (fields.components ?? []).map((c: { name: string }) => c.name),
    dueDate: fields.duedate ?? null,
    assigneeId: fields.assignee?.accountId ?? null,
  };
  // Preview only: the viewer hands the item to its current assignee. No decisions are stored yet.
  return checkHandoff({ item, fromId: context.accountId ?? null, toId: item.assigneeId, acknowledged: [] }, []);
});

export const handler = resolver.getDefinitions();
