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
