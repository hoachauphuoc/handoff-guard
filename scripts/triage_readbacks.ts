// Dev-only: compares contradictions() with the Muse tags in the newest data/readbacks/ file, to find
// false refusals (block a real receiver) and misses. Read-only; changes no data. Run with Node 24+:
//   node scripts/triage_readbacks.ts
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { contradictions } from "../src/handoff/teachback.ts";
import { sampleDecisions } from "../src/samples/decisions.ts";

type ReadBack = { text: string; tag: "agrees" | "contradicts"; contradicts: string | null; by: string };

const DIR = join(import.meta.dirname, "..", "data", "readbacks");
const AS_OF = "2026-12-01T00:00:00.000Z"; // the day the read-backs were written
const binding = sampleDecisions("DEMO").slice(0, 3);

const file = readdirSync(DIR).filter((f) => f.endsWith(".json")).sort().at(-1);
if (!file) throw new Error("no file in data/readbacks");
const items = JSON.parse(readFileSync(join(DIR, file), "utf8")) as ReadBack[];

const falseRefusals: string[] = [];
const misses: string[] = [];
let bothAgree = 0, bothContradict = 0, differentDecision = 0;
for (const r of items) {
  const found = contradictions(r.text, binding, AS_OF);
  if (r.tag === "agrees") {
    if (found.length === 0) bothAgree++;
    else falseRefusals.push(`- ${JSON.stringify(r.text)}\n    code: ${found.map((c) => `${c.decisionId}: ${c.reason}`).join(" | ")}`);
  } else if (found.length === 0) {
    misses.push(`- ${JSON.stringify(r.text)}\n    muse: ${r.contradicts}`);
  } else {
    bothContradict++;
    if (!found.some((c) => c.decisionId === r.contradicts)) differentDecision++;
  }
}
console.log(`file ${file}: ${items.length} read-backs`);
console.log(`agree/agree ${bothAgree}, contradict/contradict ${bothContradict} (different decision: ${differentDecision}), false refusals ${falseRefusals.length}, misses ${misses.length}`);
console.log(`\nFALSE REFUSALS (Muse agrees, code refuses)\n${falseRefusals.join("\n")}`);
console.log(`\nMISSES (Muse contradicts, code sees nothing)\n${misses.join("\n")}`);
