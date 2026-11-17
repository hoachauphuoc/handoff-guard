import { beforeEach, describe, expect, it, vi } from "vitest";
import { THIRD_PERSON } from "../src/handoff/build";
import type { HandoffRecord } from "../src/handoff/types";
import { NO_RULES, type Decision } from "../src/rules/types";

const mocks = vi.hoisted(() => ({
  requestJira: vi.fn(),
  getDecisions: vi.fn(),
  getRecord: vi.fn(),
  getRules: vi.fn(),
  withConditions: vi.fn(async (rows: unknown[]) => rows),
}));

vi.mock("@forge/api", () => ({
  default: { asApp: () => ({ requestJira: mocks.requestJira }) },
  route: (strings: TemplateStringsArray, ...values: unknown[]) =>
    strings.reduce((acc, part, idx) => acc + part + (idx < values.length ? String(values[idx]) : ""), ""),
}));

vi.mock("../src/store", async () => {
  // Hoisted factories run before top-level imports, so NO_RULES must come from importActual here.
  const { NO_RULES: defaultRules } = await vi.importActual<typeof import("../src/rules/types")>("../src/rules/types");
  mocks.getRules.mockResolvedValue(defaultRules);
  return {
    getDecisions: mocks.getDecisions,
    getRecord: mocks.getRecord,
    getRules: mocks.getRules,
  };
});

vi.mock("../src/jira", async () => {
  const actual = await vi.importActual<typeof import("../src/jira")>("../src/jira");
  return {
    ...actual,
    withConditions: mocks.withConditions,
  };
});

import { withConditions } from "../src/jira";
import { validate, validateDecisions } from "../src/validator";

type JiraOverrides = {
  project?: { key: string };
  summary?: string;
  description?: string;
  labels?: string[];
  components?: { name: string }[];
  duedate?: string | null;
  assignee?: { accountId: string } | null;
};

const jiraIssue = (overrides: JiraOverrides = {}) => ({
  ok: true,
  status: 200,
  json: async () => ({
    id: "10001",
    fields: {
      project: { key: "ABC" },
      summary: "Prepare release notes",
      // A non-empty description and due date keep unrelated baseline rules from masking the check under test.
      description: "Details for the handoff.",
      labels: [],
      components: [],
      duedate: "2026-05-20",
      assignee: { accountId: "to" },
      ...overrides,
    },
  }),
});

const dueDecision: Decision = {
  id: "d1",
  title: "Ship before freeze",
  status: "decided",
  source: { kind: "ledger", ref: "L-1" },
  scope: { kind: "project", projectKey: "ABC" },
  constraints: [{ kind: "dueNotAfter", date: "2026-06-01" }],
};

const baseRecord: HandoffRecord = {
  fromId: "from",
  toId: "to",
  acknowledged: [],
  preparedAt: "2026-05-01T00:00:00.000Z",
  acknowledgedAt: {},
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getDecisions.mockResolvedValue([]);
  mocks.getRecord.mockResolvedValue(null);
  mocks.getRules.mockResolvedValue(NO_RULES);
  mocks.withConditions.mockImplementation(async (rows: unknown[]) => rows);
  mocks.requestJira.mockResolvedValue(jiraIssue());
});

describe("validator", () => {
  it("fails closed with the standard prefix when Jira returns 404", async () => {
    mocks.requestJira.mockResolvedValue({ ok: false, status: 404, json: async () => ({}) });

    const res = await validate({ issue: { key: "ABC-1" } });

    expect(res.result).toBe(false);
    expect(res.errorMessage).toMatch(/^Handoff Guard could not check this work item/);
  });

  it("fails closed when requestJira throws", async () => {
    mocks.requestJira.mockRejectedValue(new Error("network failure"));

    const res = await validate({ issue: { key: "ABC-1" } });

    expect(res.result).toBe(false);
    expect(res.errorMessage).toMatch(/^Handoff Guard could not check this work item/);
  });

  it("refuses the transition when no handoff record exists", async () => {
    const res = await validate({ issue: { key: "ABC-1" } });

    expect(res).toEqual({
      result: false,
      errorMessage: "Prepare the handoff in the Handoff Guard panel first.",
    });
  });

  it("refuses when the item breaks a binding date decision", async () => {
    mocks.requestJira.mockResolvedValue(jiraIssue({ duedate: "2026-06-15" }));
    mocks.getDecisions.mockResolvedValue([dueDecision]);
    mocks.getRecord.mockResolvedValue({
      ...baseRecord,
      acknowledged: ["d1"],
      acknowledgedAt: { d1: "2026-05-01T00:00:00.000Z" },
    });

    const res = await validate({ issue: { key: "ABC-1" } });

    expect(res.result).toBe(false);
  });

  it("refuses a Clear handoff when the assignee is a third person", async () => {
    mocks.requestJira.mockResolvedValue(jiraIssue({ assignee: { accountId: "other" } }));
    mocks.getRecord.mockResolvedValue(baseRecord);

    const res = await validate({ issue: { key: "ABC-1" } });

    expect(res).toEqual({ result: false, errorMessage: THIRD_PERSON });
  });

  it("allows a Clear handoff when the assignee is the receiver", async () => {
    mocks.requestJira.mockResolvedValue(jiraIssue({ assignee: { accountId: "to" } }));
    mocks.getRecord.mockResolvedValue(baseRecord);

    const res = await validate({ issue: { key: "ABC-1" } });

    expect(res).toEqual({ result: true });
  });

  it("applies transition.modifiedFields duedate before checking decisions", async () => {
    mocks.requestJira.mockResolvedValue(jiraIssue({ duedate: "2026-05-20", assignee: { accountId: "to" } }));
    mocks.getDecisions.mockResolvedValue([dueDecision]);
    mocks.getRecord.mockResolvedValue({
      ...baseRecord,
      acknowledged: ["d1"],
      acknowledgedAt: { d1: "2026-05-01T00:00:00.000Z" },
    });

    // The same stored item passes on its own, so the refusal can only come from the changed field.
    expect(await validate({ issue: { key: "ABC-1" } })).toEqual({ result: true });

    const res = await validate({
      issue: { key: "ABC-1" },
      transition: { modifiedFields: { duedate: "2026-06-15" } },
    });

    expect(res.result).toBe(false);
  });

  it("validateDecisions refuses an item breaking a decision and allows one breaking none", async () => {
    mocks.getDecisions.mockResolvedValue([dueDecision]);

    mocks.requestJira.mockResolvedValueOnce(jiraIssue({ duedate: "2026-06-15" }));
    const refused = await validateDecisions({ issue: { key: "ABC-1" } });
    expect(refused.result).toBe(false);

    mocks.requestJira.mockResolvedValueOnce(jiraIssue({ duedate: "2026-05-20" }));
    const allowed = await validateDecisions({ issue: { key: "ABC-1" } });
    expect(allowed).toEqual({ result: true });
  });

  it("evaluates conditions as the app", async () => {
    mocks.getRecord.mockResolvedValue(baseRecord);

    await validate({ issue: { key: "ABC-1" } });
    await validateDecisions({ issue: { key: "ABC-1" } });

    expect(withConditions).toHaveBeenNthCalledWith(1, expect.any(Array), expect.any(Array), "app");
    expect(withConditions).toHaveBeenNthCalledWith(2, expect.any(Array), expect.any(Array), "app");
  });

  it("fails closed when reading the decisions fails", async () => {
    mocks.getDecisions.mockRejectedValue(new Error("storage failure"));

    const [a, b] = await Promise.all([validate({ issue: { key: "ABC-1" } }), validateDecisions({ issue: { key: "ABC-1" } })]);

    for (const res of [a, b]) {
      expect(res.result).toBe(false);
      expect(res.errorMessage).toMatch(/^Handoff Guard could not check this work item/);
    }
  });

  it("fails closed when reading the handoff record fails", async () => {
    mocks.getRecord.mockRejectedValueOnce(new Error("storage failure"));

    const res = await validate({ issue: { key: "ABC-1" } });

    expect(res.result).toBe(false);
    expect(res.errorMessage).toMatch(/^Handoff Guard could not check this work item/);
  });

  it("fails closed when evaluating the filter fails, for both entry points", async () => {
    mocks.withConditions.mockRejectedValueOnce(new Error("jira failure"));
    const gated = await validate({ issue: { key: "ABC-1" } });
    expect(gated.result).toBe(false);
    expect(gated.errorMessage).toMatch(/^Handoff Guard could not check this work item/);

    mocks.withConditions.mockRejectedValueOnce(new Error("jira failure"));
    const decisionsOnly = await validateDecisions({ issue: { key: "ABC-1" } });
    expect(decisionsOnly.result).toBe(false);
    expect(decisionsOnly.errorMessage).toMatch(/^Handoff Guard could not check this work item/);
  });
});
