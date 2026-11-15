import { describe, expect, it } from "vitest";
import { acknowledgeWithReceipt, checkReceipt, slotsFor } from "../src/handoff/receipt";
import type { HandoffRecord } from "../src/handoff/types";
import type { Decision } from "../src/rules/types";

const NOW = "2026-11-15T00:00:00.000Z";
const FP = { dueDate: "2026-12-10", labels: [], components: [], summary: "s", description: "d" } as never;
const dec = (id: string, constraints: Decision["constraints"]): Decision => ({
  id,
  title: id,
  status: "decided",
  source: { kind: "ledger", ref: "x" },
  scope: { kind: "project", projectKey: "OPS" },
  constraints,
});
const due = dec("ship", [{ kind: "dueNotAfter", date: "2026-12-31" }]);
const legal = dec("legal", [{ kind: "labelRequired", label: "legal-reviewed" }]);
const billing = dec("billing", [{ kind: "componentForbidden", component: "legacy-billing" }]);
const bare = dec("note", []);
const binding = [due, legal, billing, bare];
const good = { "ship:0": "2026-12-15", "legal:0": "yes", "billing:0": "yes", "note:0": "yes" };
const record: HandoffRecord = { fromId: "a", toId: "b", acknowledged: [], preparedAt: NOW, acknowledgedAt: {}, protocol: 1, readBack: "older words" };

describe("slotsFor", () => {
  it("gives one typed slot per constraint, and one for a decision with none", () => {
    expect(slotsFor(binding).map((s) => [s.key, s.kind])).toEqual([
      ["ship:0", "date"],
      ["legal:0", "confirm"],
      ["billing:0", "confirm"],
      ["note:0", "confirm"],
    ]);
    expect(slotsFor([legal])[0]?.ask).toBe('I will keep the label "legal-reviewed" on this work item.');
    expect(slotsFor([billing])[0]?.ask).toBe('I will not add the component "legacy-billing" to this work item.');
  });
});

describe("checkReceipt", () => {
  it("accepts answers inside every decision", () => {
    expect(checkReceipt(good, binding)).toEqual([]);
    expect(checkReceipt({ ...good, "ship:0": "2026-12-31", "legal:0": " Yes " }, binding)).toEqual([]);
  });
  it("refuses a later date with both dates in the reason", () => {
    expect(checkReceipt({ ...good, "ship:0": "2027-01-15" }, binding)).toEqual(['Your receipt gives 2027-01-15, later than 2026-12-31, the latest date "ship" allows.']);
  });
  it("refuses a missing answer, a date that is not a date, and a no", () => {
    expect(checkReceipt({}, binding)).toHaveLength(4);
    expect(checkReceipt({ ...good, "ship:0": "next week" }, binding)[0]).toContain("YYYY-MM-DD");
    expect(checkReceipt({ ...good, "legal:0": "no" }, binding)[0]).toContain('"legal" is not met');
    expect(checkReceipt({ ...good, "billing:0": "maybe" }, binding)).toHaveLength(1);
  });
});

describe("acknowledgeWithReceipt", () => {
  it("acknowledges every binding decision, stores only the typed answers and drops the older read-back", () => {
    const out = acknowledgeWithReceipt(record, "b", binding, { ...good, stray: "x" }, NOW, FP);
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.record.acknowledged).toEqual(["ship", "legal", "billing", "note"]);
    expect(out.record.receipt).toEqual(good);
    expect(out.record.readBack).toBeUndefined();
    expect(out.record.acknowledgedAt).toMatchObject({ ship: NOW, note: NOW });
  });
  it("is for the receiver only, and a refused receipt changes nothing", () => {
    expect(acknowledgeWithReceipt(record, "a", binding, good, NOW, FP)).toEqual({ ok: false, reason: "not_receiver" });
    expect(acknowledgeWithReceipt(record, null, binding, good, NOW, FP)).toEqual({ ok: false, reason: "not_receiver" });
    expect(acknowledgeWithReceipt({ ...record, protocol: undefined }, "b", binding, good, NOW, FP)).toEqual({ ok: false, reason: "no_protocol" });
    expect(acknowledgeWithReceipt(record, "b", [], good, NOW, FP)).toEqual({ ok: false, reason: "nothing_to_acknowledge" });
    expect(acknowledgeWithReceipt(record, "b", binding, { ...good, "ship:0": "2027-01-15" }, NOW, FP)).toMatchObject({ ok: false, reason: "receipt" });
  });
});
