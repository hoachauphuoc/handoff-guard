# Market notes (desk research, 2026-11-15)

Sources are public pages found with Tavily; each figure names its source. Nothing here is a measurement of Handoff Guard's own demand, and no customer was asked.

## Where the app would sell

- Atlassian reports over 350,000 customers, and its Marketplace passed $1B in lifetime sales, with 50 businesses built on it grossing over $1M each ([Atlassian shareholder letter Q2 FY26](https://www.atlassian.com/blog/company-news/shareholder-letter-q2fy26); [Atlassian developers page](https://www.atlassian.com/developers)).
- Atlassian's 2025 annual report says it is moving from stand-alone products to apps and agents with Rovo at the centre ([TEAM 2025 Annual Report](https://s206.q4cdn.com/270053503/files/doc_financials/2025/ar/TEAM-2025-Annual-Report.pdf)). An app built on Rovo, MCP and Teamwork Graph sits in that direction.

## How Marketplace apps are priced

- Cloud app prices follow the number of licensed users of the Jira site, not the users of the app, and use progressive per-user tiers like Atlassian's own products ([Atlassian licensing](https://www.atlassian.com/licensing/cloud)).
- For scale, Jira Cloud itself is about $8-10 per user per month on Standard and about $16-20 on Premium for the first 100 users ([SaaSjet pricing guide](https://saasjet.com/blog/atlassian-pricing-guide); [Vendr](https://www.vendr.com/marketplace/atlassian)). A governance app priced as a small fraction of that is the usual shape.

## What the publisher keeps

- From 1 January 2026 a partner pays 0% revenue share on eligible Forge earnings up to $1M lifetime Forge revenue. After that the standard Forge rate is 16%, rising to 17% on 1 July 2026 ([Atlassian, Marketplace revenue share updates](https://www.atlassian.com/blog/development/updates-to-marketplace-revenue-share-2026)). For a first app this means the revenue share is not the obstacle; finding buyers is.

## Who is already there

- Decision tools exist but are small: "Decision Log: Decision Timeline & Register for Jira" (Small Batch) lists 4 installs; "Decision Register for Jira" (SynapseWorks, free) lists 2 installs, as shown on their Marketplace pages when read. They record decisions. None of what was found checks a handoff against them or refuses a contradicting read-back; that was a limited search, not proof nobody does.
- The pain is stated by users: a programme lead on the Atlassian Community asks how to track key decisions that end up scattered, and an Atlassian knowledge-base article explains how to tell the previous assignee on reassignment ([links in the Devpost text](DEVPOST.md)).

## Pricing hypothesis (untested)

The owner has not chosen a price. A hypothesis to state, and to test with a pilot, not a plan:

- Buyer: an engineering manager or release owner whose team reassigns open work.
- Shape: free for one project (as installed today); per-user monthly price on the site's licensed users in progressive tiers, which is how Atlassian charges and what buyers expect, for shared decisions across projects, the validator across workflows, and export.
- Test: the pilot in the README's "Next" list (bounce rate before and after, with a baseline and a stop condition). Without it there is no evidence of willingness to pay.

## What this does not show

- No count of how many teams reassign open work, and no estimate of the app's addressable market: the sources above give the size of the Marketplace, not of this niche.
- Install counts of the two competitors were read from their listings on one day and move.
