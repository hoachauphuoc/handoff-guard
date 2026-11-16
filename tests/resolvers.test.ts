import { beforeEach, describe, expect, it, vi } from "vitest";
import { MANAGE_DENIED } from "../src/authz";

// The resolvers join the admin check, Forge storage and Jira; until now only their source text was tested.
// Every store function is a mock, so a test can say exactly what was written.
const mocks = vi.hoisted(() => ({
  defined: new Map<string, (req: { context: unknown; payload?: unknown }) => Promise<unknown>>(),
  isAdmin: vi.fn(),
  openItems: vi.fn(),
}));

vi.mock("@forge/resolver", () => ({
  default: class {
    define(name: string, fn: (req: { context: unknown; payload?: unknown }) => Promise<unknown>) {
      mocks.defined.set(name, fn);
    }
    getDefinitions() {
      return {};
    }
  },
}));

// Nothing here may reach a Forge runtime: storage, the model call and Jira are all replaced.
vi.mock("@forge/kvs", () => ({ kvs: {} }));
vi.mock("@forge/api", () => ({ default: {}, route: () => "", asUser: () => ({}), asApp: () => ({}) }));
vi.mock("../src/llm", () => ({ explainRefusal: vi.fn() }));
vi.mock("../src/store");

vi.mock("../src/jira", async () => ({
  ...(await vi.importActual<typeof import("../src/jira")>("../src/jira")),
  isProjectAdminAsUser: mocks.isAdmin,
  openItemsAsUser: mocks.openItems,
}));

import * as store from "../src/store";
import "../src/resolvers/index";

const context = { accountId: "u-admin", extension: { project: { key: "OPS" } } };
const call = (name: string, payload: unknown = {}) => {
  const fn = mocks.defined.get(name);
  if (!fn) throw new Error(`no resolver ${name}`);
  return fn({ context, payload });
};
const writes = () =>
  [store.updateDecisions, store.putConditionDrafts, store.deleteItemData, store.deleteConditionDrafts, store.deleteRules, store.resetAudit, store.addAudit, store.purgeLegacyDecisions].filter(
    (f) => vi.mocked(f).mock.calls.length > 0,
  ).length;

const items = [
  { issueId: "101", item: { key: "OPS-1" } },
  { issueId: "102", item: { key: "OPS-2" } },
];

beforeEach(() => {
  vi.clearAllMocks();
  mocks.isAdmin.mockResolvedValue(true);
  mocks.openItems.mockResolvedValue({ items, capped: false });
  vi.mocked(store.getDecisions).mockResolvedValue([]);
  vi.mocked(store.getConditionDrafts).mockResolvedValue([]);
  vi.mocked(store.getAudit).mockResolvedValue([]);
  vi.mocked(store.getProposals).mockResolvedValue([]);
  vi.mocked(store.getRecord).mockResolvedValue(null);
  vi.mocked(store.getDraft).mockResolvedValue(null);
  vi.mocked(store.getRules).mockResolvedValue({} as never);
});

describe("project administrator gate", () => {
  const manual = { title: "Ships by the end of 2026", scope: "project", scopeValue: "", constraint: "dueNotAfter", constraintValue: "2026-12-31", supersede: false };

  it.each([
    ["addDecision", manual],
    ["confirmConditionDraft", { draftId: "x" }],
    ["exportProject", {}],
    ["deleteProjectData", { confirm: "OPS" }],
  ])("%s refuses a person who is not a project administrator and writes nothing", async (name, payload) => {
    mocks.isAdmin.mockResolvedValue(false);
    await expect(call(name, payload)).rejects.toThrow(MANAGE_DENIED);
    expect(writes()).toBe(0);
  });
});

describe("delete project data", () => {
  it("needs the project key typed, and deletes nothing without it", async () => {
    await expect(call("deleteProjectData", { confirm: "NOPE" })).rejects.toThrow("Type the project key OPS");
    expect(writes()).toBe(0);
  });

  it("clears every per-project key and each open item's data, and leaves one activity line", async () => {
    expect(await call("deleteProjectData", { confirm: "ops" })).toEqual({ items: 2, capped: false });
    expect(vi.mocked(store.deleteItemData).mock.calls.map((c) => c[0])).toEqual(["101", "102"]);
    expect(store.updateDecisions).toHaveBeenCalledWith("OPS", expect.any(Function));
    expect(store.purgeLegacyDecisions).toHaveBeenCalledWith("OPS");
    expect(store.deleteConditionDrafts).toHaveBeenCalledWith("OPS");
    expect(store.deleteRules).toHaveBeenCalledWith("OPS");
    expect(store.resetAudit).toHaveBeenCalledWith("OPS", expect.objectContaining({ action: "data_deleted", ref: "OPS" }));
  });
});

describe("export project data", () => {
  it("returns every kind of stored record the privacy page lists, per open item where it is per item", async () => {
    vi.mocked(store.getRecord).mockImplementation(async (id: string) => (id === "101" ? ({ fromId: "a", toId: "b" } as never) : null));
    vi.mocked(store.getDraft).mockImplementation(async (id: string) => (id === "102" ? ({ slots: [] } as never) : null));
    const out = JSON.parse(String(await call("exportProject")));
    expect(Object.keys(out)).toEqual(expect.arrayContaining(["rules", "decisions", "drafts", "handoffs", "proposals", "readBackDrafts", "activity"]));
    expect(out.handoffs.map((h: { key: string }) => h.key)).toEqual(["OPS-1"]);
    expect(out.readBackDrafts.map((h: { key: string }) => h.key)).toEqual(["OPS-2"]);
    expect(writes()).toBe(0);
  });
});
