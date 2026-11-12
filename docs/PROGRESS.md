# Progress

## Next
1. Owner: register on Devpost. Ask the Developer Community (tag `codegeist-2026`) about billing: "Forge App Hosting - Handoff Guard" asks for a payment method before 2026-12-01, which is before the submission date.
2. Dev site is now the Codegeist demo site `one-atlas-hxpc.atlassian.net` (expires 2027-02-10). After any scope change: `forge install --upgrade -e development --demo-site --product jira`.
3. The demo site showed no work items right after provisioning. Check again for seeded data; if still empty, create a space and a work item, then verify the panel there.
3. Risk spikes still open: Teamwork Graph query, `rovo:mcp`. The Rovo agent and actions are built (see C1-C4 below); the owner tests them.
4. Owner (optional): spot-check a few Muse labels in `data/labels.json`; to override one, change `verdict` and delete its `by` field.
5. Panel semantics: the preview hands the item "from the viewer to the current assignee", so a self-assigned item reads "same person". Next product slice: pick the receiver in the panel, and store decisions so the panel has something to bind.

## Rule decisions (owner, 2026-11-12, after the Sonnet critique)
- Fixed: a malformed due date is reported (`invalid_due_date`) instead of compared; labels, components and person ids match ignoring case and outer spaces; a missing sender is reported (`no_sender`, info_needed).
- Kept as is: filler descriptions such as "tbd" pass; a binding decision with no constraints still needs acknowledgement; a superseded decision is not shown.
- Fixed later (2026-11-12, S1): a malformed `dueNotAfter` date in a decision is reported (`invalid_constraint`); project and work-item keys match ignoring case and spaces.

## Log
### 2026-11-12, Day 1
- Repo scaffold: CLAUDE.md, TypeScript, vitest, `scripts/check.ps1`.
- First rule-core slice: `checkHandoff()` with 6 rules and 3 constraint kinds; 9 tests pass.
- Forge CLI is not installed yet; no manifest yet.
- Dev-only model roles recorded in CLAUDE.md. `scripts/gen_samples.py` + `scripts/models.json` added; Muse dry run produced 2 valid unlabeled samples ($0.0006).
- Muse generated 30 valid unlabeled samples ($0.0072). Baseten slug set to `meta-models/muse-spark-open-1026`; the call failed (model deactivated), no Baseten samples yet.
- Baseten dropped for Modal. `gen_samples.py` now sends all batches in parallel (`--workers`, default 8) and logs wall-clock seconds; verified with Muse (6/6 samples, 2 batches). Modal not run yet: no endpoint URL. Muse total: 38 unlabeled samples in 3 files.
- Modal dropped too. Claude Sonnet is the second voice: it wrote 10 unlabeled adversarial samples (`data/samples/sonnet-adversarial.json`, shape check passes) and a critique of the rules. `gen_samples.py` is Muse-only again, with `--validate` for hand-written sample files.
- Rule fixes from the critique: `no_sender`, `invalid_due_date`, case/space-insensitive matching. 8 rules, 12 tests pass.
- Forge slice written, not registered or deployed: `manifest.yml` (issue panel, `read:jira-work`), resolver `previewHandoff` that runs `checkHandoff()` on the open work item, UI Kit panel. Typecheck passes. `forge register` stopped: the account has no Developer Space and the prompt needs a real terminal. Manifest app id is a placeholder until then, so `forge lint` cannot run.
- Owner registered the app (Developer Space "PhuocHoa Dev"). `forge lint` clean and now part of `scripts/check.ps1`. Deployed to development (eligible for Runs on Atlassian). `noEmit` moved out of `tsconfig.json` because the Forge bundler needs emitted output; the typecheck script still passes `--noEmit`. Not installed on any site yet.
- Installed the development build in Jira on `hoachauphuoc.atlassian.net` (scope `read:jira-work`). The panel has not been observed on a work item: the in-app browser is not signed in to the site.
- Dev site set up with the owner's approval: team-managed Kanban space "Ops Demo" (key `OPS`) and work item `OPS-1` "Launch the spring campaign". Panel verified on `OPS-1` (unassigned, no description, no due date): verdict Blocked with "no receiver", "description is empty", "no due date", and the source line. End to end works: Jira -> resolver -> `checkHandoff()` -> UI.
- `OPS-1` then got an assignee (the owner) and a description: panel changed to Blocked with "same person" and "no due date". After the due date was set to 2026-12-10 the panel shows only "same person" (Blocked). A Clear verdict has not been seen on the site: it needs a receiver other than the viewer, and the site has one user.
- `scripts/measure.ts` (`npm run measure`, runs on Node 24 directly, no new dependency) and `data/labels.json` with 48 unlabeled entries. Labels are never prefilled from rule output.
- `hoachauphuoc.atlassian.net` turned out to be an ordinary Standard trial, not the Codegeist site. Owner ran `forge site provision`; the development build is installed in Jira on `one-atlas-hxpc.atlassian.net` (panel not yet checked there: no work items). On the old site, Service Collection is on Free and Confluence is scheduled to go Free on 2026-12-12; Jira's downgrade is the owner's to confirm.
- Owner chose Muse as the labeler. `scripts/label_samples.py` labeled all 48 ($0.015) from a plain-words policy, without seeing rule output. `npm run measure`: rules agree with Muse on 47 of 48 (0.979). The one difference is `sonnet-adversarial.json#1`, the "tbd - see above" description: Muse says needs_info, rules say clear, which is the behaviour the owner chose to keep. Caveats: 38 of the 48 samples were written by the same model that labeled them, and this is agreement with a model, not accuracy.

### 2026-11-12, slices S1-S5 (decisions, handoffs, validator)
- S1 rules: `invalid_constraint` finding; project and work-item keys matched with `norm()`. Agreement with Muse labels unchanged at 47/48 (0.979); no sample has such a date.
- S2 measure baselines: a gate that passes everything agrees on 12/48 (0.25) and misses 36 labeled blocked/needs_info; rules without decisions agree on 34/48 (0.708).
- S3 `src/handoff/build.ts` shared by panel and validator; panel now reads the work item with `asUser()`.
- S4 `@forge/kvs` (scope `storage:app`), stored decisions and per-issue handoff record, receiver-only acknowledgement checked in the resolver, demo sample decisions. Deployed to development and upgraded on `one-atlas-hxpc.atlassian.net`; the deploy needed `--approve MAJOR_VERSION_RULE` (scope change).
- S5 `jira:workflowValidator` (`validate`), fails closed, blocks without a prepared record. Deployed to development. Not added to any workflow yet; `forge lint` did not ask for a resolver.
- Not observed on the live site yet: the panel UI (UserPicker, Prepare, Acknowledge, sample button) and the validator in a workflow.
- README must note: the validator reads as the app; `modifiedFields` ignores description and components.

### 2026-11-12, slices C1-C4 (Rovo actions and agent)
- C1 `src/jira.ts` (`FIELDS`, `readItemAsUser`) and `src/jira-error.ts` (`JiraReadError` with code consent/not_found/jira_error) shared by the panel and the actions.
- C2 actions `check-handoff` and `list-binding-decisions` (verb GET, read-only, never write storage). Core in `src/actions/core.ts` with injected deps; JSON Schema and types in `src/actions/schema.ts`. Jira reads use `asUser()` only; a failure returns `ok:false` code `consent`, never an app fallback. Every output has `source:"rules"` and a fixed `quote`. 11 tests.
- C3 `rovo:agent` `handoff-guard-agent` ("Handoff Guard") with an inline prompt; `tests/agent.test.ts` pins the prompt rules and checks manifest inputs against the schemas.
- C4 panel button "Explain with Rovo": `rovo.isEnabled()` then `rovo.open`; both failure paths say the verdict comes from the rule check.
- Deployed to development (3.2.0 then 3.3.0). No scope change, so no `--approve`; `one-atlas-hxpc` shows Up-to-date. The old `hoachauphuoc` install is Outdated (not upgraded).
- Not observed yet (owner): Rovo active on `one-atlas-hxpc`; the agent appears in Rovo chat (known bug ROVO-1239: missing if Rovo was activated after install); `asUser()` works inside an action (consent prompt); where `accountId` sits on a real call; the "Explain with Rovo" button.
- TO REMOVE after the owner confirms: `logShape()` in `src/actions/index.ts` logs only key names of payload, `payload.context`, `payload.context.jira` and context once per action call (`forge logs -e development`). Delete it and its two calls.

### 2026-11-12, slices G1-G4 (guide and proposed decisions)
- G1 "Guide: getting started checklist derived from panel state": `src/guide/steps.ts` (7 steps, done flags read from `PanelState`, manual steps never ticked), `src/guide/hints.ts` (panel-only hints per rule), `walkthroughHandoff` (panel resolver only, tested not to be imported by validator, actions or measure), `practiceFindings` (findings about the work item itself, no verdict). Deployed to development (3.4.0).
- G2 "Decisions: proposal type, evidence check, confirm (pure)": `Proposal` is a separate type the compiler refuses as a `Decision`; `validateCandidates` keeps a candidate only if its quote is found word for word (NFC, whitespace runs, curly quotes and dashes normalised; case-sensitive) in the source; cap 5; stable ids. `confirmProposal` is an upsert. Decision got optional `confirmedBy`/`confirmedAt`; the evidence quote is not copied into the decision (its source ref points to it).
- G3 "Decisions: proposals in storage, confirm/dismiss in the panel": `proposals:<issueId>` in Forge storage (bounded to 5), `readSourceAsUser` (description plus newest 20 comments, comments with `visibility` skipped, cut at 20,000 chars), resolvers `confirmProposal`/`dismissProposal` take only a proposal id, panel section "Proposed by Rovo (not binding until you confirm)" and a "Find decisions with Rovo" button.
- G4 "Rovo: read-decision-source and propose-decisions actions": both verb GET (FRGE-1601), agent prompt rules 6 and 8-10, new starter. `propose-decisions` re-reads the source as the caller and writes only through `putProposals`. No new scope; `forge lint` clean. Deployed to development (3.5.0, minor, no `--upgrade` needed).
- Unverified on the real site (owner): Rovo Chat calls the two new actions and passes `candidates` as a JSON string; `asUser()` inside an action; where `accountId` sits; whether `visibility` is returned on restricted comments as assumed; the panel (guide, practice block, proposals, Confirm/Dismiss) has not been seen. `logShape()` is still in `src/actions/index.ts` (Gate 0 logs not yet sent).
- NOT done yet: Confluence source, `rovo:mcp`, Teamwork Graph, Handoff Brief, Fix Advisor, Conflict Watcher, the extraction eval commit.
- Owner-only: Gate 0 test, consent prompts, a second user, the validator in a workflow, production, Marketplace, Devpost, push.

### 2026-11-12, commit 5 (Confluence pages as a decision source)
- Manifest: scope `read:page:confluence` (granular, listed under "View pages" in the Forge Confluence scopes page) and `app.compatibility` with jira required, confluence optional (syntax from the Forge "app compatibility" doc). WARNING from that doc, not reversible: once deployed the `compatibility` object cannot be removed or switched, multi-app apps are single-site only, and they can be listed on Marketplace only as paid. Deployed to development as 4.0.0 with `--approve MAJOR_VERSION_RULE` (development only), then `forge install --upgrade -e development --demo-site --product jira` (upgrade complete; Forge says Confluence needs its own `forge install -p Confluence -s one-atlas-hxpc.atlassian.net -e development`, not run).
- Pages are found by Jira remote links (`GET /rest/api/2/issue/{key}/remotelink`, asUser) filtered to `application.type` starting `com.atlassian.confluence`; page id from `globalId` (`appId=..&pageId=N`) or the URL. Read with `asUser().requestConfluence(/wiki/api/v2/pages/{id}?body-format=storage)`. `src/decisions/confluence.ts` (pure): `storageToText`, `pagesFromRemoteLinks`, `collectPages` (max 3 readable pages, at most 6 tried, unreadable counted), `capParts` (20,000 chars across Jira and pages). `read-decision-source` returns exactly the converted text and `unreadablePages`; the evidence check runs on the same text.
- `Proposal.evidence` keeps `from` as a string and gains optional `page: {pageId, ref}` (instead of turning `from` into an object, so Jira evidence and its tests are untouched). Confirmed decision source = `{kind:"confluence", ref:<page URL>}`. The panel re-reads each evidence page as the viewer (`openablePageIds`); if that fails the quote is withheld ("Evidence is on a Confluence page you cannot open") and Confirm is disabled; the confirm resolver re-checks server side.
- UNCONFIRMED (not observed): that `application.type` is `com.atlassian.confluence` on this site (seen in Atlassian KB examples only, not the REST reference); the v2 single-page `_links.base` + `_links.webui` shape (falls back to the link URL, then "Confluence page <id>"); that `requestConfluence` works before the Confluence install and the owner's consent; 401/403/404 behaviour for a restricted page. The Confluence read is NOT claimed to work until observed.
- Also fixed: `src/frontend/index.tsx` was saved in Windows-1252 (the bullet character); it is UTF-8 now.
- `forge lint` reports an "approval" (major version) until the deploy is done, which makes `check.ps1` fail before `--approve`; after the deploy it passes.
