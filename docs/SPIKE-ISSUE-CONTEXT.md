# Spike: verdict in the issue context area (2026-11-13)

Question: can a small `jira:issueContext` module show the handoff verdict (Clear / Needs info / Blocked and the number of findings) on a Jira work item without the person opening the Handoff Guard issue panel? What does it cost in upgrade friction, scopes and the Runs on Atlassian badge?

## How it was run

- A git worktree on branch `worktree-agent-aa2bfe1a88e7473a3`, on top of `559b0a9`. Nothing committed.
- Added:
  - `jira:issueContext` module `handoff-guard-context` (`render: native`, resource `context` = `src/frontend/context.tsx`, the existing `resolver` function, a static `status` lozenge "Not checked", and `dynamicProperties` = function `context-props`);
  - `src/context-fn.ts` (`contextProperties`): reads the work item as the viewer, runs `checkHandoff` on the stored record and decisions, and returns the status; any failure returns "Not checked";
  - `src/handoff/context.ts`: the verdict-to-lozenge mapping (no Forge imports), tested in `tests/context.test.ts`;
  - `src/frontend/context.tsx`: calls the existing `getPanel` resolver and shows a Lozenge with the verdict and "N finding(s) - open Handoff Guard for details", "No handoff is prepared..." when there is no record, or "Handoff Guard could not check this work item, so there is no verdict: ..." on error.
- `src/rules`, storage keys and scopes are unchanged.
- `forge lint`: no issues. `forge deploy -e development --non-interactive` (no `--approve` flag).
- Looked at TD-1 and MOBL-53 on `one-atlas-hxpc` in the development installation, one account, in the built-in browser.

## Results (observed)

- **The deploy is a minor version, not a major one.** It went through without `--approve MAJOR_VERSION_RULE` as development **10.1.0**, and the CLI reported it **eligible for Runs on Atlassian**. `forge install list` showed the development installation "Up-to-date" on major 10, so no `forge install --upgrade` was needed. A new UI module with no new scope does not trigger the major-version rule.
- **The collapsed panel shows a status from the rule check without being opened.** In the right column, under Automation, a collapsed "Handoff Guard" row appeared with the lozenge **"No handoff"** on both TD-1 and MOBL-53, on page load, panel never expanded. "No handoff" comes only from `contextProperties` (the static value is "Not checked"), so Jira called `dynamicProperties` while the panel was collapsed.
- **Reading as the viewer works in `dynamicProperties`.** The function logs only on failure, and `forge logs -e development` showed nothing for the last 30 minutes. "No handoff" needs a successful `asUser` read of the work item.
- **The expanded panel renders.** Expanding it on MOBL-53 showed "No handoff is prepared. Open Handoff Guard to prepare one." (UI Kit through the shared resolver). While expanded, Jira hides the status lozenge; it shows again when collapsed. I collapsed it again afterwards.
- Both checked items had no handoff in development storage (the development issue panel on TD-1 says "0 stored decisions" and "No handoff is prepared"). So **the Clear / Needs info / Blocked lozenges and the finding count were not seen on the site**; they are covered only by `tests/context.test.ts`. No data was written on the site in this spike.

## Not tested

- A work item with a prepared handoff (Needs info, Blocked, Clear) in the header and in the expanded panel.
- Whether the status refreshes after a change in the same page (reassignment, acknowledgement in the issue panel) without a reload. The docs say Jira calls the handler when the panel is collapsed; it was not observed after a change.
- A viewer who has not granted user consent: the expected header is "Not checked" (the `asUser` read throws), not seen.
- Production, a second account, Jira Service Management, the old issue view (the module is not available there).
- Latency of the status call; each page view now runs one extra function call (a Jira read and two storage reads).

## What it means

- **Feasible and cheap to ship.** It answers the question: the verdict can sit in the right column, collapsed, without opening anything. What a person sees without a click is the lozenge only (for example "Needs info (2)"); the "N findings - open Handoff Guard" line appears only when the row is expanded, because Jira renders module content only on expansion (docs).
- **No upgrade friction found.** Minor version, scopes unchanged, Runs on Atlassian kept. On production this should also be a minor deploy that existing installations receive without admin approval. Not checked on production.
- **Principle 3 holds by construction:** the header never shows a verdict that `checkHandoff` did not return; anything else is "No handoff" or "Not checked".
- **Duplication cost:** the expanded context panel calls `getPanel`, which also counts proposal impact and reads more than the summary needs. Fine for a spike; if shipped, a smaller resolver would cut the extra reads.
- Recommendation: ship after one observation on a work item with a prepared handoff (Needs info with a count, then Clear after acknowledgement), checked on development first.
