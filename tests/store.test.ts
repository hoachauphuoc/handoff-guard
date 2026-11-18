import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuditEvent } from "../src/audit";
import type { Decision } from "../src/rules/types";

// An in-memory store with Forge's conditional transaction: every condition is checked, then every write is
// made, in one step. `beforeCommit` lets a test land another writer's save between the reads and the commit.
const data = new Map<string, unknown>();
const entities = new Map<string, unknown>();
let beforeCommit: (() => void) | null = null;
type Clause = { op: "eq"; v: unknown } | { op: "nx" };
vi.mock("@forge/kvs", () => {
  class Filter {
    items: [string, Clause][] = [];
    and(field: string, c: Clause) {
      this.items.push([field, c]);
      return this;
    }
  }
  const holds = (current: Record<string, unknown> | undefined, f: Filter) =>
    f.items.every(([field, c]) => (c.op === "nx" ? current?.[field] === undefined : current?.[field] === c.v));
  type Op = { k: string; v: unknown; e?: { entityName: string; conditions?: Filter } };
  return {
    Filter,
    FilterConditions: { equalTo: (v: unknown) => ({ op: "eq", v }), notExists: () => ({ op: "nx" }) },
    WhereConditions: { beginsWith: (v: string) => v },
    kvs: {
      // Keys in order, pages of `limit`, the cursor being the index of the next key.
      query: () => {
        let prefix = "";
        let size = 100;
        let from = 0;
        const q = {
          where: (_f: string, p: string) => ((prefix = p), q),
          limit: (n: number) => ((size = n), q),
          cursor: (c: string) => ((from = Number(c)), q),
          getMany: async () => {
            const keys = [...data.keys()].filter((k) => k.startsWith(prefix)).sort();
            const page = keys.slice(from, from + size);
            return { results: page.map((key) => ({ key, value: data.get(key) })), nextCursor: from + size < keys.length ? String(from + size) : undefined };
          },
        };
        return q;
      },
      get: async (k: string) => data.get(k),
      set: async (k: string, v: unknown) => void data.set(k, v),
      delete: async (k: string) => void data.delete(k),
      entity: (name: string) => ({
        get: async (k: string) => entities.get(`${name}/${k}`),
        delete: async (k: string) => void entities.delete(`${name}/${k}`),
      }),
      transact: () => {
        const ops: Op[] = [];
        const builder = {
          set(k: string, v: unknown, e?: Op["e"]) {
            ops.push({ k, v, e });
            return builder;
          },
          async execute() {
            const hook = beforeCommit;
            beforeCommit = null;
            hook?.();
            for (const o of ops) {
              if (o.e?.conditions && !holds(entities.get(`${o.e.entityName}/${o.k}`) as Record<string, unknown> | undefined, o.e.conditions)) {
                throw new Error("condition not met");
              }
            }
            for (const o of ops) (o.e ? entities.set(`${o.e.entityName}/${o.k}`, o.v) : data.set(o.k, o.v));
          },
        };
        return builder;
      },
    },
  };
});
const { getDecisions, updateDecisions } = await import("../src/store");

const dec = (id: string, projectKey: string): Decision => ({
  id,
  title: id,
  status: "decided",
  source: { kind: "ledger", ref: "x" },
  scope: { kind: "project", projectKey },
  constraints: [{ kind: "dueNotAfter", date: "2026-12-31" }],
});

beforeEach(() => {
  data.clear();
  entities.clear();
  beforeCommit = null;
});

describe("per-project decisions", () => {
  it("reads this project's decisions from the old site-wide key until the new key exists, and never writes the old key", async () => {
    data.set("decisions", [dec("a", "OPS"), dec("b", "HR")]);
    expect((await getDecisions("OPS")).map((d) => d.id)).toEqual(["a"]);
    await updateDecisions("OPS", (c) => [...c, dec("c", "OPS")]);
    expect((await getDecisions("OPS")).map((d) => d.id)).toEqual(["a", "c"]);
    expect((data.get("decisions") as Decision[]).map((d) => d.id)).toEqual(["a", "b"]);
  });

  it("keeps projects apart", async () => {
    await updateDecisions("OPS", () => [dec("a", "OPS")]);
    await updateDecisions("HR", () => [dec("b", "HR")]);
    expect((await getDecisions("OPS")).map((d) => d.id)).toEqual(["a"]);
    expect((await getDecisions("HR")).map((d) => d.id)).toEqual(["b"]);
  });

  it("does not store a decision that belongs to another project", async () => {
    await updateDecisions("OPS", () => [dec("a", "OPS"), dec("b", "HR")]);
    expect((await getDecisions("OPS")).map((d) => d.id)).toEqual(["a"]);
  });

  it("refuses a save when someone else saved in between, and keeps theirs", async () => {
    await updateDecisions("OPS", () => [dec("a", "OPS")]);
    beforeCommit = () => {
      data.set("decisions:ops", { version: 2, decisions: [dec("theirs", "OPS")] });
      entities.set("revision/rev:decisions:ops", { rev: 2 });
    };
    await expect(updateDecisions("OPS", (c) => [...c, dec("mine", "OPS")])).rejects.toThrow("Someone else changed");
    expect((await getDecisions("OPS")).map((d) => d.id)).toEqual(["theirs"]);
  });

  it("refuses one of two saves started in the same instant from the same copy", async () => {
    await updateDecisions("OPS", () => [dec("a", "OPS")]);
    const results = await Promise.allSettled([
      updateDecisions("OPS", (c) => [...c, dec("b", "OPS")]),
      updateDecisions("OPS", (c) => [...c, dec("c", "OPS")]),
    ]);
    expect(results.filter((r) => r.status === "rejected")).toHaveLength(1);
    expect((await getDecisions("OPS")).length).toBe(2);
  });
});

describe("purgeLegacyDecisions", () => {
  it("removes only this project's decisions from the old key and keeps an old site-wide label decision", async () => {
    const { purgeLegacyDecisions } = await import("../src/store");
    const siteWide: Decision = { ...dec("l", "OPS"), scope: { kind: "label", label: "launch" } };
    data.set("decisions", [dec("a", "OPS"), dec("b", "HR"), siteWide]);
    expect(await purgeLegacyDecisions("ops")).toBe(1);
    expect((data.get("decisions") as Decision[]).map((d) => d.id)).toEqual(["b", "l"]);
  });
});

describe("handoff record saves", () => {
  const rec = { fromId: "a", toId: "b", acknowledged: [], preparedAt: "2026-11-14T00:00:00Z", acknowledgedAt: {} };
  it("refuses a save made from an older copy, and lets a new handoff replace the record", async () => {
    const { getRecord, putRecord, replaceRecord, RECORD_CHANGED } = await import("../src/store");
    await replaceRecord("1", rec);
    const first = (await getRecord("1"))!;
    const second = (await getRecord("1"))!;
    await putRecord("1", { ...first, acknowledged: ["d1"] });
    await expect(putRecord("1", { ...second, contingency: "if x then y" })).rejects.toThrow(RECORD_CHANGED);
    expect((await getRecord("1"))?.acknowledged).toEqual(["d1"]);
    await replaceRecord("1", rec);
    expect((await getRecord("1"))?.acknowledged).toEqual([]);
  });

  it("keeps the save count rising across a replacement, so a change made from the old record is refused", async () => {
    const { getRecord, putRecord, replaceRecord, RECORD_CHANGED } = await import("../src/store");
    await replaceRecord("2", rec);
    const old = (await getRecord("2"))!;
    await replaceRecord("2", { ...rec, toId: "c" });
    await expect(putRecord("2", { ...old, acknowledged: ["d1"] })).rejects.toThrow(RECORD_CHANGED);
    expect((await getRecord("2"))?.toId).toBe("c");
  });

  it("refuses one of two saves started in the same instant, so neither change is lost without a message", async () => {
    const { getRecord, putRecord, replaceRecord, RECORD_CHANGED } = await import("../src/store");
    await replaceRecord("3", rec);
    const copy = (await getRecord("3"))!;
    const results = await Promise.allSettled([putRecord("3", { ...copy, acknowledged: ["d1"] }), putRecord("3", { ...copy, contingency: "if x then y" })]);
    expect(results.map((r) => r.status)).toEqual(["fulfilled", "rejected"]);
    expect((results[1] as PromiseRejectedResult).reason.message).toBe(RECORD_CHANGED);
    const kept = (await getRecord("3"))!;
    expect(kept.acknowledged).toEqual(["d1"]);
    expect(kept.contingency).toBeUndefined();
  });

  it("refuses a change when another save lands between the read and the commit", async () => {
    const { getRecord, putRecord, replaceRecord, RECORD_CHANGED } = await import("../src/store");
    await replaceRecord("5", rec);
    const copy = (await getRecord("5"))!;
    beforeCommit = () => {
      data.set("handoff:5", { ...copy, acknowledged: ["theirs"], rev: copy.rev! + 1 });
      entities.set("revision/rev:handoff:5", { rev: copy.rev! + 1 });
    };
    await expect(putRecord("5", { ...copy, acknowledged: ["mine"] })).rejects.toThrow(RECORD_CHANGED);
    expect((await getRecord("5"))?.acknowledged).toEqual(["theirs"]);
  });

  it("takes over a record saved before revisions existed, then guards it", async () => {
    const { getRecord, putRecord, RECORD_CHANGED } = await import("../src/store");
    data.set("handoff:4", { ...rec, rev: 5 });
    const copy = (await getRecord("4"))!;
    await putRecord("4", { ...copy, acknowledged: ["d1"] });
    expect(entities.get("revision/rev:handoff:4")).toEqual({ rev: 6 });
    await expect(putRecord("4", { ...copy, acknowledged: ["d2"] })).rejects.toThrow(RECORD_CHANGED);
  });

  it("a replacement saved in the same instant as a change still wins, by reading again", async () => {
    const { getRecord, putRecord, replaceRecord } = await import("../src/store");
    await replaceRecord("6", rec);
    const copy = (await getRecord("6"))!;
    await Promise.allSettled([putRecord("6", { ...copy, acknowledged: ["d1"] }), replaceRecord("6", { ...rec, toId: "c" })]);
    expect((await getRecord("6"))?.toId).toBe("c");
  });
});

describe("storedItemIds", () => {
  it("lists every work item with a handoff, proposals or a read-back draft, once, across pages", async () => {
    const { storedItemIds } = await import("../src/store");
    for (let i = 0; i < 150; i++) data.set(`handoff:${1000 + i}`, {});
    data.set("proposals:1000", []);
    data.set("proposals:7", []);
    data.set("receipt-draft:8", {});
    data.set("decisions:ops", { version: 1, decisions: [] });
    const { ids, capped } = await storedItemIds();
    expect(capped).toBe(false);
    expect(ids).toHaveLength(152);
    expect(ids).toEqual(expect.arrayContaining(["1000", "1149", "7", "8"]));
  });

  it("says when the list was cut", async () => {
    const { storedItemIds, STORED_ITEM_CAP } = await import("../src/store");
    for (let i = 0; i <= STORED_ITEM_CAP; i++) data.set(`handoff:${i}`, {});
    const { ids, capped } = await storedItemIds();
    expect(capped).toBe(true);
    expect(ids).toHaveLength(STORED_ITEM_CAP);
  });
});

describe("project rules", () => {
  it("are off until stored, per project", async () => {
    const { getRules, setRule } = await import("../src/store");
    expect(await getRules("OPS")).toMatchObject({ requireContingency: false, requireIfThen: false });
    await setRule("OPS", "requireContingency", true);
    expect(await getRules("ops")).toMatchObject({ requireContingency: true, requireIfThen: false });
    expect(await getRules("HR")).toMatchObject({ requireContingency: false, requireIfThen: false });
  });

  it("switching one rule keeps the others", async () => {
    const { getRules, setRule } = await import("../src/store");
    await setRule("OPS", "requireContingency", true);
    await setRule("OPS", "requireIfThen", true);
    expect(await getRules("OPS")).toMatchObject({ requireContingency: true, requireIfThen: true });
  });

  it("two rules switched in the same instant both stay on", async () => {
    const { getRules, setRule } = await import("../src/store");
    await Promise.all([setRule("OPS", "requireContingency", true), setRule("OPS", "requireIfThen", true)]);
    expect(await getRules("OPS")).toMatchObject({ requireContingency: true, requireIfThen: true });
  });

  it("redoes a switch on what another administrator saved between the read and the commit", async () => {
    const { getRules, setRule } = await import("../src/store");
    beforeCommit = () => {
      data.set("settings:ops", { requireIfThen: true });
      entities.set("revision/rev:settings:ops", { rev: 1 });
    };
    await setRule("OPS", "requireContingency", true);
    expect(await getRules("OPS")).toMatchObject({ requireContingency: true, requireIfThen: true });
  });

  it("gives up with an error when every attempt clashes", async () => {
    const { setRule } = await import("../src/store");
    let n = 0;
    const clash = () => {
      entities.set("revision/rev:settings:ops", { rev: 100 + n++ });
      if (n < 3) beforeCommit = clash;
    };
    beforeCommit = clash;
    await expect(setRule("OPS", "requireContingency", true)).rejects.toThrow("kept changing");
  });
});

describe("activity list", () => {
  const ev = (n: number): AuditEvent => ({ at: `2026-11-18T00:00:0${n}Z`, who: "a", action: "decision_added", ref: `e${n}` });

  it("keeps both events appended in the same instant", async () => {
    const { addAudit, getAudit } = await import("../src/store");
    await Promise.all([addAudit("OPS", ev(1)), addAudit("OPS", ev(2))]);
    expect(await getAudit("OPS")).toHaveLength(2);
  });

  it("a reset is not undone by an append that read the old list", async () => {
    const { addAudit, getAudit, resetAudit } = await import("../src/store");
    await addAudit("OPS", ev(1));
    // The reset lands while the append is between its read and its commit.
    beforeCommit = () => {
      data.set("audit:ops", [ev(9)]);
      entities.set("revision/rev:audit:ops", { rev: 2 });
    };
    await addAudit("OPS", ev(2));
    await resetAudit("HR", ev(9));
    expect(entities.get("revision/rev:audit:hr")).toEqual({ rev: 1 });
    const kept = await getAudit("OPS");
    expect(kept.map((e) => e.ref)).toEqual(["e2", "e9"]);
  });
});
