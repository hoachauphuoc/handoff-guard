// Compares checkHandoff() with the owner's labels. The only source of README figures.
// Run with Node 24+, which executes TypeScript directly:
//   node scripts/measure.ts --init   add unlabeled entries to data/labels.json (keeps existing labels)
//   node scripts/measure.ts          report agreement on the labeled entries
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { checkHandoff } from "../src/rules/checkHandoff.ts";
import type { Decision, Handoff, Verdict } from "../src/rules/types.ts";

type Sample = { note: string; handoff: Handoff; decisions: Decision[] };
type Label = { id: string; note: string; case: string; verdict: Verdict | null };

const ROOT = join(import.meta.dirname, "..");
const SAMPLES = join(ROOT, "data", "samples");
const LABELS = join(ROOT, "data", "labels.json");
const VERDICTS: Verdict[] = ["clear", "needs_info", "blocked"];

function loadSamples(): Map<string, Sample> {
  const out = new Map<string, Sample>();
  for (const file of readdirSync(SAMPLES).filter((f) => f.endsWith(".json")).sort()) {
    const { samples } = JSON.parse(readFileSync(join(SAMPLES, file), "utf8")) as { samples: Sample[] };
    samples.forEach((s, i) => out.set(`${file}#${i}`, s));
  }
  return out;
}

// One line a person can label from without opening the sample file. It states facts only, never a verdict.
function describe({ handoff: h, decisions }: Sample): string {
  const { item } = h;
  const ds = decisions.map(
    (d) =>
      `${d.id} [${d.status}; scope ${Object.values(d.scope).join(":")}; ` +
      `${d.constraints.map((c) => Object.values(c).join(":")).join(", ") || "no constraints"}]`,
  );
  return [
    `${item.key} (${item.projectKey}) from ${h.fromId} to ${h.toId}`,
    `due ${item.dueDate}`,
    `labels ${JSON.stringify(item.labels)}`,
    `components ${JSON.stringify(item.components)}`,
    `description ${JSON.stringify(item.description.slice(0, 80))}`,
    `acknowledged ${JSON.stringify(h.acknowledged)}`,
    `decisions: ${ds.join(" | ") || "none"}`,
  ].join("; ");
}

const samples = loadSamples();
const labels: Label[] = existsSync(LABELS) ? JSON.parse(readFileSync(LABELS, "utf8")) : [];

if (process.argv.includes("--init")) {
  const known = new Set(labels.map((l) => l.id));
  for (const [id, s] of samples) {
    if (!known.has(id)) labels.push({ id, note: s.note, case: describe(s), verdict: null });
  }
  writeFileSync(LABELS, JSON.stringify(labels, null, 2) + "\n");
  console.log(`${labels.length} entries in data/labels.json, ${labels.filter((l) => l.verdict === null).length} unlabeled`);
} else {
  const labeled = labels.filter((l) => l.verdict !== null);
  const bad = labeled.filter((l) => !VERDICTS.includes(l.verdict!) || !samples.has(l.id));
  if (bad.length > 0) {
    console.error(`Invalid labels: ${bad.map((l) => l.id).join(", ")}`);
    process.exit(1);
  }
  const disagreements = labeled
    .map((l) => {
      const s = samples.get(l.id)!;
      return { id: l.id, note: l.note, owner: l.verdict, rules: checkHandoff(s.handoff, s.decisions).verdict };
    })
    .filter((r) => r.owner !== r.rules);
  console.log(
    JSON.stringify(
      {
        samples: samples.size,
        labeled: labeled.length,
        agree: labeled.length - disagreements.length,
        agreement: labeled.length === 0 ? null : Number(((labeled.length - disagreements.length) / labeled.length).toFixed(3)),
        disagreements,
      },
      null,
      2,
    ),
  );
}
