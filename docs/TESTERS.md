# Tester kit

For the owner to send. Nothing here is posted or sent by a tool. Goal: three to five people who use Jira at work try the app and answer six questions (about 20 minutes in all, install included). One sentence from one of them, quoted with permission, is worth more to the submission than another feature.

## Who to ask

People who reassign Jira work items or receive reassigned ones: an engineer on an on-call rotation, a team lead who covers for people on leave, a project manager who moves work between teams. They need to be a site admin on some Jira site to install an app; a free Jira site is enough.

Where such requests are normal: people you know first; then the Atlassian Community forums and r/atlassian, where builders ask for beta testers. In public places say that you built the app, that it is a Codegeist hackathon entry, and do not ask for reviews or ratings.

## Invitation (edit freely)

> Hi [name],
>
> I built a small Jira app for a hackathon and I am looking for a few people who reassign work in Jira to try it and tell me where it is confusing.
>
> What it does: it changes what happens when a Jira work item is handed to another person. I am holding back the details so that your first impression is useful to me.
>
> What I am asking: about 20 minutes. Install it on a test Jira site, not your work site (a free site is fine; you need to be its admin), follow six steps, then answer six questions by message or on a short call. Jira's install screen lists four permissions: View Jira issue data, Read work items via Teamwork Graph, Read Atlassian users via Teamwork Graph, and App Storage. It stores its own records in Atlassian-hosted storage and makes no calls outside Atlassian. You can uninstall it afterwards.
>
> Install link: [installation link]
> Steps: [link to "Testing instructions" in docs/DEVPOST.md]
>
> Honest criticism is what helps. Thank you.

## What they do (ten minutes)

Steps 1 to 6 of "Testing instructions (for judges)" in `docs/DEVPOST.md`. Tell them before they start that with one account the handoff ends Blocked because sender and receiver are the same person, so it does not look like a fault. Better, if you can: invite the tester as a second user to a test site of yours, so they are the receiver and the handoff can reach Clear.

## Six questions

Ask them in this order. Do not explain the app before question 1. Write down their words, not a summary.

1. In your own words, what does this app do?
2. Think of the last time work was handed to you or by you in Jira and something was missed. What was missed, and when did you find out?
3. At which step did you stop and wonder what to do next?
4. Walk me through what happened after you submitted the read-back, including what you tried next.
5. Take the incident from question 2. Point to the step where the app would have needed the missed information, or where it would have let it pass.
6. Who on your team would have to agree before you could use this, and what would they object to?

Then: "May I quote one sentence of what you said in the hackathon submission, with your first name and role, or anonymously?" Record the answer. No yes, no quote.

## What to bring back

- For each tester: role, the step where they hesitated, their answer to question 2 in their words, and whether they allow a quote.
- Anything that did not work, with the step number.
- Do not record employer names, customer names or anything from their real Jira sites in this repo.

Reviewed once by Muse Wonder for leading questions and for what would make an admin decline; the invitation and questions 4 and 5 were changed after that review.
