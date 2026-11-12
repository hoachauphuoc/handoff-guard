/// <reference types="vite/client" />
import { describe, expect, it } from "vitest";
import manifest from "../manifest.yml?raw";
import { CheckHandoffInputSchema, GatherInputSchema, ListBindingInputSchema, ProposeInputSchema, ReadSourceInputSchema } from "../src/actions/schema";

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
    expect(agent).toContain("- gather-handoff-context");
  });

  it("pins the fix advice wording", () => {
    for (const phrase of ["nothing was changed in Jira", "run the check again", "Never promise the verdict after the change"]) {
      expect(manifest).toContain(phrase);
    }
  });

  it("pins the brief rules: honest people text, advisory, no invented facts", () => {
    for (const phrase of [
      "Teamwork Graph returned nothing",
      "Teamwork Graph was not asked",
      "advisory and is not stored",
      "not stated",
      "Write the handoff brief for this work item",
    ]) {
      expect(manifest).toContain(phrase);
    }
  });

  it("pins the proposal rules", () => {
    for (const phrase of ["word for word", "bind nothing until a person confirms", "never call a proposal a decision"]) {
      expect(manifest).toContain(phrase);
    }
    expect(manifest).toContain("read each message, fix those candidates and call it once more");
    expect(manifest).toContain('scope {"kind":"project"}');
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
    expect(inputNames("gather-handoff-context").sort()).toEqual(Object.keys(GatherInputSchema.properties).sort());
  });
});

describe("Rovo MCP module", () => {
  const section = (from: string, to: string) => manifest.slice(manifest.indexOf(from), manifest.indexOf(to));
  const keys = (block: string, re: RegExp) => [...block.matchAll(re)].map((m) => m[1]).sort();
  const actionKeys = keys(section("\n  action:\n", "\n  function:\n"), /^ {4}- key: (\S+)/gm);

  it("exposes exactly the action keys, the same set the agent lists", () => {
    const mcp = section("  rovo:mcp:", "\n  action:\n");
    expect(keys(mcp, /^ {8}- (\S+)/gm)).toEqual(actionKeys);
    expect(keys(section("      actions:", "\n  rovo:mcp:"), /^ {8}- (\S+)/gm)).toEqual(actionKeys);
    expect(actionKeys).toHaveLength(5);
  });

  it("is one module with the agreed key and name", () => {
    expect(manifest.match(/^ {2}rovo:mcp:/gm)).toHaveLength(1);
    expect(manifest).toContain("- key: handoff-guard-mcp\n      name: Handoff Guard");
  });
});

describe("conflict advisories rule", () => {
  it("copies the list under its heading and invents nothing", () => {
    expect(manifest).toContain("Possible conflicts (advisory, not a verdict)");
    expect(manifest).toContain("never state a conflict that is not in advisories");
    expect(manifest).not.toContain("Rovo's reading");
  });
});

describe("agent gate", () => {
  it("runs the check before any work and declines unless the verdict is Clear", () => {
    for (const phrase of [
      "When asked to work on, take, start or pick up a work item, do nothing else first",
      "call check-handoff, then gather-handoff-context",
      "Proceed only when the verdict is Clear",
      "never call a verdict Clear that the action did not return",
    ]) {
      expect(manifest).toContain(phrase);
    }
  });

  it("uses the work item the agent was started from when no key is given", () => {
    expect(manifest).toContain("use the work item you were started from");
  });
});
