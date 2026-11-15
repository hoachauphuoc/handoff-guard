# Pilot protocol (not run yet)

No pilot has been run. This is the plan for one, so that a result, when there is one, can be read without arguing about method. Nothing here is a finding.

## Question

Do work items whose handoff reached Clear come back less often than work items that changed hands before the team used Handoff Guard?

"Come back" is what Bounce autopsy counts: the work item goes back to the sender, or leaves a Done status, within 7 days of the receiver's last acknowledgement.

## Who and how long

- 2 to 4 Jira Cloud teams that already reassign open work, each with a project administrator who can load decisions.
- 6 weeks: 2 weeks to record the team's real decisions and read the baseline, 4 weeks of use.
- Handoff Guard installed on one project per team; the validator added to one transition only.

## Baseline and measures

- **Baseline:** for the 8 weeks before the pilot, the share of reassigned work items that came back within 7 days, read from each project's Jira history (assignee and status changes). This needs no app.
- **Pilot:** the same share for work items whose handoff was prepared in Handoff Guard, and separately for those that were reassigned without a prepared handoff in the same weeks (a within-team comparison).
- **Also counted:** how often a read-back was refused, how often a handoff was Needs info at the time of the transition, and the minutes a sender and a receiver say a handoff took (asked, not measured).

## Sample size and what it can show

- Teams of this kind reassign a few dozen work items in 4 weeks. With fewer than about 30 handoffs per arm, a difference in the share is not distinguishable from chance, and the write-up must say so.
- The pilot can show a direction and the causes bounced handoffs lacked. It cannot show that Handoff Guard prevents bounces: teams that adopt it are not a random group, and the receiver's read-back can be written without understanding.

## Success and stop conditions

- **Success (to continue):** a lower bounce share for prepared handoffs than for the same team's unprepared ones, with at least 30 handoffs in each, and no team reporting that the check blocked work it should not have.
- **Stop early:** a team reports that the validator blocked urgent work with no way through, or more than a third of read-backs are refused for a reason the receiver calls wrong. Either is a defect in the product, fixed before the pilot goes on.
- **Neither:** if the numbers are too small, report that and extend, not claim a result.

## Price question (asked at the end, not before)

After 4 weeks, each team's administrator and one engineering manager are asked, with the monthly cost shown:

1. Would you keep it at $0.50 per licensed user per month (floor $10)? Yes, no, only at a lower price, only with another feature.
2. What would you pay for, among decisions shared across projects, the validator across workflows, export?
3. Who would approve the spend?

A "yes" in an interview is weak evidence; the plan counts only teams that keep the app installed a month after the pilot ends. The hypothesis is in `docs/MARKET.md` and stays untested until then.

## Data and privacy

- The app stores only decisions, handoffs and an activity list in the team's own Forge storage (`docs/PRIVACY.md`). Counts for the write-up are read by each team's administrator from the Decisions page (Counts by month, Bounce autopsy) and shared by them; nothing is sent to us automatically.
- Teams are named only with their permission, and no work item text leaves them.
