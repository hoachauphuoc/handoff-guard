/// <reference types="vite/client" />
import { describe, expect, it } from "vitest";
import manifest from "../manifest.yml?raw";
import { CheckHandoffInputSchema, ListBindingInputSchema, ProposeInputSchema, ReadSourceInputSchema } from "../src/actions/schema";

// The manifest is read as text on purpose: no YAML dependency, and the prompt wording is what is pinned.
describe("agent manifest", () => {
  it("keeps the prompt rules that stop the model inventing a verdict", () => {
    for (const phrase of ["copied exactly", "Never write a verdict that is not in an action result", "Do not store", "could not check"]) {
      expect(manifest).toContain(phrase);
    }
  });

  it("lists both action keys on the agent", () => {
    const agent = manifest.slice(manifest.indexOf("rovo:agent:"), manifest.indexOf("  action:"));
    expect(agent).toContain("- check-handoff\n");
    expect(agent).toContain("- list-binding-decisions");
    expect(agent).toContain("- read-decision-source");
    expect(agent).toContain("- propose-decisions");
  });

  it("pins the proposal rules", () => {
    for (const phrase of ["word for word", "bind nothing until a person confirms", "never call a proposal a decision"]) {
      expect(manifest).toContain(phrase);
    }
    expect(manifest).toContain("Saves up to 5 proposals for a person to review in the panel. Changes no decision and no Jira data.");
  });

  // Reads the input names of one action block out of the manifest text.
  const inputNames = (actionKey: string): string[] => {
    const start = manifest.indexOf(`- key: ${actionKey}\n`, manifest.indexOf("\n  action:"));
    const block = manifest.slice(start).split(/\n    - key: /)[0] ?? "";
    const inputs = block.slice(block.indexOf("      inputs:\n") + "      inputs:\n".length);
    return [...inputs.matchAll(/^ {8}(\w+):$/gm)].map((m) => m[1] as string);
  };

  it("declares exactly the properties the input schemas define", () => {
    expect(inputNames("check-handoff").sort()).toEqual(Object.keys(CheckHandoffInputSchema.properties).sort());
    expect(inputNames("list-binding-decisions").sort()).toEqual(Object.keys(ListBindingInputSchema.properties).sort());
    expect(inputNames("read-decision-source").sort()).toEqual(Object.keys(ReadSourceInputSchema.properties).sort());
    expect(inputNames("propose-decisions").sort()).toEqual(Object.keys(ProposeInputSchema.properties).sort());
  });
});
