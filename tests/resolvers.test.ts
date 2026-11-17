import { beforeEach, describe, expect, it, vi } from "vitest";
import { MANAGE_DENIED } from "../src/authz";
import { PREPARE_DENIED } from "../src/handoff/prepare";
import { sampleDecisions } from "../src/samples/decisions";
import type { HandoffRecord, PracticeReadBackReply } from "../src/handoff/types";
import type { Decision, WorkItem } from "../src/rules/types";

// The resolvers join the admin check, Forge storage and Jira; until now only their source text was tested.
// Every store function is a mock, so a test can say exactly what was written.
const mocks = vi.hoisted(() => ({
  defined: new Map<string, (req: { context: unknown; payload?: unknown }) => Promise<unknown>>(),
  isAdmin: vi.fn(),
  openItems: vi.fn(),
  readItem: vi.fn(),
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
  readItemAsUser: mocks.readItem,
}));

import * as store from "../src/store";
import "../src/resolvers/index";

const context = { accountId: "u-admin", extension: { project: { key: "OPS" }, issue: { key: "OPS-1", id: "10001" } } };
// Same helper, with an optional caller override so a test can act as the assignee or the receiver.
const call = (name: string, payload: unknown = {}, accountId: string = context.accountId) => {
  const fn = mocks.defined.get(name);
  if (!fn) throw new Error(`no resolver ${name}`);
  return fn({ context: { ...context, accountId, extension: { ...context.extension } }, payload });
};
const writes = () =>
  [store.updateDecisions, store.putConditionDrafts, store.deleteItemData, store.deleteConditionDrafts, store.deleteRules, store.resetAudit, store.addAudit, store.purgeLegacyDecisions, store.putProposals, store.setRule, store.putRecord, store.replaceRecord].filter(
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
  mocks.readItem.mockResolvedValue({ item: { key: "OPS-1", projectKey: "OPS" }, issueId: "10001" });
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
    ["previewDecision", manual],
    ["loadSampleDecisions", {}],
    ["removeSampleDecisions", {}],
    ["confirmProposal", { proposalId: "p1" }],
    ["dismissProposal", { proposalId: "p1" }],
    ["supersedeDecision", { decisionId: "d1" }],
    ["discardConditionDraft", { draftId: "x" }],
    ["setProjectRule", { rule: "requireContingency", on: true }],
    ["previewRule", { rule: "requireContingency" }],
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

// A synthetic item shaped like tests/actions.test.ts, so panelState has real fields to read.
const workItem: WorkItem = {
  key: "OPS-1",
  projectKey: "OPS",
  summary: "Launch",
  description: "Body",
  labels: [],
  components: [],
  dueDate: "2026-12-10",
  assigneeId: "u-assignee",
};
const readAs = (item: WorkItem) => mocks.readItem.mockResolvedValue({ item, issueId: "10001" });
const noRecordWrites = () => {
  expect(store.replaceRecord).not.toHaveBeenCalled();
  expect(store.putRecord).not.toHaveBeenCalled();
  expect(store.addAudit).not.toHaveBeenCalled();
};

describe("prepare handoff", () => {
  it("refuses an empty or malformed toId and writes nothing", async () => {
    readAs(workItem);
    // Empty never reaches the id pattern; "bad id!" fails it because of the space and bang.
    for (const toId of ["", "bad id!"]) {
      await expect(call("prepareHandoff", { toId })).rejects.toThrow();
      noRecordWrites();
    }
  });

  it("refuses with PREPARE_DENIED when the caller is neither the assignee nor an administrator, and writes nothing", async () => {
    // An existing record closes the open first-prepare path, so mayPrepare must say no.
    const record = { fromId: "u-sender", toId: "u-old", acknowledged: [], preparedAt: "t", acknowledgedAt: {} } as unknown as HandoffRecord;
    readAs(workItem);
    vi.mocked(store.getRecord).mockResolvedValue(record);
    mocks.isAdmin.mockResolvedValue(false);
    await expect(call("prepareHandoff", { toId: "u-new" }, "u-stranger")).rejects.toThrow(PREPARE_DENIED);
    noRecordWrites();
  });

  it("by the assignee replaces the record with an empty protocol-1 acknowledgement and leaves one activity line", async () => {
    const old = { fromId: "u-sender", toId: "u-old", acknowledged: ["d1"], preparedAt: "t", acknowledgedAt: {} } as unknown as HandoffRecord;
    readAs(workItem);
    vi.mocked(store.getRecord).mockResolvedValue(old);
    mocks.isAdmin.mockResolvedValue(false);
    await call("prepareHandoff", { toId: "u-new" }, "u-assignee");
    expect(vi.mocked(store.replaceRecord).mock.calls.length).toBe(1);
    const [issueId, record] = vi.mocked(store.replaceRecord).mock.calls[0] as unknown as [string, HandoffRecord];
    expect(issueId).toBe("10001");
    // fromId is the caller so a later prepare can tell sender from assignee; acks never carry over.
    expect(record).toMatchObject({ fromId: "u-assignee", toId: "u-new", acknowledged: [], protocol: 1 });
    expect(vi.mocked(store.addAudit).mock.calls.length).toBe(1);
    expect(vi.mocked(store.addAudit).mock.calls[0]?.[0]).toBe("OPS");
    expect(vi.mocked(store.addAudit).mock.calls[0]?.[1]).toMatchObject({ action: "handoff_prepared", who: "u-assignee" });
  });
});

describe("acknowledge all", () => {
  // One binding decision: the first sample binds every OPS item through its project scope.
  const binding = [sampleDecisions("OPS")[0] as Decision];
  const protocolRecord = (toId: string) =>
    ({ fromId: "u-sender", toId, acknowledged: [], preparedAt: "t", acknowledgedAt: {}, protocol: 1 }) as unknown as HandoffRecord;

  it("by someone who is not the receiver writes no record", async () => {
    readAs({ ...workItem, assigneeId: "u-receiver" });
    vi.mocked(store.getDecisions).mockResolvedValue(binding);
    vi.mocked(store.getRecord).mockResolvedValue(protocolRecord("u-receiver"));
    await expect(call("acknowledgeAll", { readBack: "Work ships by the end of 2026: I will deliver by 2026-12-31." }, "u-stranger")).rejects.toThrow("no longer names you as the receiver");
    expect(store.putRecord).not.toHaveBeenCalled();
  });

  it("by the receiver with a contradicting read-back returns reasons and writes no record", async () => {
    readAs({ ...workItem, assigneeId: "u-receiver" });
    vi.mocked(store.getDecisions).mockResolvedValue(binding);
    vi.mocked(store.getRecord).mockResolvedValue(protocolRecord("u-receiver"));
    // 2027-01-15 is after the 2026-12-31 limit, so teach-back refuses it even though it names a date.
    const out = (await call("acknowledgeAll", { readBack: "I will ship on 15 January 2027" }, "u-receiver")) as { reasons?: string[] };
    expect(Array.isArray(out.reasons) && out.reasons.length > 0).toBe(true);
    expect(store.putRecord).not.toHaveBeenCalled();
  });

  it("practice: an accepted read-back carries the stand-in handoff's verdict, a refused one none, and nothing is written", async () => {
    vi.mocked(store.getDecisions).mockResolvedValue(binding);
    readAs(workItem);
    const good = (await call("practiceReadBack", { readBack: "Work ships by the end of 2026: I will deliver by 2026-12-31." })) as PracticeReadBackReply;
    expect(good.accepted).toBe(true);
    expect(good.wouldBe).toMatchObject({ verdict: "clear", findings: [] });

    readAs({ ...workItem, description: "" });
    const thin = (await call("practiceReadBack", { readBack: "Work ships by the end of 2026: I will deliver by 2026-12-31." })) as PracticeReadBackReply;
    expect(thin.wouldBe?.verdict).toBe("needs_info");
    expect(thin.wouldBe?.findings.map((f) => f.rule)).toEqual(["empty_description"]);

    const late = (await call("practiceReadBack", { readBack: "I will ship on 15 January 2027" })) as PracticeReadBackReply;
    expect(late.accepted).toBe(false);
    expect(late.wouldBe).toBeUndefined();
    noRecordWrites();
  });

  it("by the receiver with a good read-back acknowledges every binding decision", async () => {
    readAs({ ...workItem, assigneeId: "u-receiver" });
    vi.mocked(store.getDecisions).mockResolvedValue(binding);
    vi.mocked(store.getRecord).mockResolvedValue(protocolRecord("u-receiver"));
    // Names the title and answers with the limit date itself, so coverage passes and no date is late.
    await call("acknowledgeAll", { readBack: "Work ships by the end of 2026: I will deliver by 2026-12-31." }, "u-receiver");
    expect(vi.mocked(store.putRecord).mock.calls.length).toBe(1);
    const [, saved] = vi.mocked(store.putRecord).mock.calls[0] as unknown as [string, HandoffRecord];
    expect(saved.acknowledged).toEqual(expect.arrayContaining(binding.map((d) => d.id)));
  });
});

describe("what a caller sends is not trusted", () => {
  const record = (over: Partial<HandoffRecord> = {}) =>
    ({ fromId: "u-sender", toId: "u-receiver", acknowledged: [], preparedAt: "t", acknowledgedAt: {}, protocol: 1, ...over }) as unknown as HandoffRecord;

  it("prepare takes the sender and the work item from the session, whatever the payload names", async () => {
    readAs(workItem);
    await call("prepareHandoff", { toId: "u-new", fromId: "u-forged", accountId: "u-forged", issueId: "999", issueKey: "SECRET-1" }, "u-assignee");
    const [issueId, saved] = vi.mocked(store.replaceRecord).mock.calls[0] as unknown as [string, HandoffRecord];
    expect(issueId).toBe("10001");
    expect(saved.fromId).toBe("u-assignee");
    expect(mocks.readItem).toHaveBeenCalledWith("OPS-1");
  });

  it.each([
    ["acknowledgeDecision", { decisionId: "d1", accountId: "u-receiver" }, "no longer names you as the receiver"],
    ["acknowledgeReceipt", { receipt: { "d1:0": "2026-12-01" }, accountId: "u-receiver" }, "no longer names you as the receiver"],
    ["saveContingency", { text: "If the build fails then call the sender.", accountId: "u-sender" }, "Only the sender"],
  ])("%s by a person who is neither sender nor receiver writes nothing, even naming someone else", async (name, payload, says) => {
    readAs(workItem);
    vi.mocked(store.getDecisions).mockResolvedValue([sampleDecisions("OPS")[0] as Decision]);
    vi.mocked(store.getRecord).mockResolvedValue(record());
    await expect(call(name, payload, "u-stranger")).rejects.toThrow(says);
    expect(writes()).toBe(0);
  });

  it("a rule switch that is not a plain true or false, or not in the catalogue, changes nothing", async () => {
    for (const payload of [{ rule: "requireContingency", on: "yes" }, { rule: "requireContingency" }, { rule: "__proto__", on: true }, null]) {
      await expect(call("setProjectRule", payload)).rejects.toThrow();
    }
    expect(store.setRule).not.toHaveBeenCalled();
  });

  it("a receiver id that is not shaped like an account id is refused before anything is read", async () => {
    for (const toId of ["a b", "<script>", "x".repeat(129), "u-1;drop"]) {
      await expect(call("prepareHandoff", { toId })).rejects.toThrow("not a valid receiver");
    }
    expect(mocks.readItem).not.toHaveBeenCalled();
  });
});

describe("two people on one record", () => {
  const binding = [sampleDecisions("OPS")[0] as Decision];
  const record = { fromId: "u-sender", toId: "u-receiver", acknowledged: [], preparedAt: "t", acknowledgedAt: {}, protocol: 1 } as unknown as HandoffRecord;
  const good = { readBack: "Work ships by the end of 2026: I will deliver by 2026-12-31." };

  it("an acknowledgement that loses the race to another save is refused whole: the error reaches the receiver and no activity line claims it", async () => {
    readAs({ ...workItem, assigneeId: "u-receiver" });
    vi.mocked(store.getDecisions).mockResolvedValue(binding);
    vi.mocked(store.getRecord).mockResolvedValue(record);
    vi.mocked(store.putRecord).mockRejectedValueOnce(new Error("This handoff was changed a moment ago by someone else. Reload the panel and try again."));
    await expect(call("acknowledgeAll", good, "u-receiver")).rejects.toThrow("changed a moment ago");
    expect(store.addAudit).not.toHaveBeenCalled();
  });

  it("a decision retired while the receiver was typing is not acknowledged: the read-back is checked against what is in force at that moment", async () => {
    readAs({ ...workItem, assigneeId: "u-receiver" });
    vi.mocked(store.getDecisions).mockResolvedValue(binding.map((d) => ({ ...d, status: "superseded" }) as Decision));
    vi.mocked(store.getRecord).mockResolvedValue(record);
    await expect(call("acknowledgeAll", good, "u-receiver")).rejects.toThrow("No decision applies to this work item any more");
    expect(store.putRecord).not.toHaveBeenCalled();
  });

  it("the due date stored with an acknowledgement is the one Jira has at that moment, not the one the panel showed", async () => {
    readAs({ ...workItem, assigneeId: "u-receiver", dueDate: "2026-12-24" });
    vi.mocked(store.getDecisions).mockResolvedValue(binding);
    vi.mocked(store.getRecord).mockResolvedValue(record);
    await call("acknowledgeAll", good, "u-receiver");
    const [, saved] = vi.mocked(store.putRecord).mock.calls[0] as unknown as [string, HandoffRecord];
    expect(JSON.stringify(saved.acknowledgedWith)).toContain("2026-12-24");
  });
});
