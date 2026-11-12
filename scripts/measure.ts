// Compares checkHandoff() with the labels in data/labels.json. The only source of README figures.
// Run with Node 24+, which executes TypeScript directly:
//   node scripts/measure.ts --init   add unlabeled entries to data/labels.json (keeps existing labels)
//   node scripts/measure.ts          report agreement on the labeled entries
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { checkHandoff } from "../src/rules/checkHandoff.ts";
import type { Decision, Handoff, Verdict } from "../src/rules/types.ts";

type Sample = { note: string; handoff: Handoff; decisions: Decision[] };
// `by` names the model that wrote the label; absent means the owner wrote it.
type Label = { id: string; note: string; case: string; verdict: Verdict | null; by?: string };

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
      return {
        id: l.id,
        note: l.note,
        label: l.verdict,
        labeledBy: l.by ?? "owner",
        rules: checkHandoff(s.handoff, s.decisions).verdict,
      };
    })
    .filter((r) => r.label !== r.rules);
  // Baselines show what the rules add: a gate that passes everything, and the rules without recorded decisions.
  const agreeing = (verdictOf: (s: Sample) => Verdict) =>
    labeled.filter((l) => verdictOf(samples.get(l.id)!) === l.verdict).length;
  const rate = (n: number) => (labeled.length === 0 ? null : Number((n / labeled.length).toFixed(3)));
  const noCheckAgree = agreeing(() => "clear");
  const noDecisionsAgree = agreeing((s) => checkHandoff(s.handoff, []).verdict);
  const baselines = {
    noCheck: {
      agree: noCheckAgree,
      agreement: rate(noCheckAgree),
      // Handoffs labeled blocked or needs_info that a gate with no check would let through.
      missed: labeled.filter((l) => l.verdict !== "clear").length,
    },
    rulesWithoutDecisions: { agree: noDecisionsAgree, agreement: rate(noDecisionsAgree) },
  };
  const labeledBy: Record<string, number> = {};
  for (const l of labeled) labeledBy[l.by ?? "owner"] = (labeledBy[l.by ?? "owner"] ?? 0) + 1;
  console.log(
    JSON.stringify(
      {
        samples: samples.size,
        labeled: labeled.length,
        // Agreement with model labels is consistency with that model, not accuracy against ground truth.
        labeledBy,
        agree: labeled.length - disagreements.length,
        agreement: labeled.length === 0 ? null : Number(((labeled.length - disagreements.length) / labeled.length).toFixed(3)),
        baselines,
        disagreements,
      },
      null,
      2,
    ),
  );
}
