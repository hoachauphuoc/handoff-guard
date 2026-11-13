/// <reference types="vite/client" />
import { describe, expect, it } from "vitest";
import measure from "../scripts/measure.ts?raw";
import acknowledge from "../src/handoff/acknowledge?raw";
import build from "../src/handoff/build?raw";
import checkHandoffSource from "../src/rules/checkHandoff?raw";
import validator from "../src/validator?raw";
import { reachText } from "../src/decisions/reach";

describe("proposals stay out of the verdict path", () => {
  it("is never read by the validator, the rules, acknowledge, build or measure", () => {
    for (const src of [validator, checkHandoffSource, acknowledge, build, measure]) {
      expect(src).not.toMatch(/getProposals|putProposals|proposals:/);
    }
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
