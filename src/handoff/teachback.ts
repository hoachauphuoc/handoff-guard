import type { Constraint, Decision } from "../rules/types";

/*
 * Teach-back: a read-back is refused when the receiver's own words contradict a binding decision. Plain code,
 * a fixed list of patterns, no clock and no Forge. What it does not catch is listed in the README's Limits;
 * a model may explain a refusal (src/llm.ts) but never makes or lifts one.
 */

export type Contradiction = { decisionId: string; title: string; reason: string };

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const MONTH = "(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)";
const ISO = /\b(\d{4})-(\d{2})-(\d{2})\b/g;
const DAY_MONTH = new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?${MONTH}\\b,?(?:\\s+(\\d{4}))?`, "g");
const MONTH_DAY = new RegExp(`\\b${MONTH}\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b,?(?:\\s+(\\d{4}))?`, "g");
// A month alone or a numeric date is read only right after a preposition: "retro is Jan 2027" and "OPS-12-1-2027" are not deadlines.
const PREP = "\\b(?:by|in|on|until|before|after|to)\\s+";
const MONTH_YEAR = new RegExp(`${PREP}${MONTH}\\s+(\\d{4})\\b`, "g");
const NUMERIC = new RegExp(`${PREP}(\\d{1,2})[/-](\\d{1,2})[/-](\\d{4})\\b`, "g");

const pad = (n: number): string => String(n).padStart(2, "0");
const iso = (y: number, m: number, d: number): string | null => {
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d ? `${y}-${pad(m)}-${pad(d)}` : null;
};
const monthOf = (name: string): number => MONTHS.indexOf(name.slice(0, 3)) + 1;

/**
 * Dates written in the read-back, as YYYY-MM-DD. A date with no year is its first occurrence on or after the
 * day in `fromIso` (the day of the read-back); if `fromIso` has no valid YYYY-MM-DD, it takes `fallbackYear`.
 * "by March 2027" is the first of that month. "on 01/10/2027" is read both ways and the earlier day kept, so
 * it is called late only when every reading is; both are read only after a preposition.
 */
export function datesIn(text: string, fromIso: string, fallbackYear: number): string[] {
  const from = /^(\d{4})-(\d{2})-(\d{2})/.exec(fromIso);
  const fromDay = from ? iso(Number(from[1]), Number(from[2]), Number(from[3])) : null;
  // Tries a few years so 29 Feb lands on the next leap year; 31 Feb never resolves.
  const yearless = (m: number, d: number): string | null => {
    if (!fromDay) return iso(fallbackYear, m, d);
    for (let y = Number(fromDay.slice(0, 4)); y <= Number(fromDay.slice(0, 4)) + 4; y++) {
      const day = iso(y, m, d);
      if (day !== null && day >= fromDay) return day;
    }
    return null;
  };
  const t = text.toLowerCase();
  const out: (string | null)[] = [];
  for (const m of t.matchAll(ISO)) out.push(iso(Number(m[1]), Number(m[2]), Number(m[3])));
  for (const m of t.matchAll(DAY_MONTH)) out.push(m[3] ? iso(Number(m[3]), monthOf(m[2]!), Number(m[1])) : yearless(monthOf(m[2]!), Number(m[1])));
  for (const m of t.matchAll(MONTH_DAY)) out.push(m[3] ? iso(Number(m[3]), monthOf(m[1]!), Number(m[2])) : yearless(monthOf(m[1]!), Number(m[2])));
  // A full date's own month and year ("15 Dec 2026") must not also read as "Dec 2026".
  for (const m of t.replace(DAY_MONTH, " ").matchAll(MONTH_YEAR)) out.push(iso(Number(m[2]), monthOf(m[1]!), 1));
  for (const m of t.matchAll(NUMERIC)) {
    const readings = [iso(Number(m[3]), Number(m[2]), Number(m[1])), iso(Number(m[3]), Number(m[1]), Number(m[2]))].filter((d): d is string => d !== null);
    if (readings.length > 0) out.push(readings.sort()[0]!);
  }
  return [...new Set(out.filter((d): d is string => d !== null))];
}

const tokens = (s: string): string[] =>
  s.toLowerCase().replace(/’/g, "'").replace(/[-_/]/g, " ").split(/[^a-z0-9']+/).filter(Boolean);

// Words of a decision title that say how it binds rather than what it is about.
const MODAL = new Set(["required", "require", "requires", "mandatory", "must", "needed", "need", "forbidden", "not", "no", "allowed", "is", "are", "be", "the", "a", "an", "before", "after", "for", "on", "of", "to"]);
const NEGATE = new Set(["skip", "skipping", "skipped", "without", "no", "not", "drop", "dropping", "remove", "removing", "ignore", "ignoring", "bypass", "omit", "omitting"]);
const UNDO = new Set(["not", "never", "can't", "cannot", "won't", "don't", "mustn't", "shouldn't", "wouldn't"]);
const OPTIONAL = new Set(["optional", "unnecessary", "unneeded", "skipped", "waived"]);
const NEEDED = new Set(["needed", "required", "necessary", "mandatory"]);
const AFFIRM = new Set(["add", "adding", "added", "set", "setting", "use", "using", "apply", "applying", "put", "tag", "tagging", "keep", "keeping"]);
const REMOVAL = new Set(["off", "out", "away", "removed", "gone"]);
const HALT = new Set(["stop", "stopping", "stopped", "avoid", "avoiding", "quit", "cease"]);
const STOPS = new Set([...HALT, ...NEGATE]);
const GO = new Set(["ship", "go", "deliver", "proceed", "release", "launch", "move"]);
const INTENT = new Set(["want", "plan", "going", "intend", "mean"]);
const WINDOW = 3;

// Two words match when one starts with the other's first five letters ("review" and "reviewed").
const same = (a: string, b: string): boolean => a === b || (a.length >= 5 && b.length >= 5 && a.slice(0, 5) === b.slice(0, 5));

/** Every position in `words` where `phrase` starts. */
function find(words: string[], phrase: string[]): number[] {
  if (phrase.length === 0) return [];
  const at: number[] = [];
  for (let i = 0; i + phrase.length <= words.length; i++) if (phrase.every((p, j) => same(words[i + j]!, p))) at.push(i);
  return at;
}

// "can't skip", and "won't ship without X" where a going verb sits between; "not now skip" and "don't worry skip" stay negations.
const undone = (words: string[], k: number): boolean => UNDO.has(words[k - 1] ?? "") || (UNDO.has(words[k - 2] ?? "") && GO.has(words[k - 1] ?? ""));

// An UNDO word that undoes a stop-or-negate word before position `end` is used up on it ("not" in "not go without").
const spent = (words: string[], k: number, end: number): boolean =>
  UNDO.has(words[k]!) && [k + 1, k + 2].some((j) => j < end && STOPS.has(words[j]!) && undone(words, j));

/** A word from `set` within WINDOW words before position `i`, not itself undone (see `undone`). */
function before(words: string[], i: number, set: Set<string>): string | null {
  for (let k = Math.max(0, i - WINDOW); k < i; k++) {
    const w = words[k]!;
    if (set.has(w) && !undone(words, k) && !spent(words, k, i)) return w;
  }
  return null;
}

/** "optional" or "not needed" within WINDOW words after position `end`; "not optional" is not a denial. */
function deniedAfter(words: string[], end: number): string | null {
  for (let k = end; k < Math.min(words.length, end + WINDOW); k++) {
    const w = words[k]!;
    if (OPTIONAL.has(w) && !UNDO.has(words[k - 1] ?? "")) return w;
    if ((w === "not" || w === "isn't") && NEEDED.has(words[k + 1] ?? "")) return w;
  }
  return null;
}

/** What a decision is about, as word lists: the value it names, and its title without the binding words. */
function subjects(d: Decision, value: string): string[][] {
  const title = tokens(d.title).filter((w) => !MODAL.has(w));
  return [tokens(value), title].filter((p) => p.length > 0);
}

// "don't want to skip" says what "don't skip" says; "want to skip" does not, so only a negated intent is collapsed.
function noIntent(words: string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < words.length; i++) {
    if (UNDO.has(words[i]!) && INTENT.has(words[i + 1] ?? "") && words[i + 2] === "to") {
      out.push("not");
      i += 2;
    } else out.push(words[i]!);
  }
  return out;
}

// Clauses, so "No problem, legal review is done" does not read "no" as applying to the review.
function clauses(text: string): string[][] {
  return text.split(/[.,;:!?\n]+|\bbut\b/i).map((c) => noIntent(tokens(c))).filter((s) => s.length > 0);
}

function denied(text: string, phrases: string[][]): string | null {
  for (const words of clauses(text))
    for (const p of phrases)
      for (const i of find(words, p)) {
        const neg = before(words, i, NEGATE) ?? deniedAfter(words, i + p.length);
        if (neg) return words.slice(Math.max(0, i - WINDOW), i + p.length + WINDOW).join(" ");
      }
  return null;
}

/** A removal word within WINDOW words after position `end`: "keep the hotfix label off" does not add it. */
function removedAfter(words: string[], end: number): boolean {
  return words.slice(end, end + WINDOW).some((w) => REMOVAL.has(w));
}

/**
 * An adding word within WINDOW words before position `i` that is not itself stopped or negated just before
 * it. Seen on production: repeating the title "Stop using the legacy billing component" was read as adding
 * it, and "must not use the component legacy-sms" has its "not" outside the window of the value.
 */
function addedBefore(words: string[], i: number): boolean {
  for (let k = Math.max(0, i - WINDOW); k < i; k++) {
    if (!AFFIRM.has(words[k]!)) continue;
    // "can't stop using": a refusal to stop, right before the adding word, undoes the halt and is used up on it.
    // A halt two words back ("remove or use") still blocks.
    const blocked = [k - 2, k - 1].some((at) => {
      const w = words[at];
      if (w === undefined || at < 0 || !(STOPS.has(w) || UNDO.has(w)) || spent(words, at, k)) return false;
      return UNDO.has(w) || at !== k - 1 || !undone(words, at);
    });
    if (!blocked) return true;
  }
  return false;
}

function affirmed(text: string, phrases: string[][]): string | null {
  for (const words of clauses(text))
    for (const p of phrases)
      for (const i of find(words, p)) {
        if (before(words, i, NEGATE) || deniedAfter(words, i + p.length) || removedAfter(words, i + p.length)) continue;
        if (addedBefore(words, i)) return words.slice(Math.max(0, i - WINDOW), i + p.length).join(" ");
      }
  return null;
}

function contradictionOf(text: string, d: Decision, c: Constraint, fromIso: string): string | null {
  switch (c.kind) {
    case "dueNotAfter": {
      const late = datesIn(text, fromIso, Number(c.date.slice(0, 4))).filter((x) => x > c.date).sort();
      return late.length > 0 ? `Your read-back gives ${late.join(", ")}, later than ${c.date}, the latest date "${d.title}" allows.` : null;
    }
    case "labelRequired":
    case "componentRequired": {
      const value = c.kind === "labelRequired" ? c.label : c.component;
      const where = denied(text, subjects(d, value));
      return where ? `Your read-back says "${where}", but "${d.title}" requires ${c.kind === "labelRequired" ? "label" : "component"} ${value}.` : null;
    }
    case "labelForbidden":
    case "componentForbidden": {
      const value = c.kind === "labelForbidden" ? c.label : c.component;
      const where = affirmed(text, [tokens(value)]);
      return where ? `Your read-back says "${where}", but "${d.title}" forbids ${c.kind === "labelForbidden" ? "label" : "component"} ${value}.` : null;
    }
  }
}

/**
 * The binding decisions the read-back contradicts, one entry per decision (its first contradicted
 * constraint). Patterns: a date later than a date limit; a negation word (skip, without, no, not, …) within
 * three words before what a required label or component is about, or "optional"/"not needed" just after it; an
 * adding word (add, set, use, …) within three words before a forbidden value, itself not stopped or negated
 * ("stop using", "must not use"), unless a removal word (off, out, away, removed, gone) follows the value
 * ("keep the hotfix label off"). Refusing to stop ("can't stop using") counts as adding. "Can't skip" and
 * similar, "won't ship without" and a negated intent ("don't want to skip") are not negations. A date with no
 * year is read as its next occurrence from the day of `fromIso`, the time of the read-back; a month alone or
 * a numeric date is read only after a preposition (by, in, on, until, before, after, to). Anything else is
 * not caught.
 */
export function contradictions(readBack: string, binding: Decision[], fromIso: string): Contradiction[] {
  const out: Contradiction[] = [];
  for (const d of binding) {
    const reason = d.constraints.map((c) => contradictionOf(readBack, d, c, fromIso)).find((r) => r !== null);
    if (reason) out.push({ decisionId: d.id, title: d.title, reason });
  }
  return out;
}

export const TEACH_BACK_NOTE = "A read-back that contradicts a decision is refused: a later date, a required label or component said to be skipped, or a forbidden one said to be added.";
