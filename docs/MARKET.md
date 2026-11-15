# Market notes (desk research, 2026-11-15)

Public pages found with Tavily (raw results: `research/market-tavily.md`), some re-checked on the live page the same day. Each figure names its source. Nothing here measures Handoff Guard's own demand, and no customer was asked.

## Where the app would sell

- Atlassian reports over 350,000 customers ([shareholder letter Q2 FY26](https://www.atlassian.com/blog/company-news/shareholder-letter-q2fy26)).
- The Marketplace has passed $1B in lifetime sales, and 50 businesses built on it have grossed over $1M each ([Atlassian developers page](https://www.atlassian.com/developers)).
- Context, not demand: Atlassian's 2025 annual report describes a move from stand-alone products to apps and agents with Rovo at the centre ([TEAM 2025 Annual Report](https://s206.q4cdn.com/270053503/files/doc_financials/2025/ar/TEAM-2025-Annual-Report.pdf)).

## How Marketplace apps are priced

- Cloud app prices follow the number of licensed users of the Jira site, not the users of the app, in progressive per-user tiers. Atlassian's example: Jira Cloud Standard is $8.60 per user per month for seats 1-100 ([Atlassian licensing](https://www.atlassian.com/licensing/cloud)).

## What the publisher keeps

- Forge apps that meet Atlassian's eligibility requirements pay 0% revenue share on earnings up to $1M lifetime Forge revenue, announced to start 1 January 2026 (check the extended-timelines post for the current date). Above that, the standard Forge rate is 16% from 1 April 2026 and 17% from 1 October 2026 ([Atlassian, extended timelines for revenue share changes](https://www.atlassian.com/blog/development/extended-timelines-for-marketplace-revenue-share-changes)). For a first app the revenue share is not the obstacle; finding buyers is.

## Who is already there

Search: Tavily query "Jira decision log app Marketplace competitors" (2026-11-15), then one live Marketplace search the same day. Install counts are as shown on the listing that day and move.

- Decision records: "Simple Decision Log: Decision Timeline & Register for Jira" (Small Batch; paid via Atlassian with a trial, price not shown; 4 installs). "Decision Register for Jira" (SynapseWorks; free; 2 installs). "Teamcision - decision making" (Daniel Boldt; free; 35 installs in the Tavily result, not re-checked).
- Adjacent handoff apps: Handoff Receipt (assignee history; free; 2 installs), ShiftRelay and Passdown (shift handover for Jira Service Management), Handoff for Jira (a manual inbox), Offboarding Transfer Utility, Successor.
- None of these, as far as their listings say, checks a handoff against recorded decisions or refuses a read-back that contradicts one. That was a limited search, not proof that nobody does.
- The problem is stated by users: a programme lead on the Atlassian Community asks how to track key decisions that end up scattered, and an Atlassian knowledge-base article explains how to tell the previous assignee on reassignment ([links in the Devpost text](DEVPOST.md)).

## Price hypothesis (untested)

- Buyer: an engineering manager or release owner whose team reassigns open work.
- Free: one project, as installed today.
- Paid: $0.50 per licensed user per month for seats 1-100, lower per user above that in progressive tiers, with a floor of $10 per month. The paid tier holds decisions shared across projects, the validator across many workflows, and export of the activity list.
- Why this price: it is about 6% of Jira Standard's $8.60 per seat, the size of a small add-on that a team lead can approve without a procurement round. At 100 users it is $50 per month, which the owner assumes (not measured) is less than the time one bounced handoff costs a team.
- Test: the pilot in the README's "Next" list (bounce rate before and after, with a baseline and a stop condition), plus asking pilot teams what they would pay. Until then there is no evidence of willingness to pay.

## What this does not show

- No bottom-up market estimate. It would be: teams that reassign open work in Jira Cloud x share that record decisions x licensed users x price; none of those factors is sourced yet.
- No cost-of-pain figure: what a bounced or reopened handoff costs has not been measured.
- No interviews and no pilot yet.
