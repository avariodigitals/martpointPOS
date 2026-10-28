# Admin navigation flow

The desktop sidebar and mobile More menu use the same permission-filtered
navigation configuration in `lib/admin-navigation.ts`. No destination URLs or
permission requirements were changed; all 95 original destinations remain.

1. **Control Centre** — Dashboard, Action Centre and Reports always visible.
2. **Marketing & Content** — audiences/campaigns, content, discovery and analytics.
3. **Creator Network** — applications/interviews, creators/onboarding resources,
   challenges, submissions, performance and rewards.
4. **Partner Network** — prospects, applications, assessment/compliance, active
   partners, enablement resources, deals and referrals.
5. **Sales** — leads, meetings/calendar, estimator, quotations.
6. **Finance** — invoicing, collections, income/expenses, payouts, reconciliation
   and reports. Partner payout requests and bank changes are located here.
7. **Onboarding & Customers** — onboarding, businesses, customers, customer success.
8. **Support & Communications** — support tickets, Azera chat, voicemails,
   call campaigns/reports, knowledge and reviews.
9. **Operations** — incidents and service status.
10. **People & Careers** — role planning, recruitment, assessment, deployment,
    performance and career reporting.
11. **Administration** — access, configuration, integrations, email administration
    and audit. Includes Azera settings, voice assignments and creator/career settings.

Only the current workflow section is initially expanded, except Control Centre
which remains open as the daily shortcut group. Opening another section folds
the previous one. On navigation to another section, its most-specific permitted
parent opens automatically. Search temporarily reveals all matches; clearing it
restores the accordion. The full-menu order is identical on mobile.

The accordion behaviour is opt-in for admin: existing creator and partner portal
folding/preferences remain unchanged. Existing sidebar-width preferences are
preserved. Old multi-open admin section preferences do not override the new
process accordion.

Query-only siblings (Estimator/Quotations, income/expenses and Creator Support)
have exactly one active destination. Detail routes highlight their nearest
matching menu parent rather than every ancestor. No migrations are required.
