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

## Tavily calls used: 29 of 30
