# Handoff Guard: idea research (2026-11-12)

Research only. Sources were found with Tavily (29 calls) plus a few page fetches. "Unverified" marks anything I could not confirm from a source. Competitor "misses" come from listing text and snippets, not from installing the apps, so each is a reading of the source, not a test.

Fixed constraints for every idea: plain-code rules decide the verdict; Rovo explains and proposes; a person confirms; no silent substitution; no chat storage; read-only scopes.

## What the judges and winners tell us

- Equal-weight criteria: technological implementation, design, potential impact, innovation, presentation. Entries are first screened pass/fail for viability. [dapp.ing](https://dapp.ing/hackathons/codegeist-2026)
- Bonus prizes: Best Agents (`rovo:agent`, `rovo:agentConnector`, or reusable `rovo:skill`/`rovo:action` that other agents invoke as tools) and Best app with Atlassian MCP. [Devpost](https://codegeist2026.devpost.com) (snippet only; the full page returned 403 to my fetch).
- 2025 software-team podium: Secure Notes for Jira (1st), Sherlock Sync, AI Backlog for Jira. Business: Frank. Specialized: FleetOps, then Compliant Workflows for Jira (3rd, guardrails inside workflows). [Atlassian blog](https://www.atlassian.com/blog/development/meet-the-winners-of-codegeist-2025-atlassian-williams-racing-edition)
- Pattern: winners are narrow, concrete, work-in-Jira tools with a visible "before/after". Plain summarizers or chatbots are not on the podium (my reading of the list; the blog gives no judge comments). 2024 winners' own advice: solve a real problem, keep it simple, presentation matters. [GoCapable](https://www.gocapable.com/blog/how-to-win-atlassian-codegeist)
- Atlassian itself now ships agents in Jira and an MCP server, and says agents lack decision context. [Atlassian blog](https://www.atlassian.com/blog/rovo/ai-agents-in-jira) So "decisions that bind work" is a theme Atlassian names but, as far as I found, does not enforce.

## (a) Existing products and what they miss

| Product | Does | Misses (for our space) | Source |
|---|---|---|---|
| Simple Decision Log (Marketplace) | Decision register and timeline, links decisions to Jira issues, exports CSV/MD/PDF for audits | Record-keeping; the listing shows no check at handoff or transition (unverified: absence inferred from listing) | [listing](https://marketplace.atlassian.com/apps/1962325789/simple-decision-log-decision-timeline-register-for-jira) |
| Decision Log for Confluence | ADR-shaped records (context, options, decision, consequences, status) on a page via macro | Lives on the page; no link to who receives a work item (unverified) | [listing](https://marketplace.atlassian.com/apps/2435494237/decision-log-for-confluence) |
| Confluence decision macros / report | Manual decision register, "decision report" roll-up | Manual process, no enforcement | [community](https://community.atlassian.com/forums/discussion/3195026/best-practice-for-tracking-key-decisions-and-major-changes-in-jira-cloud) |
| Jira Automation as decision log | Rule creates a "decision" issue from a comment and links it | A convention, not a rule that checks anything | [Medium](https://medium.com/bethink-pl/decision-log-using-jira-and-automation-the-holy-grail-of-documenting-decisions-8d37ad3f1f2b) |
| Checklists for Jira Pro (HeroCoders) | Checklist templates, workflow validator for incomplete items, pitched at "handover friction" | Generic checklist; knows nothing about recorded decisions | [listing](https://marketplace.atlassian.com/apps/1213231/checklists-for-jira-pro-by-herocoders) |
| Rovo "Decision Director" agent | Evaluates a decision document against criteria, finds related decision docs | Judges a document, not the work item that must obey it | [Atlassian](https://www.atlassian.com/software/rovo/use-cases/decision-director) |
| Rovo work item summary | Overview, contributors, blockers, next steps | Summarizes; no verdict, no binding decisions | [Atlassian Support](https://support.atlassian.com/organization-administration/docs/atlassian-intelligence-features-in-jira-software) |
| Agents in Jira (assignable agents) | Assign work to Rovo/MCP agents; agents can be added to transitions; human approval is a separate workflow control | Guardrail guidance is generic (approvals, escalation); no per-work-item decision contract | [Atlassian guide](https://www.atlassian.com/software/jira/guides/agentic-engineering/guardrails-and-safety) |
| Jira Automation on assignee change | Notify previous assignee, set fields | Reacts after the fact; no completeness check | [Atlassian Support](https://support.atlassian.com/jira/kb/send-notification-to-previous-assignee-when-assignee-changes-on-a-jira-issue) |
| Mneme HQ | Turns ADRs into deterministic guardrails for AI coding agents in CLI, Claude Code hook, CI | Repo/CI side only; not Jira work items or handoffs | [GitHub](https://github.com/MnemeHQ/mneme) |
| ADR Guard (GitHub Action) | Fails a PR that changes watched code without an ADR | GitHub, path-based, no Jira | [list](https://github.com/joelparkerhenderson/architecture-decision-record/blob/main/README.md) |
| Compliant Workflows for Jira (Codegeist 2025, 3rd) | Compliance guardrails in workflows for regulated industries | Regulatory templates, not team decisions | [blog](https://www.atlassian.com/blog/development/meet-the-winners-of-codegeist-2025-atlassian-williams-racing-edition) |
| Bitbucket custom merge checks | Platform hook: Forge apps can block merges (e.g. PR title has a Jira key) | Only a hook; no app known to me uses decisions (unverified) | [Atlassian](https://www.atlassian.com/blog/bitbucket/beta-custom-merge-checks-in-bitbucket-cloud) |
| Sensay AI offboarding | Interview-based handover brief and chatbot when someone leaves | Chat memory outside Jira, no rules | [Yahoo Finance](https://finance.yahoo.com/news/sensay-launches-world-first-ai-110000219.html) |

Pain evidence: ADRs get written then ignored ("200 ADRs and nobody reads them") [Catio](https://www.catio.tech/blog/architecture-decision-record); retrieved context does not enforce anything, and the one relevant ADR may not surface [Mneme](https://mnemehq.com/insights/ai-coding-agent-guardrails); decisions get re-made because the Jira ticket records the work but not the choice [AuzzurA](https://auzzura.com/blog/why-decision-making-breaks-in-modern-teams); handoffs fail on memory and need a defined checklist [incident.io](https://incident.io/blog/on-call-best-practices-guide-2026); in follow-the-sun handoffs "Redis was flaky" turns into "something was weird" [Runframe](https://runframe.io/blog/on-call-rotation-guide).

## (b) Ideas

Sizes are rough solo days. "Existing" = what we already have.

### 1. Agent Gate: decisions as a contract for AI agents

- **Pitch:** Before any AI agent (Rovo, Claude, Cursor via MCP) starts a work item, Handoff Guard returns a deterministic verdict and the exact binding decisions; assigning an agent to an unbriefed item is blocked.
- **Pain:** Agents are being assigned Jira work now, yet "AI agents lack critical context including existing backlogs, dependencies and project history" ([Atlassian](https://www.atlassian.com/blog/rovo/ai-agents-in-jira)); retrieval alone does not enforce decisions ([Mneme](https://mnemehq.com/insights/ai-coding-agent-guardrails)).
- **Why nobody does it:** Mneme enforces in repos/CI, not on Jira items; Atlassian's guardrail guide offers approvals and escalation, not a decision check (links in table). Unverified that no Marketplace app does this; I did not search the Marketplace for agent-gating apps.
- **Modules:** `rovo:mcp` (preview) exposing `check_before_work`, `rovo:skill` for reuse by other agents, existing `jira:workflowValidator`, existing resolvers.
- **Principles:** Verdict is `checkHandoff()` with the receiver typed as "agent"; the agent only receives the result and the quote; a person confirms the override; if the graph or storage is unreachable the response names the source.
- **Size / risk:** 4 days. Risk: whether an agent assignment passes through a transition the validator can see, and whether an MCP client can call `rovo:mcp` (your own notes: site admin must enable external access). Spike first: assign a test item to an agent in Jira and log which events/validators fire; call the MCP tool from Claude Desktop.
- **Video scene:** Assign a payments ticket to a coding agent; Jira refuses, naming decision D-12 ("no new card-data storage"). Same agent calls the MCP tool, gets the brief, and the transition then passes.

### 2. Decision gate on pull requests (Bitbucket merge check)

- **Pitch:** A Bitbucket PR cannot merge while it breaks a decision bound to its linked Jira item, with the verdict shown in the PR and the decision quoted.
- **Pain:** Decisions live in tickets and docs but are broken in code review; a CI action only checks "an ADR exists", not that this change obeys one ([ADR Guard](https://github.com/joelparkerhenderson/architecture-decision-record/blob/main/README.md)).
- **Why nobody does it:** Merge checks exist as a platform hook ([Atlassian](https://www.atlassian.com/blog/bitbucket/beta-custom-merge-checks-in-bitbucket-cloud)); I found no app that binds them to Jira decisions (unverified).
- **Modules:** `bitbucket:mergeCheck` (GA status unverified; the blog says "planned to enter GA in April", year not stated), reuse of rules and decision storage across modules.
- **Principles:** Rules read PR metadata only (changed paths, labels, Jira key) and decide; Rovo explains why; read-only scopes; blocking is the platform's merge check, not a write by us. Needs a decision constraint kind based on path globs (a rule-semantics change, needs Opus review).
- **Size / risk:** 5 days. Risk: needs a Bitbucket workspace on the judges' side and sharing of storage across products; the "Runs on Atlassian" story gets more complex. Spike first: a hello-world `bitbucket:mergeCheck` on a test repo, and whether it can read Forge storage written by the Jira modules.
- **Video scene:** A PR touching `payments/` goes red: "Blocked by D-12, bound to PAY-88"; change the PR, the check turns green.

### 3. Decision time machine (deterministic replay)

- **Pitch:** Because the rules are pure code with time passed in, replay any past handoff against the decisions as they stood on any date, and show which "clear" handoffs would be blocked today.
- **Pain:** Audits ask "was this handoff compliant when it was made?" and teams cannot tell ([Simple Decision Log sells audit trails but only as records](https://marketplace.atlassian.com/apps/1962325789/simple-decision-log-decision-timeline-register-for-jira)). Verifiable claim for us only; the pain statement about audits is my inference.
- **Why nobody does it:** An LLM-based tool cannot replay deterministically; this is possible only with rules as plain code. Unverified that no tool offers it.
- **Modules:** Jira `jira:projectPage` (a report page), existing storage and rules; optional `rovo:skill`.
- **Principles:** Pure functions, clock passed in, nothing written to Jira; Rovo only narrates the diff. Needs decision versions (created, superseded timestamps) in storage: check whether we already keep them.
- **Size / risk:** 3 days. Risk: storage may hold only current decision state. Spike first: confirm decision records carry timestamps and supersession; run `checkHandoff()` on a stored handoff with an older "now".
- **Video scene:** Slide a date slider back two months; a handoff flips from Clear to Blocked, with the decision that was added in between highlighted.

### 4. Stale-decision radar (Confluence-aware conflict watcher)

- **Pitch:** When a Confluence page that a decision cites is edited, archived or contradicted, every open work item bound to that decision is flagged with the exact change.
- **Pain:** Decisions go stale silently; an old record is followed after it died ([r/softwarearchitecture](https://www.reddit.com/r/softwarearchitecture/comments/1xeydoi/decisions_that_outlive_the_session_architecture)); "ADRs are immutable once accepted" so supersession must be tracked ([Catio](https://www.catio.tech/blog/architecture-decision-record)).
- **Why nobody does it:** Decision macros and logs are static registers (table). Unverified for Marketplace.
- **Modules:** `trigger` on `avi:confluence:updated:page` (event availability and filters: see [events reference](https://developer.atlassian.com/platform/forge/events-reference/product_events), I did not verify the exact Confluence event name), Teamwork Graph page links, `jira:projectPage`/dashboard gadget (gadget modules are deprecated for removal 17 May 2027 per [community post](https://community.atlassian.com/forums/discussion/3288123/your-classic-jira-dashboards-are-being-replaced-build-one-list-this-week-because-it-decides-when), so prefer a project page).
- **Principles:** Rules compare page version/hash to the version recorded at decision time; since we cannot write comments, the output is a panel badge and radar page. Overlaps the existing conflict watcher; this extends it.
- **Size / risk:** 3 days. Risk: trigger permissions and a new Confluence read scope (review it against the "read only" claim). Spike first: does an edit event fire in dev and carry the page ID.
- **Video scene:** Edit the legal page in Confluence; the radar shows "3 open items now rest on a changed source".

### 5. Handoff radar page (portfolio view)

- **Pitch:** A project page listing every in-flight handoff: unacknowledged, aging, blocked by which decision, with rule-based risk ranking.
- **Pain:** Reassignments lose context and nobody sees the pile-up ([ITSM.tools](https://itsm.tools/handoffs-itsm)).
- **Why nobody does it:** Automation rules fire per item; no rollup of handoff health (unverified).
- **Modules:** `jira:projectPage`, existing resolvers, optional Rovo agent action "what is at risk this week".
- **Principles:** Ranking is code (age, missing items, binding decisions), Rovo summarizes the list.
- **Size / risk:** 3 days; low risk; strongest on Design and Potential Impact, weak on Innovation. Spike first: query cost with 200+ handoffs in storage.
- **Video scene:** One screen: 14 handoffs, 3 red; click one, see the exact missing item.

### 6. Incident shift handoff (JSM / on-call)

- **Pitch:** At on-call shift change, rules check the incident against what the next responder needs: active mitigations, silenced alerts, recent deployments pulled from the Teamwork Graph, and the decisions made mid-incident.
- **Pain:** Handoffs "fail when they rely on memory" and must cover active incidents, silenced alerts and upcoming deploys ([incident.io](https://incident.io/blog/on-call-best-practices-guide-2026)).
- **Why nobody does it:** Dedicated tools (incident.io, PagerDuty) do this outside Jira (those are different products, not Atlassian Marketplace); inside Jira I found no rule-based check (unverified).
- **Modules:** Teamwork Graph queries for deployments and incidents ([relationship types](https://developer.atlassian.com/platform/teamwork-graph/api-reference/relationship-types/overview)), validator on the incident workflow, Rovo agent.
- **Principles:** Required-context checklist is code; graph unavailability is named.
- **Size / risk:** 5 days. Risk: needs JSM and deployment data on the dev site, which you may not have; sample data would be synthetic. Spike first: what a deployment/incident relationship query returns on the dev site.
- **Video scene:** 2 a.m. shift change: the handoff is refused because a deploy 40 minutes ago touched the failing service and the outgoing engineer did not mention it.

### 7. Team-to-team handoff

- **Pitch:** When ownership moves between Atlassian teams, rules check the receiving team has what the old team's decisions assumed (components, contacts, reviewers).
- **Pain:** Context loss when work crosses teams and tools ([ITSM.tools](https://itsm.tools/handoffs-itsm)).
- **Why nobody does it:** Unverified; I did not find a competitor either way.
- **Modules:** Teamwork Graph team relationships ("Atlassian team assigned Jira work item", [object docs](https://developer.atlassian.com/platform/teamwork-graph/api-reference/object-types/AtlassianTeam)), existing validator and panel.
- **Principles:** Same as above.
- **Size / risk:** 3 days. Risk: weak demo; it is a variant of what exists. Spike first: whether team assignment events appear.
- **Video scene:** A ticket moves from Mobile to Platform team and the check lists three decisions Platform never saw.

## (c) Recommendation

1. **Idea 1, Agent Gate (build first).** It is the only idea aimed at the moment judges are living in (agents assigned in Jira, Rovo MCP, Teamwork Graph opened May 2026). It hits both bonus prizes (Best Agents via `rovo:skill`, Best MCP via `rovo:mcp`), reuses everything already built, and tells a clear story: AI cannot ignore a decision. The main risk is a preview module and the admin setting on MCP access; do the spike before any code. (Note: `rovo:skill` and `rovo:mcp` are Preview per [Atlassian docs](https://developer.atlassian.com/platform/forge/manifest-reference/modules/rovo-skill), which says it is "fully supported" in Preview.)
2. **Idea 3, Decision time machine.** Cheapest big-innovation move: it turns the "rules are plain code" principle from a constraint into a visible feature no LLM-only tool can copy. 3 days, no new product surface. It also feeds the README claim that the verdict is reproducible. Do the timestamp check first; if decisions are not versioned, it grows to 4-5 days.
3. **Idea 2, Bitbucket merge gate, only if the spike works within half a day.** Highest wow (decisions reach code), but it adds a product and a second install surface. If the spike fails, take Idea 4 (stale-decision radar) instead as the third, since it extends the existing conflict watcher.

Timing: the deadline (2026-12-22 12:00 PT) is about six weeks after today (2026-11-12). Any code change needs a new production deploy, and the install link serves only the latest production version (from `docs/PROGRESS.md`).

## (d) Review against the code and the spike (2026-11-12, later the same day)

Checked against `docs/SPIKE-AGENT-GATE.md`, `src/rules/types.ts` and the state after slice 5.

- **Idea 1 is narrower than pitched.** Starting an agent from the Agents button changes no assignee, status or history, so nothing can block it; the video scene "Jira refuses" cannot be filmed. What can be built: the agent's own first step is the rule check (prompt rule), and the same check is offered to other agents as a `rovo:skill`. The gate on a workflow transition already exists (two validators) and covers agents that move the item. The MCP half waits for the owner to enable external access.
- **Idea 3 needs one field.** A decision has `confirmedAt` and `status: "decided" | "superseded"`, but no time of supersession. Adding `supersededAt` belongs with plan slice 7 (superseding decisions), so the replay comes after it. Handoff records keep `preparedAt`.
- **Idea 2 is cut.** It needs a second product on the judges' site and a path-glob constraint kind; too much new surface for the remaining weeks.
- **Idea 4 is reduced to a check without a trigger.** Slice 5 already reads linked Confluence pages. Record the page version when a decision is confirmed from a page, and compare it when the ledger page or panel loads; no Confluence event and no new scope.
- **Idea 5 folds into plan slice 6** (the Decisions project page) as a second section; no separate page.
- **Ideas 6 and 7 are not built**: no JSM or deployment data on the dev site, and 7 is a variant of what exists.

Build order: (A) agent prompt rule and `rovo:skill`; (B) Decisions project page with impact and in-flight handoffs; (C) superseding decisions with `supersededAt`; (D) replay on a date; (E) changed-source check.

## (e) Second research round (17 more Tavily calls)

New facts that matter:

- The 2026 theme is "build with context": a Forge app that puts the right knowledge in front of a team at the right moment ([CompeteRadar](https://www.competeradar.com.tr/en/yarisma/codegeist-2026-build-with-context-ship-with-confidence), third-party summary of the official text). Handoff Guard already fits; ideas below lean into it.
- Atlassian's own Rovo Dev Code Review validates pull requests "against acceptance criteria in Jira" ([Atlassian](https://www.atlassian.com/software/rovo-dev/code-review)). So acceptance criteria in PRs are covered; recorded decisions are not mentioned there (my reading of the page). This weakens Idea 2 further (confirms the cut) and shows where the gap is.
- Atlassian Code Context puts multi-repo code understanding into the Teamwork Graph for agents ([Atlassian](https://www.atlassian.com/blog/development/code-context)): code context is being filled by Atlassian; decision context is not named there (unverified: I read the summary only).
- Failure data for AI agents: a study of agentic PRs lists "context limitation" as a rejection reason ([arXiv](https://arxiv.org/html/2602.04226v1)); the same share for decisions specifically is unknown.
- Rework is measured but not explained: Jira reports count how often an item re-enters a status ([community](https://community.atlassian.com/forums/discussion/3209085/how-to-run-a-jira-workflow-health-check-using-3-reports), [OBSS](https://community.atlassian.com/forums/discussion/3159673/how-to-measure-hidden-rework-loops-in-jira)), and reopened tickets trace back to "ambiguous requirements" and incomplete fixes ([community](https://community.atlassian.com/forums/discussion/3152740/the-hidden-cost-of-reopened-tickets-and-how-to-prevent-them)). None of these tell you which missing input caused the bounce.
- A "Definition of Ready" app exists with 4 installs ([listing](https://marketplace.atlassian.com/apps/1224751/definition-of-ready)): readiness checks are a known, thin niche, so a plain "is it ready" check is not a differentiator.
- Teamwork Graph connectors need `write:object:jira`, `read:object:jira`, `delete:object:jira` ([Atlassian](https://developer.atlassian.com/platform/forge/manifest-reference/modules/teamwork-graph-connector)). That conflicts with "no write scopes"; see Idea 10.
- UI Modifications can change Jira's issue create, issue view and issue transition screens ([Atlassian](https://developer.atlassian.com/platform/forge/understanding-ui-modifications)).

### 8. Bounce Autopsy: close the loop from outcomes back to rules

- **Pitch:** When an item bounces back (reopened, or re-enters a status), the app finds the handoff before it, names the rule that would have caught it or the decision nobody had, and proposes a new rule or decision; a person confirms; the project page tracks bounce rate before and after each rule.
- **Pain:** Rework loops are visible in status counts but the cause is not (sources above). Teams see "3 loops" and still cannot say what to change.
- **Why nobody does it:** Reports and metric blogs stop at counting (LinearB, Jellyfish, OBSS in the sources above); a rule-based "which check would have prevented this" is not in anything I found (unverified for the Marketplace as a whole).
- **Modules:** `trigger` on `avi:jira:updated:issue` (changelog status moves), existing storage, `jira:projectPage` section, Rovo action to word the proposal; replay from Idea 3 gives "this rule would have caught 6 of 9".
- **Principles:** Detection and counts are code; Rovo only words the proposed rule; confirming stores a decision (existing flow); nothing is written to Jira.
- **Size / risk:** 4 days (3 more if Idea 3 is not built first). Risk: needs enough history to look convincing, so a seeded synthetic set is required (README must say so); a trigger that stops firing has been reported ([community](https://community.developer.atlassian.com/t/forge-trigger-aviupdated-issue-stopped-firing-since-april-20th-despite-matching-filter-conditions/100460)), so the page must name its source when events are missing. Spike first: log changelog items from a status move in dev and check the event carries them.
- **Video scene:** The project page says "9 items bounced last month; 7 had no rollback plan". One click on "Add this rule" and the replay line reads "would have caught 6 of 7". The bar chart of bounce rate drops after the rule.

### 9. Live pre-flight inside Jira's own screens (UI Modifications)

- **Pitch:** While choosing the assignee on the transition or create screen, the check runs live: the screen shows what is missing and which decision applies before anyone presses Submit.
- **Pain:** A validator error after Submit is late and generic; people learn the rule by failing it. This is the same "context at the right moment" the 2026 theme asks for.
- **Why nobody does it:** UI Modifications exist as a platform capability (link above); I found no decision-aware use (unverified).
- **Modules:** `jira:uiModifications` (issue transition and issue view; field-level reach on assignee is unverified), existing resolvers; validator stays as the hard gate.
- **Principles:** The UI only displays the result of `checkHandoff()`; the validator still decides; read-only.
- **Size / risk:** 3 days. Risk: UIM may not expose the assignee field in all views, and it is a low-level API, so the demo could be fragile. Spike first: read the assignee value in an issue-transition UIM and show a banner.
- **Video scene:** Pick Mitch Davis in the dropdown; a red line appears under it, "D-12 applies, legal contact missing"; pick the fixed item and the line turns green.

### 10. Decisions as first-class Teamwork Graph objects

- **Pitch:** Publish confirmed decisions into the Teamwork Graph so Rovo Search, Rovo Chat and any MCP client (Claude, Cursor) can find "what did we decide about X" with permissions intact, and the answers carry a link back to the work items they bind.
- **Pain:** Decisions live in Confluence macros and Jira comments that search treats as ordinary text ([community](https://community.atlassian.com/forums/discussion/3195026/best-practice-for-tracking-key-decisions-and-major-changes-in-jira-cloud)).
- **Why nobody does it:** Graph connectors exist for external tools (Google Drive, Microsoft Teams, GitHub per the sources above); a connector for decision records is not in anything I found (unverified).
- **Modules:** Teamwork Graph connector module, `rovo:agentConnector` (bonus eligible), scheduled trigger.
- **Principles:** The graph is only an index; verdicts remain code. But the connector needs `write:object:jira`, which contradicts the rule "no write scopes" and forces a re-consent on upgrade. This is the owner's call, not mine.
- **Size / risk:** 4-5 days. Risk: scope change, permission re-consent for installed sites, and the graph's object types may not fit a decision (unverified). Spike first: ingest one decision object on dev and see whether Rovo Search returns it.
- **Video scene:** In Rovo Chat, ask "what did we decide about card data?"; the answer comes with the decision, its owner, and the three open items it binds.

### Updated ranking after round two

Keep the build order in section (d). Round two changes two things:

1. **Pair Idea 8 with the replay (D).** Replay alone is a nice report; replay plus Bounce Autopsy is a loop (outcome, cause, new rule, proof it would have caught the cases). That loop is the thing a judge can repeat to someone else in one sentence, and none of the competitors in section (a) does it. Do D, then 8 if time allows.
2. **Idea 9 is the best candidate for the Design score** if its spike shows the assignee field is reachable; otherwise drop it. Idea 10 is the strongest for the bonus prizes but needs the owner to accept a write scope, so it is last.

## (f) Third research round (36 more Tavily calls; stopped at 82 because new queries had started to repeat)

### New neighbours to know about (add to the table in (a))

| Product | Does | Misses | Source |
|---|---|---|---|
| Handoff Pulse, Shift Handover for Jira (Marketplace) | Shift handovers with carry-forward of unresolved items, recurring-risk view, searchable handovers, "Handover Health" indicators, aimed at ops/support/shift teams | Note-style handover for shifts; the listing mentions no recorded decisions or verdicts (unverified: listing text only). **Name is close to ours; keep the "Guard"/decisions wording prominent.** | [listing](https://marketplace.atlassian.com/apps/3926526090/handoff-pulse-shift-handover-for-jira) |
| Successor, Offboarding and Ownership Transfer | Finds the 15 places a leaver owns things in Jira and hands them to a successor; exports CSV evidence; 1 install | Moves ownership; says nothing about what the new owner must know | [listing](https://marketplace.atlassian.com/apps/1237194117/successor-offboarding-ownership-transfer-for-jira) |
| Decision Register for Jira | Highlights delivery-critical field changes (estimate, priority, ownership, due date, release) from issue history; 2 installs | A history of changes, not recorded decisions that bind new work | [listing](https://marketplace.atlassian.com/apps/2445040497/decision-register-for-jira) |
| Approval Gate for Jira | An approval goes stale when summary, description, priority, labels, due date etc. change, and must be given again; audit trail | Approvals, not handoffs; but it proves the "stale on change" pattern sells | [listing](https://marketplace.atlassian.com/apps/21996072/approval-gate-for-jira) |
| Rovo Dev Code Review | Reviews PRs against Jira acceptance criteria | No recorded decisions in the description | [Atlassian](https://www.atlassian.com/software/rovo-dev/code-review) |

### New evidence

- Reassignment is costly: about half of bugs are reassigned at least once, "greatly extending the time for bug fixing" ([Wei 2025](https://www.sciencedirect.com/science/article/abs/pii/S0950584924002477)); tossing increases time-to-correction ([Jeong et al., FSE 2009](https://dl.acm.org/doi/10.1145/1595696.1595715)). These are bug-tracker studies, not Jira studies.
- Structured handoff works in medicine: the I-PASS bundle across nine hospitals was linked to 23% fewer medical errors and 30% fewer preventable adverse events ([NEJM 2014](https://www.nejm.org/doi/full/10.1056/NEJMsa1405556)); a 32-hospital follow-up found 47% fewer handoff-related adverse events ([I-PASS Institute](https://news.ipassinstitute.com/news/journal-of-hospital-medicine-study-shows-i-pass-implementation-helps-reduce-patient-harm-and-improve-communication-quality)); in malpractice claims with communication failures, about 40% involved a handoff and 77% of those were likely preventable with a handoff tool ([Candello](https://www.candello.com/About/Press-Release-and-News/Jan-2022-IPASS-Can-Significantly-Decrease-Likelihood-and-Cost-of-Malpractice-Claims)). The five parts are illness severity, patient summary, action list, situation awareness/contingency, and synthesis (read-back) by the receiver ([AHRQ](https://www.ahrq.gov/teamstepps-program/curriculum/communication/tools/ipass.html)). All the search results I got were clinical; I found no software-engineering port (unverified that none exists).
- Agent-to-agent failures happen at the handoff edge: in an annotated corpus (N=824) the errors split into data gap 29.1%, referential drift 27.3%, signal corruption 36.8%, capability gap 6.8% ([ACL 2026](https://aclanthology.org/2026.acl-long.1294.pdf)). This supports passing a typed packet, not prose.
- Accountability gap: a r/jira thread asks whose identity lands in the audit log when an agent writes, noting attribution to the bot loses human-to-action traceability ([Reddit](https://www.reddit.com/r/jira/comments/1sxz6w6/the_agent_identity_blind_spot_is_atlassian_rovo)). EU AI Act Article 14 asks that high-risk systems allow effective human oversight ([text](https://artificialintelligenceact.eu/article/14)); whether the 2026 dates still stand I did not verify.
- **Agents are in the assignee dropdown.** "Open the assignee dropdown and select from available Rovo agents or third-party agents" ([Atlassian community](https://community.atlassian.com/forums/discussion/3194583/introducing-agents-in-jira)); a Rovo agent becomes assignable once its Work item surface is on ([community](https://community.atlassian.com/forums/discussion/3280944/automating-a-rovo-agent-as-the-assignee)). The earlier spike found that the Agents button changes no assignee; this route does, so the existing assignee-change detection may see it (unverified; needs a test with a Studio agent on the site). Also: assigning gives the agent no extra prompt ([video](https://www.youtube.com/watch?v=iku6g0qkeC8)), so the work item is the only briefing channel.
- Platform pieces few apps use: custom JQL functions, with precomputation caveats ([docs](https://developer.atlassian.com/platform/forge/manifest-reference/modules/jql-function)); Forge Automation Actions, GA ([Atlassian](https://www.atlassian.com/blog/development/automate-more-in-jira-a-guide-to-forge-automation-actions)); `rovo:skill` uses the Anthropic SKILL.md format ([RFC-137-A](https://community.developer.atlassian.com/t/rfc-137-a-forge-module-for-ai-skills/100984)), so the same skill file could also be used from Claude. The action validator module only supports Jira expressions today ([docs](https://developer.atlassian.com/platform/forge/manifest-reference/modules/jira-action-validator)), so it does not help us.
- MCP risk is real (tool poisoning, "rug pull" servers; [CSA note](https://labs.cloudsecurityalliance.org/research/csa-research-note-mcp-tool-poisoning-ai-agent-exfiltration-2)); our tool descriptions are fixed and its output is deterministic data, which is worth one README sentence.
- Demo advice: state the pitch in the first seconds; be concise and visual ([Devpost](https://help.devpost.com/article/84-video-making-best-practices), [Devpost blog](https://info.devpost.com/blog/6-tips-for-making-a-hackathon-demo-video)).

### 11. I-PASS Handoff: a proven protocol, enforced by the rules

- **Pitch:** Handoff Guard ports the I-PASS handoff protocol to Jira: the rules compute a severity (Stable, Watcher, Unstable), the app builds an owned action list from the findings, an Unstable handoff needs an if-then contingency, and the receiver cannot acknowledge until a read-back covers every binding decision.
- **Pain:** Structured handoffs cut preventable harm by 30% in hospitals (sources above) and about half of bugs are reassigned (above); software handoffs have no such protocol in Jira.
- **Why nobody does it:** Handoff Pulse and checklist apps give free-form notes or lists (table); I found no I-PASS port (unverified).
- **Modules:** existing panel, resolvers and validator; no new module.
- **Principles:** Severity, action list and "read-back covers D-1, D-3" are plain code over the handoff record; Rovo only helps word the read-back and points at what is missing; a person acknowledges. Honest limit: the rule checks that the read-back addresses each decision, not that the receiver understood it; say so in the README.
- **Size / risk:** 3-4 days. Risk: changes the handoff record shape (migration for stored handoffs) and rule semantics (needs Opus-level review). Spike first: sketch the severity rule on the stored MOBL-53 data and check it gives sensible answers.
- **Video scene:** The receiver clicks Acknowledge with a one-line read-back; the panel answers "Your read-back does not mention D-12 (no card data stored)". The receiver adds it, severity chip turns from Unstable to Watcher, acknowledgement goes through. The README line "I-PASS: 30% fewer preventable adverse events (NEJM)" appears on screen.

### 12. Decisions everywhere Jira already looks (JQL and Automation)

- **Pitch:** `issue in blockedHandoffs()` and `issue in boundBy("D-12")` work in JQL, boards, filters and dashboards, and a "Handoff Guard check" step can be dropped into any Automation rule.
- **Pain:** Teams cannot see, in the views they already use, which items rest on a decision or have an unacknowledged handoff.
- **Why nobody does it:** The modules exist (links above); I found no decision-aware JQL function (unverified).
- **Modules:** `jira:jqlFunction`, Forge Automation Actions, existing storage.
- **Principles:** Functions read stored records and run the same rules; the app writes nothing (the Automation rule's own actions are the admin's).
- **Size / risk:** 3-4 days. Risk: JQL functions are precomputed and cached, so results can lag unless updated by triggers; the UI must say how fresh the list is. Spike first: does a function returning dynamic key lists refresh after a stored decision changes?
- **Video scene:** On the board, a quick filter "Blocked handoffs" hides everything but three red cards; an Automation rule using the check step is shown running.

### 13. Handoff Drift: acknowledgement goes stale when the item changes

- **Pitch:** If a work item changes materially after the receiver acknowledged (description, due date, labels, components), the acknowledgement is marked stale and the receiver sees exactly what changed.
- **Pain:** Silent edits after assignment are a known scope-creep source; scope-change tools cover sprints, not handoffs ([Atlassian community](https://community.atlassian.com/forums/discussion/3137906/jira-scope-change-report-see-exactly-whats-added-removed-and-re-estimated)).
- **Why nobody does it:** Approval Gate proves the pattern for approvals (table); I found nothing for handoffs.
- **Modules:** `trigger` or a check on panel load, existing storage; this merges with the planned changed-source check (E).
- **Principles:** A stored fingerprint of the checked fields is compared; the verdict is code; no writes.
- **Size / risk:** 2 days; low risk. Spike first: which fields the handoff record already snapshots.
- **Video scene:** The reporter moves the due date; the receiver's panel flips to "Changed since you acknowledged: due 12-31 to 12-15" with a one-click re-acknowledge.

### Ranking after round three

1. **Idea 11 (I-PASS) becomes the backbone of the story.** It is cheap, it gives the README and video a number from a top journal, and it makes the product feel like a proven protocol, not another AI wrapper. Build it right after (A).
2. **Agent Gate (Idea 1) is worth one more spike** because of the assignee-dropdown finding: create a Studio agent with the Work item surface on, assign it to a test item, and see whether the existing assignee-change detection and validator fire. If yes, the "Jira refuses" scene works after all; if no, keep the section (d) scope.
3. **Replay plus Bounce Autopsy (3 + 8)** stay as the "loop" story if time remains.
4. **Idea 13 (Drift) is a two-day filler** that merges with (E). **Idea 12 (JQL/Automation)** is the best reach story for Potential Impact but has a freshness risk; take it only if (A) to (D) are done by about 2026-12-05.

## (g) Fourth research round (30 more Tavily calls, 2026-11-12, after I-PASS, Drift, replay and the assignee spike were built)

Each lead was checked against `src/` before it went in here. Two leads were dropped because the code already does them: reading Confluence decision nodes (`markedDecisions` in `src/adf.ts` is already used by `src/decisions/pages.ts`; the Confluence reader and that file were removed later the same day, and `markedDecisions` still reads Jira's own decision nodes) and reading people from the Teamwork Graph (`src/twg/`).

### New facts that change plans

- **There are four bonus prizes, not two.** Besides Best Agents and Best MCP there are **Best apps with Teamwork Graph integration** (an app that "connects data into the graph and/or consumes data from the Teamwork Graph API") and **Best Marketplace published app**. The second needs only a listing that is published *or submitted for listing*, with a link to the listing or the review ticket. Each prize is $1,500 to six projects. [Devpost rules](https://codegeist2026.devpost.com/rules), [LeanZero summary](https://leanzero.net/tutorials/atlassian-teamwork-graph-api-forge-rovo-agent). Handoff Guard already reads the graph (`src/twg/`), so it may qualify for the Teamwork Graph prize as it stands. Submitting for listing is owner work, not code.
- **The Teamwork Graph API moved to Preview on 15 October 2026.** It now uses object-level scopes (`read:graph:<object>:<product>`) and "curated" queries, and the broad product-wide scopes "are being retired". [Call the Teamwork Graph API](https://developer.atlassian.com/platform/teamwork-graph/call-the-teamwork-graph-api), [LeanZero](https://leanzero.net/tutorials/atlassian-teamwork-graph-api-forge-rovo-agent). The manifest declares `read:graph:issue:jira` and `read:graph:user:atlassian`, and `src/twg/` uses saved Cypher queries. **Unverified:** whether those names and the saved-query route still work after the change. A community thread asks the same thing for install-link apps, and a site enrolled in no EAP may still need an allowlist step; it had no answer in the snippet. [Developer community](https://community.developer.atlassian.com/t/codegeist-2026-is-rovo-on-judges-test-sites-and-can-an-install-link-app-call-teamwork-graph-preview-without-eap/103827). Check this before relying on that prize.
- **The same thread asks whether Rovo is on the judges' test sites.** If it is not, every Rovo-only feature shows only its fallback text in judging. Principle 3 already names the source, but the video should not lean only on Rovo.
- **Forge LLMs: Claude inside Forge with no egress.** It was in Preview, and an Atlassian blog now says it is GA. It is called through `chat()` in `@forge/llm`, and an app that uses it keeps the Runs on Atlassian badge. [Forge LLMs API](https://developer.atlassian.com/platform/forge/runtime-reference/forge-llms-api), [GA blog](https://www.atlassian.com/blog/development/forge-llms-api-is-now-ga-heres-how-you-can-build-ai-native-apps-on-atlassian), [Runs on Atlassian](https://developer.atlassian.com/platform/forge/runs-on-atlassian).
  - Cost: billed to the developer, no free quota, billing from 1 June 2026. Haiku 4.5 costs 10 credits per 1M tokens ($1 input, $5 output); Opus 4.6 costs $5 input and $25 output. [Pricing](https://developer.atlassian.com/platform/forge/runtime-reference/forge-llms-api-pricing), [Community post](https://community.developer.atlassian.com/t/now-in-preview-build-ai-powered-forge-apps-with-atlassian-hosted-llms/101045).
  - This is the answer to "the AI layer is thin and depends on Rovo". The app can write its own explanation even on a site without Rovo.
  - Cost to the owner: a few cents a day at demo volume (my estimate, not a measured figure).
- **Agent identity decides who appears in Jira.** A Studio agent runs either on the **user's account** (its actions are logged as that person) or on its **own agent account** (actions are credited to the agent). [Understand Rovo agent accounts](https://support.atlassian.com/studio/docs/understand-rovo-agent-accounts), [Atlas Bench](https://www.atlas-bench.com/resources/approve-and-audit-rovo-agents).
  - Consequence for the assignee route: on a user-account agent, a change the agent makes looks like the person made it. Only an agent-account agent can show up as a distinct receiver.
  - Add this to `docs/SPIKE-AGENT-GATE.md`. It narrows what the "agent as receiver" case can claim.
- **Automation for Jira has "Use agent" and "Use Rovo" actions.** Both return a response variable that the next action in the rule can use. [Community guide](https://community.atlassian.com/forums/discussion/3275155/rovo-agents-and-automation-in-jira-building-a-sprint-release-manager-step-by-step). This is a second route for Idea 12: an Automation rule can call the Handoff Guard agent on "assignee changed" without a new module. Unverified on the dev site.
- **Confluence's Decision report cannot see decisions made in Jira** (accepted community answer). [Community](https://community.atlassian.com/forums/discussion/3106288/do-decisions-in-jira-snyc-to-confluence-decision-reports). Handoff Guard keeps decisions from both places in one ledger, so this is a pitch line, not a feature to build.
- **Evidence:**
  - The NEJM citation is now checked: 10,740 admissions; medical errors fell 23% (24.5 to 18.8 per 100 admissions); preventable adverse events fell 30% (4.7 to 3.3 per 100). [NEJM](https://www.nejm.org/doi/full/10.1056/NEJMsa1405556), [PubMed 25372088](https://pubmed.ncbi.nlm.nih.gov/25372088). The open item in `docs/PROGRESS.md` can be closed.
  - Teach-back (AHRQ TeamSTEPPS): the receiver says it back in their own words; if anything is wrong you "clarify and check again". [AHRQ](https://www.ahrq.gov/teamstepps-program/curriculum/communication/tools/teachback.html), [PLOS One systematic review](https://journals.plos.org/plosone/article?id=10.1371%2Fjournal.pone.0231350).
  - Turnover: Rigby, Zhu, Donadelli and Mockus (ICSE 2016) define "Knowledge at Risk" on abandoned files, meaning files whose authors have all left, in Chrome and at Avaya. [Paper PDF](https://users.encs.concordia.ca/~pcr/paper/Rigby2016ICSE.pdf).

### 14. Teach-back loop: a read-back that contradicts a decision is refused (plain code), and Forge LLMs explains it (advisory)

- **Pitch:** today the read-back must *mention* every binding decision. Teach-back says the real check is whether the receiver got it right. The rules can catch one class of error exactly: the read-back names a value that contradicts a decision. Example: "ship by 15 Dec" when the decision says 31 Dec, or "skip legal review" when that label is required. Forge LLMs then writes one sentence for the sender saying what to clarify, and the loop repeats ("clarify and check again").
- **Pain:** teach-back is the evidence-based form of read-back; mention-only is the weaker form (AHRQ, PLOS One, above). Section (f) admitted this limit in the I-PASS idea.
- **Why nobody does it:** I found no Jira tool that checks a receiver's own words against recorded decisions. The handoff tools in sections (a) and (f) store notes; they do not check them.
- **Modules:** no new module. A pure `contradictions(readBack, decisions)` in `src/handoff/` (dates parsed and compared with a date limit; required or forbidden label values next to a negation word) and `@forge/llm` `chat()` with Haiku for the explanation.
- **Fit:**
  - A contradiction is a plain-code refusal and the model never decides; its text is labelled as written by the model.
  - If the LLM call fails, the code's own reason is shown and the panel says so (principle 3).
  - The read-back is already stored; no chat is stored.
  - **Gap:** negation detection in plain code is shallow. Accept only a fixed list of patterns and say so in Limits.
- **Size:** 2–3 days (1 for contradictions with tests, 1 for Forge LLMs with fallback, 0.5 for the panel and README).
- **Risk and first spike:** the `@forge/llm` scope or manifest entry on the current Forge CLI, and whether billing needs a payment method on the developer account. Spike: one `chat()` call from the dev environment. Owner check: billing setup.
- **Video scene:** the receiver types "Got it, I'll ship by Dec 15 and skip legal review." The box turns red: "Contradicts *Ship before 31 Dec*? No: 15 Dec is earlier, fine. Contradicts *Legal review required*: yes." The receiver retypes, and the box turns green.

### 15. Knowledge at risk: decisions and handoffs held by someone who left

- **Pitch:** a project page section lists in-flight handoffs whose sender has left, plus decisions whose only confirmer has left. A deactivated account and an unanswered acknowledgement count as "left". It is Rigby's "abandoned file" idea applied to decisions.
- **Pain:** turnover-induced knowledge loss (Rigby et al., ICSE 2016). Handover documents "often go unread" when people leave ([Sensay press release](https://finance.yahoo.com/news/sensay-launches-world-first-ai-110000219.html), a vendor claim). Out-of-office reassignment apps move the assignee but carry no briefing ([Out of Office Automation for Jira](https://marketplace.atlassian.com/apps/1218305/out-of-office-automation-for-jira-outlook-google-tempo)).
- **Why nobody does it:** offboarding tools in Jira are checklists and templates ([Atlassian Community](https://community.atlassian.com/forums/discussion/3316580/employee-offboarding-in-jira-how-to-build-a-secure-cross-team-process-with-or-without-jsm)). None of them points at the decisions a person held.
- **Modules:** existing Decisions project page. Reads the user's `active` field from Jira (already in scope with `read:jira-user`; check the manifest).
- **Fit:** an advisory list only, which never changes a verdict. No new storage.
- **Size:** 1.5–2 days.
- **Risk:** the dev site has no deactivated user. The scene needs a second test account that the owner deactivates.
- **Video scene:** 10 seconds on the Decisions page showing "2 decisions are held only by someone who has left."

### Ranking after round four

1. **Owner actions worth more than code:** submit the app for Marketplace listing (bonus prize), and check that `src/twg/` works under the October Teamwork Graph Preview (Teamwork Graph prize). Neither needs a new feature.
2. **Idea 14 (teach-back with Forge LLMs)** is the best answer to "the AI layer is thin". The code still decides; the AI becomes visible on every handoff and does not depend on Rovo being on the judges' site.
3. **Idea 12 via the Automation "Use agent" action** before a JQL function. It is cheaper and reuses the agent.
4. **Idea 15** only if the build is done by about 2026-12-10.

## Tavily calls used: 112 (29 in round one under the 30-call limit; 17 in round two, 36 in round three and 30 in round four, after the owner asked to continue)
