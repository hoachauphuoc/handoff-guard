# Outside user test (script and interview guide)

A short test with 3 to 5 people who use Jira and have no part in this project. It shows whether someone new can reach the main idea alone, and what a bad handoff costs them. It is not a pilot (`docs/PILOT.md`) and it measures no bounce rate. Results go to `docs/USER-TEST-RESULTS.md`, reported as they are, failures included.

## Who and how

- 3 to 5 people who use Jira at work or in study: an engineer, a team lead, a QA or a project manager. Friends, former classmates and community contacts are fine. No employer of the owner, no customers.
- 20 minutes in all: 12 minutes of tasks, 8 minutes of interview. Video call with screen share, or in person.
- Two ways to take part. **A (preferred):** the participant installs the app on their own free Jira site. **B:** the participant watches the owner's screen and tells the owner what to click. Note which one was used.
- Nothing is recorded without consent. Notes keep a first name or a role only; no company names.

## Before the session (owner)

- Send the installation link and the free Jira site link the day before (way A).
- Have this page and an empty row of the results table open.
- Do not explain the app. If asked, say: "Do what you would do if you found it yourself."

## Opening (1 minute, read aloud)

> Thanks for helping. I am testing a Jira app, not you: if something is hard, that is the app's fault. Please think aloud. I will mostly stay quiet. May I note what you say, with your first name or role only, and may I quote you in a hackathon write-up? You can say no to the quotes and still take part.

## Tasks (12 minutes, say each task, then stay quiet)

| # | Task as said to the participant | Done when | Note if |
|---|---|---|---|
| 1 | "Install this app on your Jira site." (way A only) | The site shows the app installed | Stopped at a permission or consent screen |
| 2 | "Open any work item and find Handoff Guard." | The panel is open below the description | Could not find the apps icon ("View app actions") |
| 3 | "Get the app ready to use on this project." | "Load sample decisions (demo)" clicked, decisions listed | Read the help first; clicked something else first |
| 4 | "Imagine you take over this work and promise to ship on 15 January 2027. Tell the app." | The practice read-back is refused with a reason | Typed somewhere else; did not understand the refusal |
| 5 | "Now make a promise the app accepts." | "Would be accepted" shown | Needed "Fill an example"; needed a hint |
| 6 | "In one sentence, what does this app do?" | Answer written down word for word | — |

After each task note: finished alone, finished with a hint, or not finished; and the minutes.

## Interview (8 minutes, five questions, ask in this order)

1. "Think of the last time work changed hands in your team and something went wrong. What happened?" (Probe: what was missed, who found out, when.)
2. "What did it cost: hours, a missed date, a bug, an argument?" (Ask for a rough number of hours or days. Do not suggest one.)
3. "How does your team pass decisions to the next person today?" (Comments, a page, a meeting, nothing.)
4. "Would a refusal like the one you saw have helped in that case, or got in the way?" (Probe: who would find it annoying.)
5. "If your team used this, who would decide to pay for it, and what would make it worth paying for?" (Do not name a price unless asked; if asked, the hypothesis is $0.50 per user per month, `docs/MARKET.md`.)

Close: "Anything I did not ask that I should have?" Thank them.

## What to record (one row per person)

| Field | Example |
|---|---|
| Who | "Backend engineer", "Team lead" |
| Way | A or B |
| Tasks 1-5 | alone / hint / not finished, minutes each |
| Where they stopped or hesitated | "Looked for the app in the sidebar" |
| Their one-sentence description (task 6) | word for word |
| Last handoff that went wrong (Q1-Q2) | short summary, cost as they said it |
| Helpful or in the way (Q4) | their words |
| Who would pay, and for what (Q5) | their words |
| Quote allowed | yes / no |

## How the results may be used

- Counts are reported as counts ("3 of 4 finished task 4 alone"), never as percentages: the group is too small.
- A quote is used only with consent, with a first name or role.
- What people say about paying is weak evidence and is reported as what they said, not as demand.
- If fewer than 3 people take part, the README and Devpost say so and claim nothing from it.
