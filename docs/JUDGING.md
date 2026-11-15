# What the judges are asked (Codegeist 2026 rules, read 2026-11-15)

Source: the official rules at `codegeist2026.devpost.com/rules`, fetched with Tavily. Check the page again before submitting; rules can change.

## Stage One (pass or fail)

The project reasonably fits the theme and reasonably uses the required APIs and SDKs (a Forge app that integrates with at least one of Jira, Confluence, Jira Service Management, Bitbucket, Teamwork Graph, Rovo). Handoff Guard: Forge, Jira, Rovo, Teamwork Graph; category Apps for Software Teams.

## Stage Two (four equally weighted criteria)

| Criterion | What the rules ask | Where we answer it |
|---|---|---|
| Technological Implementation | Does the app feel like a genuine, working, non-trivial implementation when tested, not a shallow wrapper or a single hardcoded demo path? | Pure rule core with tests; read-back teach-back, validator, governance, bounce autopsy; no hardcoded demo path (README "Try it in 3 minutes"); the Rovo, MCP and Teamwork Graph modules |
| Design | A complete, coherent product experience, not a technical proof of concept | One panel and one project page; verdict first; labelled model text; guide checklist; accessibility notes (README) |
| Potential Impact | A credible, specific case for a real problem for a real audience, and does the solution address it based on what is demonstrated? | `docs/DEVPOST.md` problem section with cited studies, `docs/MARKET.md`, the video; a pilot plan in `docs/PILOT.md` (no result yet) |
| Innovation/Idea | How creative and novel is the concept? | The receiver's read-back refused by plain code; the model never decides |

There is no separate Presentation score. The video and the text matter because judges "are not required to test the Project and may choose to judge based solely on the text" and video, and a judge needs an installation link to test (rules, Testing).

## What follows for this project

- Potential Impact is judged on what is *demonstrated*. A real pilot is not required by the criterion; a specific, credible case shown on screen is. The video should show the cost and the benefit in the demo site's own history, say it was made for the demo, and not claim results.
- Technological Implementation rewards a working path beyond the demo: say in the text which paths were exercised on the live site and which were not (`docs/PROGRESS.md`).
- Entrants must provide an installation link and a video that "explains the features and functionality through a comprehensive demonstration"; both are still owner tasks in `docs/DEVPOST.md`.
- Bonus prizes named in the rules: Best Agents (Rovo), Best app with Atlassian MCP, Best apps with Teamwork Graph integration, Best Marketplace published app (not claimed: the app is not published on the Marketplace), and a participation prize.
- A community thread asks whether judges' test sites have Rovo enabled and whether an install-link app can call Teamwork Graph without an early-access enrolment; no answer was found. The app degrades and names the source when Rovo or Teamwork Graph is unavailable, which the video should not depend on.
