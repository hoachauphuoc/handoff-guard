/// <reference types="vite/client" />
import { describe, expect, it } from "vitest";
import manualRaw from "../src/decisions/manual.ts?raw";
import panel from "../src/frontend/index.tsx?raw";
import page from "../src/frontend/decisions.tsx?raw";
import { buildManualDecision, readManualInput, type ManualInput } from "../src/decisions/manual";
import { relate } from "../src/decisions/supersede";
import { slotsFor } from "../src/handoff/receipt";
import { checkHandoff } from "../src/rules/checkHandoff";
import type { Decision, WorkItem } from "../src/rules/types";

const NOW = "2026-11-15T00:00:00.000Z";
const input = (over: Partial<ManualInput> = {}): ManualInput => ({
  title: "Tell legal before release",
  scope: "project",
  scopeValue: "",
  constraint: "commitment",
  constraintValue: "",
  supersede: false,
  ...over,
});
const build = (over: Partial<ManualInput> = {}, stored: Decision[] = []) => buildManualDecision(input(over), "OPS", stored, "u-ana", NOW);

const item: WorkItem = { key: "OPS-1", projectKey: "OPS", summary: "s", description: "d", labels: [], components: [], dueDate: "2026-12-01", assigneeId: "u-b" };

describe("tier 2: a commitment", () => {
  it("is saved with nothing to check", () => {
    const r = build();
    expect(r.ok && r.decision.constraints).toEqual([]);
  });

  it("is read from the form payload", () => {
    expect(readManualInput({ title: "t", scope: "project", constraint: "commitment" })).toMatchObject({ constraint: "commitment" });
  });

  it("is already decided only by the same words for the same work", () => {
    const first = build();
    if (!first.ok) throw new Error(first.reason);
    expect(build({}, [first.decision])).toMatchObject({ ok: false });
    expect(build({ title: "Brief support before release" }, [first.decision]).ok).toBe(true);
    expect(relate([first.decision], { kind: "project", projectKey: "OPS" }, [])).toBeNull();
  });

  it("needs only the receiver's confirmation by name", () => {
    const r = build();
    if (!r.ok) throw new Error(r.reason);
    const d = r.decision;
    expect(slotsFor([d])[0]).toMatchObject({ kind: "confirm", ask: 'I have read "Tell legal before release".' });
    const handoff = { item, fromId: "u-a", toId: "u-b", acknowledged: [] as string[] };
    expect(checkHandoff(handoff, [d]).findings.map((f) => f.rule)).toEqual(["decision_not_acknowledged"]);
    expect(checkHandoff({ ...handoff, acknowledged: [d.id] }, [d]).verdict).toBe("clear");
  });
});

describe("tier 3: a source link", () => {
  it("keeps an https link with the decision", () => {
    const r = build({ sourceUrl: "https://example.com/decisions/42" });
    expect(r.ok && r.decision.source.link).toBe("https://example.com/decisions/42");
    const none = build();
    expect(none.ok && "link" in none.decision.source).toBe(false);
  });

  it("refuses anything that is not a plain https address", () => {
    for (const url of ["http://example.com", "javascript:alert(1)", "example.com", "https://exa mple.com", `https://example.com/${"x".repeat(300)}`]) {
      expect(build({ sourceUrl: url }).ok).toBe(false);
    }
  });

  it("is shown and never opened by the app", () => {
    for (const src of [manualRaw, panel, page]) {
      expect(src).not.toMatch(/\bfetch\(/);
      expect(src).not.toContain("requestConfluence");
    }
    expect(panel).toContain("<Link href={d.source.link} openNewTab>");
    expect(page).toContain("<Link href={d.link} openNewTab>");
  });
});
