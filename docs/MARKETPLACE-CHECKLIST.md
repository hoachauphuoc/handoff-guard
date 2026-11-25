# Marketplace listing checklist (free app)

Read from Atlassian's pages on 2026-11-18 (Tavily). Background and money: `docs/MARKETPLACE.md`. Submitting is the owner's; nothing here is submitted. The owner registered a free partner profile on 2026-11-18.

Sources: [List a Forge app](https://developer.atlassian.com/platform/marketplace/listing-forge-apps), [App approval guidelines](https://developer.atlassian.com/platform/marketplace/app-approval-guidelines), [Security workflow](https://developer.atlassian.com/platform/marketplace/app-approval-security-workflow/), [Privacy and Security tab](https://developer.atlassian.com/platform/marketplace/security-privacy-tab), [Pre-launch trust checklist](https://developer.atlassian.com/platform/marketplace/pre-launch-trust-checklist/).

## What changed against `docs/MARKETPLACE.md` (researched 2026-11-12)

- A security questionnaire now exists for new apps: an app-specific one for Forge apps (authentication, data, controls, secrets, vulnerability handling) with warning and fail signals, where **a fail signal blocks the listing**, and a partner one that is informational. `docs/MARKETPLACE.md` section 4 says no self-assessment exists; that is out of date.
- Vulnerability scanning runs at submission. A Critical or certain High finding blocks approval and the ticket returns for resubmission. `npm audit` shows findings in the dependencies of `@forge/react` and `@forge/bridge` (see `docs/SECURITY.md`); how the scanner treats them is not known until the first scan.
- Approval takes 10-15 business days (guidelines), "aim for one week" (Forge page). Plan three weeks.

## Per item: who, state

| Item | Who | State |
|---|---|---|
| Partner profile, Partner Agreement | Owner | Done 2026-11-18 (free) |
| Partner Verification ticket (KYC/KYB, ID, Stripe Identity, forms due in 14 days) | Owner | Open; only for a new app, once |
| At least one partner contact registered in the Atlassian Developer Community | Owner | Likely done (a post is live there); confirm it is the partner contact |
| Runs on Atlassian eligibility | Claude | Done: `forge eligibility` says development 10.96.0 is eligible |
| Name not infringing a trademark ("X for Jira" fine, "Jira X" rejected) | Claude | "Handoff Guard" has no Atlassian mark |
| Scope list with a reason for each scope; remote hosts and data sent | Claude | Four scopes in `manifest.yml` (`read:jira-work`, `read:graph:issue:jira`, `read:graph:user:atlassian`, `storage:app`), reasons in the README; no remote host |
| Privacy and Security tab (data outside Atlassian: none; logs; sub-processors: none; residency; deletion on uninstall; GDPR role; security contact) | Owner enters, Claude drafts answers from `docs/PRIVACY.md` and `docs/SECURITY.md` | Open |
| App security questionnaire (Forge) | Owner enters, Claude drafts | Open; read the questions first, a fail signal blocks |
| Privacy policy at a public URL | Owner | `docs/PRIVACY.md` exists in the public repo; a stable URL is needed (GitHub page is acceptable only if Atlassian accepts it: not confirmed) |
| End User Terms | Owner | Atlassian offers a standard customizable agreement; the owner should read it before using it |
| DPA | Owner | Needed only if acting as a data processor under GDPR; the app keeps account IDs, so ask during the Privacy tab |
| Personal data report and erase flow (Forge user privacy guidelines) | Claude | Export and delete per project exist; deleting one person's data on request is stated as not supported (`docs/PRIVACY.md`), done by GitHub issue. Review this answer before submitting |
| Documentation that explains setup and use | Claude | README and the start page |
| Support contact | Owner | GitHub issues only. Atlassian passes end-user questions to an email the partner gives; a mailbox is needed (a Gmail address is fine for a free app; it is refused only for paid-via-Atlassian) |
| Marketing assets: logo, banner, screenshots | Owner takes, Claude can resize | Logo and 144 px logo in `docs/marketplace/`; no banner, no screenshots. "Recommended, not required for free apps" |
| No advertising, works without a third-party account | Claude | Holds |
| Source licence matches what is reported | Claude | `LICENSE` is MIT, `package.json` says MIT |
| Listing in the Partner Portal | Owner | Open |

## The install-link problem

Once an app is listed, it can no longer be shared by the Developer Console install link, and the Codegeist entry uses that link. Atlassian staff answered this in the Codegeist 2026 Q&A webinar (pasted by the owner on 2026-11-25; not read from a page): an entry that is already listed may be installed by the judges from the Marketplace, so no extra link is needed, and a separate unlisted copy of the same app is also acceptable. Preview modules (Rovo MCP, skills, Teamwork Graph) may be used in a listed app. Not confirmed on a written page, so keep the install link working until the owner has the rules or a staff reply in writing.

So listing does not force a second app. The earlier idea of a second app with its own ID (`docs/MARKETPLACE.md`) is only needed if the owner wants to keep sharing a link after listing, or if listing happens before the judges install.

## Order

1. Owner: open the Partner Verification ticket now (14-day clock).
2. Claude: draft the Privacy and Security answers and the security questionnaire answers into a local file (no submission) once the owner has read the questions in the portal.
3. Owner: banner and three screenshots, a support mailbox, the End User Terms choice.
4. A second app is no longer needed for the judges (see above); decide only if a shareable link must outlive the listing.
5. Submit after the Codegeist submission, unless the owner wants the "Best Marketplace published app" prize and has confirmed its proof and deadline on the rules page (`docs/MARKETPLACE.md` section 5, still unverified).
