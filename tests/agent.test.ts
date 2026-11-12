/// <reference types="vite/client" />
import { describe, expect, it } from "vitest";
import manifest from "../manifest.yml?raw";
import { CheckHandoffInputSchema, ListBindingInputSchema } from "../src/actions/schema";

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
  });
});
