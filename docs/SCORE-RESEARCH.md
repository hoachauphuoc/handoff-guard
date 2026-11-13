# Score research (2026-11-13)

Dev research, not product text. Muse Wonder (muse-wonder-1.0) planned 16 web searches, Tavily ran them, and Muse Wonder wrote the report below from the results. Point and hour estimates are the model's own and are marked unverified. Script: scripts/research_score.py; raw results stay outside the repo.

Queries:
- (1) Codegeist 2025 winners Devpost Forge Rovo agent Forge LLM judges feedback
- (1) site:devpost.com Codegeist winner Jira Forge "Runs on Atlassian" Rovo Teamwork Graph
- (1) Atlassian Forge 2025 2026 Rovo actions Teamwork Graph Forge LLMs dashboard gadget automation features documentation
- (2) Codegeist winning Forge app design UI Kit complete product experience Devpost winner video
- (2) Atlassian Design System Jira issue panel Forge UI Kit 2 accessibility empty state onboarding best practices
- (2) hackathon judging design criterion complete coherent product not proof of concept winning examples
- (3) software support ticket reassignment ping-pong effect resolution time study statistics
- (3) work handover knowledge loss cost statistics employee transition lost information research study
- (3) IT service desk shift handoff incident errors delays MTTR statistics study
- (3) Jira reassigned issues missing context due date acknowledgement pain points site:community.atlassian.com
- (4) site:marketplace.atlassian.com Jira handoff checklist assignee acknowledgement workflow validator app
- (4) site:marketplace.atlassian.com Jira decision log required labels components issue checklist app reviews
- (4) site:devpost.com Jira handoff knowledge transfer decision ledger Codegeist app
- (5) Codegeist winner demo video Devpost Jira Forge app end to end pitch
- (5) winning hackathon demo video structure 3 minutes problem solution impact Devpost tips judges
- (5) site:youtube.com Atlassian Codegeist winner presentation demo video Jira app

---

Blunt verdict: your self-scores are too high, unverified. The main problems are not code volume. They are proof: no video, no real users, install not tested on a second account, and a measurement that is agreement with model-written labels, not accuracy. That caps Presentation, Impact, and Technological Implementation before judges look at novelty, unverified.

Below, product facts are from your description. Judge opinions, hour estimates, and point estimates are marked `unverified`. External claims are cited.

## 1. Technological Implementation

### (a) What likely caps the score now

- Judges need to test the app through an installation link. Codegeist 2026 says to provide access and instructions for judges and the review team to test the application: https://codegeist2026.devpost.com
  Your second-account install is untested, unverified as a risk, but if install fails, the rest is hard to score.
- Teamwork Graph use sounds thin as described: “saved queries to suggest people.” The 2026 Teamwork Graph bonus is for apps that connect data into the graph and/or consume data from the TWG API: https://codegeist2026.devpost.com/rules
  If you only use saved queries, judges may not count this as real Teamwork Graph integration, unverified.
- Rovo eligibility also needs to be shown, not asserted. The 2026 Best Agents bonus covers apps using the `rovo:agent` module, `rovo:agentConnector` module, or reusable `rovo:skill` / `rovo:action` tools: https://codegeist2026.devpost.com/rules
- “47/48” must not be presented as accuracy. You already state the labels were model-written. Presenting this as accuracy would damage trust, unverified.

### (b) Highest-value changes in about 5 weeks

1. **Test install on a clean second account/site, then write judge install steps.** Fix permissions, required setup, sample data, and a 10-minute test path. Estimate: 4-6 hours, unverified. Evidence: judges must be given an installation link to test the application: https://codegeist2026.devpost.com
2. **Either prove Teamwork Graph API use, or downgrade the claim.** Show one screen/log line in the demo where the app consumes TWG API data to suggest a person with context. If that is not true, remove the implied integration claim. Estimate: 3-8 hours, unverified. Evidence: the Teamwork Graph bonus is defined by connecting data into the graph and/or consuming data from the TWG API: https://codegeist2026.devpost.com/rules
3. **Replace the synthetic “47/48” headline with a small deterministic rule test set.** Use fixed cases: missing description, later teach-back date, required label skipped, forbidden label added, acknowledgement goes stale after label change, validator blocks transition. Show pass/fail. Estimate: 4-6 hours, unverified. Evidence: higher technical execution is described as working end to end and handling at least one edge case: https://unstop.com/blog/hackathon-judging-criteria-for-hiring

### (c) What a 10 would look like

A judge installs the app without help, runs one reassignment from blocked to clear, sees the validator block and then pass, sees acknowledgement go stale after a field change, uses one Rovo action, and can tell which parts use Forge, Jira, Rovo, Forge LLMs, and Teamwork Graph. This is a judging standard, unverified.

## 2. Design

### (a) What likely caps the score now

- The issue panel has a discoverability problem. Forge issue panels are not forced open; a community answer says the panel will only be shown by default for an issue if the user previously opened it and left it open for that issue: https://community.developer.atlassian.com/t/options-for-not-rendering-an-issue-panel-based-on-issues-state/71962
- A separate admin guide calls hidden issue panels a problem because users must use the Apps button and select the panel manually: https://community.developer.atlassian.com/t/enabling-jira-issue-panels-by-default-a-guide-for-jira-administrators/91322
- You have several surfaces: panel, ledger page, validator, Rovo actions, teach-back. With no real users, “complete, coherent” is unproven, unverified.
- Empty states matter. Atlassian design guidance covers empty state messages, including why a panel exists but has no meaningful content: https://atlassian.design/foundations/content/designing-messages

### (b) Highest-value changes in about 5 weeks

1. **Add clear empty states.** For no decision, no reassignment, no receiver, and no stale acknowledgement, say what the panel is for and what to do next. Estimate: 3-5 hours, unverified. Evidence: Atlassian guidance says empty state messages should be effective and gives usage guidance for messages in panels and containers: https://atlassian.design/foundations/content/designing-messages
2. **Add a discoverability pack.** In the submission and ledger page, show exactly how to open/pin the panel and how an admin enables it. Consider whether another extension point is better for the “needs attention” signal, but only if cheap. Estimate: 3-5 hours, unverified. Evidence: the community answer suggests considering an alternate extension point such as IssueContext or IssueActivity because an IssuePanel cannot be forced open: https://community.developer.atlassian.com/t/options-for-not-rendering-an-issue-panel-based-on-issues-state/71962
3. **Run 3 short user walkthroughs and fix the top confusion.** Task: “You were just assigned this. Tell me if you can start.” Record where they hesitate. Estimate: 5-8 hours, unverified. Evidence: one judging guide says judges should separate demo quality from workflow fit and user evidence: https://ai-beavers.com/blog/how-to-judge-hackathon-complete-guide

### (c) What a 10 would look like

A first-time receiver opens a reassigned item, finds the panel without being told, understands Clear / Needs attention / Blocked in plain words, knows who owns each fix, completes teach-back, and later understands why an acknowledgement went stale. This is unverified as a standard.

## 3. Potential Impact

### (a) What likely caps the score now

Your Impact 9 is not defensible, unverified. You have no real users, no testimonials, and no measured reduction in bad handoffs.

There is support for a narrow ticket-reassignment problem. HappySignals says end-user happiness drops by close to eight points per reassignment, and users perceive lost work time of 1 hour 42 minutes per bounce: https://www.happysignals.com/blog/ticket-bouncing-frustrated-end-users-what-can-it-do

But that is IT support ticket data, not proof for all Jira work items. Applying it to every Jira reassignment is unverified.

General knowledge-loss numbers also do not prove your product works. One cited source says the average US business loses $47 million yearly due to inefficient knowledge sharing and that 42 percent of institutional knowledge is specific to an employee’s current role: https://www.learntowin.com/blog/cost-of-lost-knowledge
That supports “knowledge gets lost,” not “Handoff Guard fixes it.” The link between the statistic and your app’s effect is unverified.

The Atlassian Community search result provided no definitive answer on Jira reassignment missing-context pain points. That specific Jira pain claim is unverified.

### (b) Highest-value changes in about 5 weeks

1. **Pick one audience and one workflow.** Example: support or service teams in Jira who reassign work items between agents, unverified as the best choice. Use the ticket-bounce statistic only for that audience. Estimate: 2 hours, unverified. Evidence: per-bounce happiness and lost-time figures are here: https://www.happysignals.com/blog/ticket-bouncing-frustrated-end-users-what-can-it-do
2. **Get small user evidence.** Interview or test 3-5 people from that audience. Ask for one real bad handoff story, what was missing, and whether the verdict list matches it. Quote one or two lines with permission. Estimate: 6-10 hours, unverified. Evidence: one judging source says strong assessment separates impact and evidence, and that evidence includes a problem that bites and users who want the result: https://theinnovationmode.com/hackathon-judging-criteria
3. **Show one before/after case in the demo.** Before: reassigned item missing due date and required label moves forward. After: validator blocks, receiver teach-back is refused for contradicting a decision, fix is applied, verdict becomes Clear, then a label change makes acknowledgement stale. State plainly that your 48-sample test measured agreement with model-written labels, not accuracy. Estimate: 3-4 hours, unverified. Evidence: Devpost says to set the scene by explaining the problem in a few sentences before showing the solution: https://info.devpost.com/blog/how-to-present-a-successful-hackathon-demo

### (c) What a 10 would look like

Named audience, named workflow, frequency of reassignment, cost of a bad handoff, target users who confirm the missing items are the right ones, and a demo that shows the same bad case being blocked and then cleared. This standard is unverified.

## 4. Innovation / Idea

### (a) What likely caps the score now

- Checklist plus workflow validation is already common. Smart Checklists for Jira says it can set assignees, due dates, statuses and priorities in the issue view, use templates, and validate checklist completion on workflow transition: https://marketplace.atlassian.com/apps/1216451/smart-checklist-for-jira-enterprise?tab=overview&hosting=cloud
- Checklists for Jira (Free) by HeroCoders says it has reusable templates to prevent skipping steps, and the listing shows 30,299 installs: https://marketplace.atlassian.com/apps/1220209/checklists-for-jira-free-by-herocoders
- Decision tracking in Jira is also not new as a Codegeist idea. Decision Radar is described as tracking undocumented decisions and quantifying decision debt in Jira: https://codegeistxawr.devpost.com/project-gallery?page=4&ref_content=winner_announcement_email&ref_feature=engagement&ref_medium=email

Your likely difference is narrower: teach-back checked by plain code against a decision ledger, plus stale acknowledgement when fields change. That exact combination is unverified as novel because the provided search results do not prove no one else does it.

### (b) Highest-value changes in about 5 weeks

1. **Lead with only the difference.** Do not pitch “checklist for handoffs.” Pitch: “receiver must read back the handoff; plain code rejects a read-back that breaks a recorded decision; acknowledgement goes stale when the item changes.” Estimate: 2-3 hours of rewriting, unverified. Evidence: checklist apps already claim templates, assignees, due dates, and workflow checks: https://marketplace.atlassian.com/apps/1216451/smart-checklist-for-jira-enterprise?tab=overview&hosting=cloud
2. **Add an honest comparison table in the submission.** Columns: checklist apps, decision tracking apps, Handoff Guard. Rows: checklist templates, workflow block, decision ledger, teach-back contradiction check, stale acknowledgement. Only mark what you can demo. Estimate: 2 hours, unverified. Evidence: HeroCoders’ checklist listing claims reusable templates to prevent skipping steps: https://marketplace.atlassian.com/apps/1220209/checklists-for-jira-free-by-herocoders
3. **Make the Rovo/Teamwork Graph part serve the difference, not decoration.** Demo: Rovo explains which decision blocks the item, and Teamwork Graph suggests a person with context. If either is fake or manual, say so or cut it. Estimate: 4-8 hours, unverified. Evidence: Codegeist 2026 frames the challenge around Teamwork Graph connecting goals, work, people, decisions, and outcomes: https://codegeist2026.devpost.com

### (c) What a 10 would look like

A judge can say in one sentence why this is not Smart Checklists and not Decision Radar, and the video proves that sentence. Example standard: “It does not just list tasks; it tests whether the receiver understood the binding decisions, and it invalidates that understanding when the work item changes.” That is unverified as a winning standard.

## 5. Presentation

### (a) What likely caps the score now

Your Presentation 6 is not credible while the video is unfilmed, unverified. Codegeist 2026 requires a demo video under 5 minutes: https://codegeist2026.devpost.com
Codegeist 2025 rules say judges are not required to watch beyond five minutes: https://codegeistxawr.devpost.com/rules

If the video is missing, late, or feature-led, the other four criteria also drop because judges cannot see the product working end to end. That knock-on effect is unverified, but direct.

### (b) Highest-value changes in about 5 weeks

1. **Film one end-to-end story, under 5 minutes.** Script: 0:00-0:30 problem and audience; 0:30-1:00 bad reassignment; 1:00-2:30 panel verdict, validator block, teach-back refusal; 2:30-3:30 fix to Clear; 3:30-4:15 field change makes acknowledgement stale; 4:15-4:45 who it is for and limits. Estimate: 6-9 hours, unverified. Evidence: AngelHack gives a three-minute demo structure starting with problem and one-line solution in the first 30 seconds, then demo: https://angelhack.com/blog/10-tips-to-help-you-rock-your-next-hackathon-demo
2. **Start the video and submission early, not at the end.** Write the Devpost text from the video script so both say the same problem, audience, and limits. Estimate: included above, unverified. Evidence: Devpost advises starting the demo video early and leaving at least two or three hours to polish, record, and upload: https://info.devpost.com/blog/6-tips-for-making-a-hackathon-demo-video
3. **Make the first 30 seconds plain.** Say the problem, audience, and one-line solution before any feature tour. Estimate: 1 hour, unverified. Evidence: Devpost says to quickly set the scene and explain why you built it in a few sentences: https://info.devpost.com/blog/how-to-present-a-successful-hackathon-demo
   Atlassian’s Codegeist video also includes advice that teams that invested in presentations were often more successful: https://www.youtube.com/watch?v=ZzojFaRVYhg

### (c) What a 10 would look like

A judge watches once, under 5 minutes, and can repeat back: the problem, the audience, what blocked the handoff, why teach-back was refused, how it became Clear, and why stale acknowledgement matters. This standard is unverified.

## Ranked top 5 across all criteria by expected points gained per hour

All point and hour estimates are unverified.

| Rank | Change | Time est. | Why it ranks here |
|---:|---|---:|---|
| 1 | Film the end-to-end video and write Devpost text from the same script | 6-9 hrs, unverified | Presentation is currently blocked by no video. It also makes Tech, Design, Impact, and Innovation easier to judge. Possible gain: Presentation +3 to +5 points, unverified. |
| 2 | Test install on second account and write judge test instructions | 4-6 hrs, unverified | Prevents the worst failure: judges cannot run it. Codegeist requires an installation link for testing: https://codegeist2026.devpost.com Possible gain: protects Tech and Design from a large drop, unverified. |
| 3 | Rewrite pitch around one audience, one problem, and the checklist/decision-app difference | 3-4 hrs, unverified | Cheap writing fix that helps Impact and Innovation. Checklist apps already cover much of the generic surface: https://marketplace.atlassian.com/apps/1216451/smart-checklist-for-jira-enterprise?tab=overview&hosting=cloud Possible gain: Impact +1, Innovation +1, unverified. |
| 4 | Get 3-5 target-user walkthroughs/interviews and fix the top confusion | 6-10 hrs, unverified | This is the only listed fix that directly attacks “no real users.” Evidence about user evidence and workflow fit is supported here: https://ai-beavers.com/blog/how-to-judge-hackathon-complete-guide Possible gain: Impact +1 to +2, Design +1, unverified. |
| 5 | Add empty states and panel discoverability/admin instructions | 4-6 hrs, unverified | Fixes a known Forge panel problem: panels are hidden until opened: https://community.developer.atlassian.com/t/enabling-jira-issue-panels-by-default-a-guide-for-jira-administrators/91322 Possible gain: Design +1, Tech +0.5, unverified. |

Do not build more modules in the remaining time, unverified. You already have enough surface. Spend the hours on install proof, user proof, clear novelty framing, and the video.


---

# Round 2 (2026-11-13): primary sources, read in full

Dev research, not product text. Run by Claude, not by Muse: 26 Tavily searches and 19 pages read in full with Tavily extract (Codegeist 2026 rules and resources, Atlassian developer docs, a Codegeist judging thread, Atlassian webinars, competitor pages). Raw results stay outside the repo. A claim is listed as a fact only where a page read in full states it; everything else says "unverified". Round 1 above is kept as it was; where Round 2 contradicts it, that is said below.

## What the rules say (codegeist2026.devpost.com, /rules, /resources)

- Submission period ends Tue 2026-12-22 12:00 PT. **Judging runs 2027-01-05 to 2027-02-03**, winners around 2027-02-15. The install link must keep working through 3 February.
- Prizes: 1st $15,000, 2nd $8,000, 3rd $5,000, each three times (one per category: Software Teams, Business Teams, Specialized Industries). Four bonus prizes of $1,500, six winners each: Best Agents (`rovo:agent`, `rovo:agentConnector`, or reusable `rovo:skill` and `rovo:action`), Best app with MCP (`rovo:mcp`), Best Teamwork Graph integration (connects data into the graph and/or consumes the Teamwork Graph API), Best Marketplace published app (published or submitted for listing; link the listing or the review ticket).
- Stage One is pass/fail (fits the theme, uses the required APIs). Stage Two scores five equally weighted criteria. A tie is broken by the higher Technological Implementation score, then Design, and so on down the list.
- The video: under five minutes, public on YouTube, it must demonstrate the project "and any relevant bonus prize specifics", no third-party trademarks or copyrighted music. Judges are not required to watch past five minutes. The submission needs install instructions for every configuration step, and a write-up for each bonus prize claimed.
- **Our app already declares** `rovo:agent`, `rovo:skill`, `rovo:mcp` and calls the Teamwork Graph API (`manifest.yml`), and `docs/DEVPOST.md` claims three of the four bonuses. Only the Marketplace bonus is unclaimed. This contradicts Round 1, which doubted that saved queries count: the rule says the app "consumes data from the Teamwork Graph API", and `requestTeamworkGraph` is that API.

## How judging works (Atlassian's own words)

- Codegeist 2025 organizers' reply (codegeistxawr.devpost.com forum, "Is the review judging team's site visible…"): a winner passes four rounds, from eligibility screening to written and video review, then technical review, then final judging. The write-up and video are judged first; submissions that pass are then installed and tested by another set of judges. They say a winner needs both an outstanding content submission and an outstanding app. So the video and write-up decide whether the app is ever installed.
- Atlassian webinar, Codegeist 2025 (youtube.com/watch?v=ZzojFaRVYhg): the judges include engineers and marketing staff, and the host's advice is that teams who invested in their presentation were often the most successful.
- "Inside Codegeist 2025" (youtube.com/watch?v=ZLCA6codo8E): winners were picked on quality of the idea, implementation, and impact on real Atlassian teams; trends were practical AI, Jira and Confluence integration, and apps that keep data on Atlassian. We have the last one (Runs on Atlassian eligible, Forge storage only).
- Not settled: the Codegeist 2025 winner pages and videos were not read in full this round (the Devpost page extract returned navigation only). What the winners show on screen is unverified.

## Who else is in the space

Found by search; absence of a feature in a listing is not proof it is absent from the app.

| Entry | What the page says | What it does not say |
|---|---|---|
| "Handoff" by Vinit Shah, a Codegeist 2026 entry (video posted 2026-11-07, youtube.com/watch?v=YwStfYfZmmQ) | Builds a brief of what someone leaves behind when going on leave from the Teamwork Graph; one-click cover assignment; return brief; Rovo agent and MCP tools | Any rule, any decision, any receiver read-back |
| Handoff Pulse for Jira (Marketplace, vireltix.com/apps/handoff-pulse) | Structured shift handovers: create, assign, link, acknowledge, carry forward, revision awareness | Checking a handover against recorded decisions |
| Simple Decision Log, Teamcision, Decision Register, Approval Gate (Marketplace) | Decision registers; Approval Gate asks for sign-off before a transition | Binding decisions applied to a handoff, or refusing a read-back |

Judges will probably see the word "handoff" twice. Our difference is real but must be said in the first 30 seconds: the other entry writes a brief, and our app decides whether the handoff may proceed, with plain code, from decisions a team recorded, and refuses a read-back that contradicts one. I found no listing that does this; that is a search result, not a proof.

## Evidence for the problem (read at the source)

- **I-PASS, NEJM 2014** (nejm.org/doi/full/10.1056/NEJMsa1405556): a structured handoff program was associated with a 23% relative reduction in medical errors and a 30% relative reduction in preventable adverse events across nine hospitals. This is healthcare, not software; it is the basis of our design (illness severity, action list, contingency, synthesis by the receiver), not proof that our app works.
- **Bug tossing** (Jeong, Kim, Zimmermann 2009, dl.acm.org/doi/abs/10.1145/1595696.1595715): in Mozilla and Eclipse 37-44% of bug reports are reassigned, and reassignment increases time to fix. Xia et al. 2014 (das.encs.concordia.ca/pdf/Xia_CSMR2014.pdf): about 80% of bug reports have fields reassigned, and these cause fix delays. Guo et al. 2011 (Microsoft Research) is the counterweight: reassignment is not always bad. Say so rather than citing only the alarming figure.
- **Atlassian State of Teams 2025**, as cited on atlassian.com/blog/teamwork/atlassians-guide-to-out-of-office-for-async-teams: only 20% of knowledge workers are confident in their team's process for sharing information on decisions that affect each other's work. This is the closest Atlassian-own number to "decisions do not travel with the work". Secondary citation; the report itself was not read.
- Still no study found that measures lost context on a Jira reassignment. Round 1's IT-ticket figure (HappySignals) applies to support desks only. Do not claim more.

## Forge reach: what is cheap, what is not

- `jira:issueContext` is documented for UI Kit (`render: native`) and shows a collapsible panel under the issue's fields on the right, in the new issue view. A second, small panel there could show only the verdict and the first action. Unverified: whether people see it without opening it. A community answer says an issue panel cannot be forced open (round 1 source).
- `rovo:mcp` is **Preview**, documented as fully supported. External clients see the tools only after a site or org admin turns them on under Apps > Sites > Connected apps. A community thread reports an error when the app is connected to Jira and Confluence at once; we are Jira only. Judges therefore need an install step for MCP, and the video should show one external-client call.
- Teamwork Graph connectors exist (Forge module, `@forge/teamwork-graph`, announced generally available) but the object types listed on the docs page have no "decision" type. Writing our decisions into the graph would be an approximation (document) and is not cheap. Not recommended before the video.
- Runs on Atlassian is detected automatically and requires no data egress (docs page). We kept it by using `llm` and no web trigger.

## The Marketplace bonus conflicts with the install link

Atlassian's "Distribute your apps" page states that an app **submitted for listing on the Marketplace cannot be shared by installation link**; to test it you copy the code into a new unlicensed app and share that one. The contest requires an install link for judges and offers the bonus for a listing or review ticket. Doing both on one app is therefore not possible as documented. The only route is a second app (new app id) for the listing, which the rules' "each Submission must be unique" clause may or may not tolerate: unverified, ask the hackathon manager (the contact link is on the Devpost page). Review prerequisites from Atlassian's guidelines and a solo developer's checklist (community.developer.atlassian.com, topic 103220): partner and identity verification, a per-scope justification, a shared support contact with response targets, a privacy and security tab, security questionnaires. Review can take up to a month, and some Forge apps have waited months; only "submitted" is required.

## Ranked actions

Hours are my estimates. "Owner" needs the owner's accounts or voice.

| # | Action | Lifts | Owner h | Claude h | Evidence | Risk |
|---|---|---|---|---|---|---|
| 1 | Film the video: problem and audience in the first 30 seconds, one end-to-end story, a short segment per bonus (Rovo agent, an external MCP client call, Teamwork Graph people), under 5 minutes, no music | Presentation, and the gate to every other round | 5-8 | 1 (script) | Four-round judging thread; rules ask for bonus specifics; webinar on presentations | Audio and screen quality |
| 2 | Judge path in `docs/DEVPOST.md` and README: install link, which Atlassian apps, how to open the panel (Apps button), the site-admin step that turns on MCP tools, sample data, a 10-minute walkthrough | Technical review round | 1 | 2 | Rules ask for every configuration step; MCP admin enablement | Low |
| 3 | Rewrite the pitch: one named audience, one sentence on what differs from a brief or a decision log, the "Handoff" entry and Handoff Pulse handled by contrast | Innovation, Impact | 0.5 | 2 | Competitor table above | Low |
| 4 | Replace the single support-desk statistic with the three sources above, each with its limit | Impact | 0.5 | 1 | NEJM, Jeong, Xia, State of Teams | Low |
| 5 | Three to five real testers, one permitted quote | Impact, Design | 3-6 over days | 0.5 | Rules: "real problem for a real audience" | Needs people; Atlassian Community and r/atlassian have precedents of beta-tester requests |
| 6 | Visibility: a small `jira:issueContext` panel plus the empty states Round 1 asked for | Design | 0.5 | 4-6 | Forge docs; round 1 | Unverified that it is seen unopened |
| 7 | Marketplace bonus via a second, listed copy, only after a yes from the hackathon manager | A $1,500 bonus chance, not a score | 4-8 plus waiting | 3-4 | "Distribute your apps" page | Two apps to keep in step; verification delays; do last |

Not recommended: a Teamwork Graph connector, more modules, any new surface beyond item 6. Round 1's advice to stop building stands.

## Corrections this round implies (listed, not applied)

- `docs/DEVPOST.md`: "287 unit tests" is now 289; add the judge path (item 2); state the MCP admin step; name the Handoff Pulse and "Handoff" contrast.
- `docs/VIDEO.md`: Rovo, MCP and Teamwork Graph are caption-only in the closing card, but the rules ask the video to demonstrate bonus specifics. Give each a short on-screen moment. Put the pitch first, since marketing reviewers watch it.
- Do not use "Generate new link" in the developer console after submission: it disables the old link. Keep sharing on until 3 February.
- The 427, 1,787 and 156 participant counts on cached Devpost pages disagree; none is cited here.

## What Round 2 could not settle

- No scores of past entries exist; judges score at their discretion. Nothing here predicts a number.
- Winner pages and videos were not read; what a top entry shows on screen is unverified.
- Whether `jira:issueContext` is seen without opening it, and whether a second listed app is allowed, are open.
