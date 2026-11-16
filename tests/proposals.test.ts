/// <reference types="vite/client" />
import { describe, expect, it } from "vitest";
import measure from "../scripts/measure.ts?raw";
import acknowledge from "../src/handoff/acknowledge?raw";
import build from "../src/handoff/build?raw";
import checkHandoffSource from "../src/rules/checkHandoff?raw";
import validator from "../src/validator?raw";
import { reachText, sourceText } from "../src/decisions/reach";

describe("proposals stay out of the verdict path", () => {
  it("is never read by the validator, the rules, acknowledge, build or measure", () => {
    for (const src of [validator, checkHandoffSource, acknowledge, build, measure]) {
      expect(src).not.toMatch(/getProposals|putProposals|proposals:/);
    }
  });
});

describe("sourceText", () => {
  it("names where a decision can be read without the storage word ledger", () => {
    expect(sourceText({ kind: "ledger", ref: "Handoff Guard demo ledger" })).toBe("demo rules of Handoff Guard");
    expect(sourceText({ kind: "ledger", ref: "Added by hand in project OPS" })).toBe("Added by hand in project OPS");
    expect(sourceText({ kind: "jira", ref: "OPS-7" })).toBe("work item OPS-7");
    expect(sourceText({ kind: "confluence", ref: "Launch notes" })).toBe("Confluence: Launch notes");
  });
});

describe("reachText", () => {
  it("says in plain words who a decision applies to", () => {
    expect(reachText({ kind: "project", projectKey: "OPS" })).toBe("Applies to: every work item in project OPS");
    expect(reachText({ kind: "label", label: "launch" })).toBe("Applies to: every work item with label launch");
    expect(reachText({ kind: "label", label: "launch", projectKey: "OPS" })).toBe("Applies to: every work item with label launch in project OPS");
    expect(reachText({ kind: "workItem", key: "OPS-1" })).toBe("Applies to: this work item only");
  });
});
