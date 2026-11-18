import { beforeEach, describe, expect, it, vi } from "vitest";

// Export and delete find a project's records through Jira's bulk fetch; this pins what it sends and keeps.
const calls: { batch: string[] }[] = [];
let issuesFor: (batch: string[]) => { id: string; key: string; fields: { project: { key: string } } }[] = () => [];
vi.mock("@forge/api", () => ({
  default: {
    asUser: () => ({
      requestJira: async (_route: unknown, init: { body: string }) => {
        const batch = (JSON.parse(init.body) as { issueIdsOrKeys: string[] }).issueIdsOrKeys;
        calls.push({ batch });
        return { status: 200, ok: true, json: async () => ({ issues: issuesFor(batch), issueErrors: [] }) };
      },
    }),
  },
  route: () => "",
}));
vi.mock("../src/store", () => ({ getDecisions: async () => [] }));

const { projectItemsAmongAsUser } = await import("../src/jira");

beforeEach(() => {
  calls.length = 0;
});

describe("projectItemsAmongAsUser", () => {
  it("asks in batches of 100 and keeps only the items Jira places in the project", async () => {
    issuesFor = (batch) => batch.map((id) => ({ id, key: `${Number(id) % 2 ? "HR" : "OPS"}-${id}`, fields: { project: { key: Number(id) % 2 ? "HR" : "OPS" } } }));
    const ids = Array.from({ length: 250 }, (_, i) => String(i + 1));
    const found = await projectItemsAmongAsUser("ops", ids);
    expect(calls.map((c) => c.batch.length)).toEqual([100, 100, 50]);
    expect(found).toHaveLength(125);
    expect(found.every((f) => f.key.startsWith("OPS-"))).toBe(true);
  });

  it("never sends an id that is not a number, and asks nothing for an empty list", async () => {
    issuesFor = () => [];
    await projectItemsAmongAsUser("OPS", []);
    expect(calls).toHaveLength(0);
    await projectItemsAmongAsUser("OPS", ["12", "x) OR 1=1", "13"]);
    expect(calls[0]!.batch).toEqual(["12", "13"]);
  });
});
