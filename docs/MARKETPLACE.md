# Can Handoff Guard earn money on the Atlassian Marketplace?

Researched 2026-11-12. Facts are cited with the official URL; anything not confirmed is marked **UNVERIFIED**. Several Atlassian pages are dated 2026 and may change; re-check before acting.

## Direct answer

Possibly, but not much and not soon. An individual in Vietnam can register as a partner and sell a Forge app through Atlassian, and Atlassian passes on 83-100% of revenue. The obstacle is demand, not rules: the comparable decision-log and sign-off apps listed today show 1 to 35 installs and no reviews. A realistic first-year outcome for a niche solo app is **between $0 and a few hundred dollars (estimate, not a fact)**, and Atlassian only pays out once profit reaches $500. Treat Marketplace as a free option with small upside, not an income plan, and do not let it endanger the Codegeist submission.

## 1. Who may sell

- Individuals are allowed: "create a partner profile using your name"; no company needed. Profile is created at marketplace.atlassian.com/manage/vendor/create. https://developer.atlassian.com/platform/marketplace/become-a-partner/
- Partner Portal access needs a paid-via-Atlassian app and a private-domain email; approval criteria say no Gmail/Yahoo for paid-via-Atlassian apps. The owner's current email is Gmail, so a custom-domain address is needed. https://developer.atlassian.com/platform/marketplace/become-a-partner/ , https://developer.atlassian.com/platform/marketplace/app-approval-guidelines/
- Partner Verification (one time, a ticket per partner): name, physical address, "registration number and/or tax identification number", passport/ID of the primary contact, a camera device, identity check through Stripe Identity; forms due within 14 days; a rejection means no uploads. https://developer.atlassian.com/platform/marketplace/partner-due-diligence/
- Must be 18+. https://www.atlassian.com/licensing/marketplace/partneragreement
- Payout: EFT to "a valid bank account in your name", paid in USD, minimum US$500 (or equivalent), bank fees are the partner's. Same agreement, Section 4.3-4.4 (above URL).
- Tax: Atlassian collects and remits sales tax to buyers; the partner pays income tax on payouts; Atlassian may withhold taxes. Same agreement, Section 4.7.
- **W-8BEN: UNVERIFIED in official docs.** One community member (a sole trader in Portugal) reports that Atlassian asked for a TIN to avoid the default 30% US withholding, accepted a W-8BEN with a foreign tax ID, and sent the form through a support ticket. Anecdote only, not tax advice. https://community.developer.atlassian.com/t/individual-developer-no-registered-company-whats-the-minimum-verification-needed-to-publish-a-paid-via-atlassian-app/102404
- Vietnam-specific: whether a Vietnamese personal tax code is accepted, whether the US-Vietnam treaty reduces withholding, and Vietnamese income-tax treatment of the payout are all **UNVERIFIED**. Ask a local accountant and Atlassian during verification.

## 2. Business models and licensing

- Three payment models: Paid via Atlassian, Paid via Vendor, Free. Cloud Paid via Atlassian offers monthly and annual billing. https://developer.atlassian.com/platform/marketplace/pricing-payment-and-billing/
- A free trial exists in the UI ("Try it free") and as a test license state (`forge install --license trial`); trial terms are **UNVERIFIED**. https://developer.atlassian.com/platform/marketplace/listing-forge-apps
- Licensing for Forge is declared with `app.licensing.enabled: true` in `manifest.yml`, then `forge deploy -e production`. Code reads `context.license.active` (resolvers) or `view.getContext()` (UI); `license` is undefined for free/unlisted apps. https://developer.atlassian.com/platform/marketplace/listing-forge-apps
- Payment model cannot later be changed between Free and Paid via Atlassian in either direction; fix is releasing a new version. Free to Paid via Vendor and back is allowed. Choose the model before submitting. Same page.
- **Installation-link rule:** "Once you've listed an app on the Marketplace, you won't be able to distribute the app via the developer console." To keep sharing, copy the code, create a new unlicensed app and share that by link. Also, once licensing is enabled and deployed to production, "you won't be able to install the app from the production environment until your Marketplace listing is approved." Same page.
- Runs on Atlassian is applied automatically to eligible apps (Atlassian-hosted compute and storage, no egress of in-scope data); no cost stated. Handoff Guard's declared scopes should be checked with `forge eligibility`. https://developer.atlassian.com/platform/marketplace/runs-on-atlassian/

## 3. Money

- Revenue share (Paid via Atlassian): Forge 84% from 2026-04-01, scheduled to become 83% from 2026-10-01. Forge partners keep 100% of gross up to US$1M lifetime Forge revenue (from 2026-01-01). Which rate is current today was not confirmed on the page; the 100% band makes it moot at this scale. https://developer.atlassian.com/platform/marketplace/pricing-payment-and-billing/
- Timing: paid within 30 days after the end of the month in which accrued profit reaches $500; no less than 30 and no more than 60 days after a sale. Same page.
- Refunds: full refund in the first 30 days "no questions asked"; none after 30 days for customers. Atlassian may offset refunds against later payments. Same page; agreement Section 4.5.
- Listing fee: none found on the pages read (agreement Section 4 was only partly read, so not fully excluded).
- Pricing rules: no minimum; approval requires "reasonably and competitively priced". https://developer.atlassian.com/platform/marketplace/app-approval-guidelines/

## 4. Listing and approval

- Steps: enable sharing, publish developer space, complete partner verification, fill the Privacy & Security tab, create the listing, submit in the Partner Portal, answer reviewer questions, test-install on a fresh site after approval. https://developer.atlassian.com/platform/marketplace/listing-forge-apps , https://developer.atlassian.com/platform/marketplace/onboarding-hub/launch/submit-for-review/
- Review time: "Approvals take 10-15 business days" (guidelines); the Forge page says "within one week". Use 3 weeks for planning. https://developer.atlassian.com/platform/marketplace/app-approval-guidelines/
- Security: no Security Self-Assessment (retired 2023); every cloud listing fills the Privacy & Security tab (data stored outside Atlassian, logs, sub-processors, residency, post-uninstall retention, GDPR role, security contact). The guidelines list it as a prerequisite. Baseline requirements include least-privilege scopes, named security contact, incident notification. https://developer.atlassian.com/platform/marketplace/security-privacy-tab/ , https://developer.atlassian.com/platform/marketplace/security-requirements/
- Not required for a basic listing: Bug Bounty, Cloud Fortified (closed to new submissions, phased out by end of 2026), Atlassian Enterprise Certified (needs pen test, public bug bounty, SOC 2 / ISO 27001, 24/5 support; far out of scope). https://developer.atlassian.com/platform/marketplace/atlassian-enterprise-certified-program/
- Support: no baseline response time found for a basic listing (**UNVERIFIED** beyond that). Developer Community registration and documentation are required.
- Other approval rules: privacy policy, documentation, marketing assets, trademark-safe name ("X for Jira" ok, "Jira X" rejected), Marketplace Partner Agreement accepted. Same guidelines.
- This app stores Atlassian account IDs only in Forge storage (no egress), which keeps it eligible for Runs on Atlassian and makes the privacy answers simple: data stays in Atlassian-hosted storage, deleted on uninstall (confirm the uninstall behavior in code before answering). Account IDs are personal data under GDPR, so state the processor role and retention honestly.

## 5. Codegeist 2026 bonus "Best Marketplace published app"

**UNVERIFIED.** https://codegeist2026.devpost.com/rules returns HTTP 403 (Cloudflare bot check) to both the fetch tool and the built-in browser, and a web search found nothing on this prize. The prize name comes from the owner's task, not from a page I read. The owner should open the rules page in a normal browser and check: what proof is required (listing URL or review ticket), the deadline for that proof (which may be after 2026-12-22), the prize amount, and whether an installation link must keep working during judging.

## 6. Market view and first-year estimate

Comparable listings (installs and prices as displayed 2026-11-12; per-user price tables were not visible in the fetched text):

| App | Model | Installs | Note |
|---|---|---|---|
| [Decision Register for Jira](https://marketplace.atlassian.com/apps/2445040497/decision-register-for-jira) | Free, Forge | 2 | audit register |
| [Simple Decision Log](https://marketplace.atlassian.com/apps/1962325789/simple-decision-log-for-jira) | Paid via Atlassian | 4 | decision log, DACI |
| [Power Pack: RACI, Decisions, Risks & Sign-offs](https://marketplace.atlassian.com/apps/358874611) | Paid via Atlassian, Forge | 2 | has sign-offs before closing |
| [Teamcision](https://marketplace.atlassian.com/apps/1227148) | Free, unsupported | 35 | decision log |
| [Anchorr](https://marketplace.atlassian.com/apps/3628381141) | Free | 1 | advisory conflict surfacing |

None has reviews. None enforces a transition the way Handoff Guard does, so there is a gap, but no evidence yet that anyone pays for it. Install counts as low as these suggest a new listing without marketing gets single digits.

**Estimate (not a fact):** assume 2-10 paying sites in year one and a price of a few dollars per user per month for small teams; that is roughly tens to a few hundred dollars gross, likely under the $500 payout threshold, so possibly no payout in year one. Reaching a living wage would need hundreds of paying sites and real marketing.

## 7. Costs for the owner

- Forge hosting: consumption-based with a per-app monthly free allowance (e.g. 200,000 GB-seconds compute, 0.1 GB KVS reads and writes); for Marketplace apps the vendor, not the customer, pays overage, and the same pricing applies to public and private apps. No special free tier for Marketplace apps. At this app's scale the free allowance likely covers it (estimate). https://developer.atlassian.com/platform/forge/forge-platform-pricing/
- Time: partner verification forms, privacy tab, listing assets, reviewer questions, customer support on a best-effort basis, Developer Community presence.
- Money: a custom-domain email, a privacy policy page, possibly an accountant for the Vietnamese tax side; US withholding of up to 30% if no valid W-8BEN (per the community report above).

## Steps and rough timeline to publish before 2026-12-22

Roughly 40 days from today; approval alone is about 3 weeks, so submission must happen by about **2026-11-27**.

1. Decide the model (recommended: Free, see below). Decision needed from the owner first.
2. Get a domain email and a privacy policy page; create the partner profile; start Partner Verification (14-day form limit). Days 1-5.
3. Create a **separate app** (new app ID) for the listing so the Codegeist app stays shareable by link; add `licensing` only if paid. Fill the Privacy & Security tab, listing text, assets, docs. Days 3-14.
4. Submit for review by ~2026-11-27; answer questions; test-install on a fresh site. Through about 2026-12-18.
5. Attach the listing or review-ticket evidence to Devpost if the prize rules allow it (after checking section 5).

## Risks

- **Installation-link conflict:** listing the current app (or enabling licensing and deploying to production) stops installs via the Developer Console link, which judges may use. Never list or enable licensing on the app that is submitted to Devpost; use a second app ID, and keep the original unchanged until judging ends. Also check the Devpost rules about whether the project must stay the same artifact.
- Partner verification or review can reject or slow the submission; the deadline margin is about two weeks.
- The payment model cannot be changed to or from Paid via Atlassian later; picking paid now locks it.
- Trust and support: a solo vendor with a GDPR role for account IDs takes on a duty to answer security reports and customers.
- Tax: US withholding and Vietnamese tax are unverified and may eat part of a small payout.
- Time cost versus the deadline work: the owner has 1-2 hours a day.

## Recommendation

Do not try to earn money as the goal. If the Codegeist rules (check section 5 first) do confirm a bonus prize for a published app, publish a **Free** listing from a **separate copy** of the app: zero billing risk, no price-model lock, no tax or payout friction, and it still counts as "published". Postpone Paid via Atlassian until there are real users asking for it; moving from Free to Paid via Atlassian needs a new version anyway. If the rules show no prize or unworkable conditions, skip the Marketplace for now and keep the Devpost submission untouched.
