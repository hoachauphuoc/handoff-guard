import { describe, expect, it } from "vitest";
import { contextStatus, NO_HANDOFF } from "../src/handoff/context";
import type { Finding, HandoffResult } from "../src/rules/types";
import contextFn from "../src/context-fn.ts?raw";

const finding = { rule: "no_due_date", message: "No due date." } as Finding;
const result = (verdict: HandoffResult["verdict"], findings: Finding[]): HandoffResult => ({ verdict, findings, binding: [] });

describe("contextStatus", () => {
  it("names the absence of a handoff instead of a verdict", () => {
    expect(contextStatus(null)).toEqual(NO_HANDOFF);
  });

  it("shows the verdict and the finding count", () => {
    expect(contextStatus(result("needs_info", [finding, finding])).status.value).toEqual({ label: "Needs info (2)", type: "moved" });
    expect(contextStatus(result("blocked", [finding])).status.value).toEqual({ label: "Blocked (1)", type: "removed" });
  });

  it("never gives a clear verdict a count", () => {
    expect(contextStatus(result("clear", [])).status.value).toEqual({ label: "Clear", type: "success" });
  });
});

describe("contextProperties logging", () => {
  it("logs the error name, never its message, so work item text cannot reach the logs", () => {
    expect(contextFn).not.toMatch(/\.message/);
  });
});
