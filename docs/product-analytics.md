# Product milestones

Vercel Web Analytics collects sanitized pageviews (already enabled on this project).
Milestones below are sent to /api/analytics/events and counted in the existing Neon
database as daily aggregates, so Vercel Hobby works without an upgrade. The new
product_event_counts table is created on first use. Local development without a
database reports collected:false and does not retain counts.

Read the last 30 days at /api/admin/analytics with the same admin authentication
used by /api/admin/resources: an allowlisted admin session or CRON_SECRET bearer.
The collector rejects unknown event names and cross-origin submissions and has
an ephemeral per-network abuse cap (60/minute). No user-level attribution is stored.

| Event | Trigger | Use |
| --- | --- | --- |
| search_submitted | Header search result or submission | Research engagement |
| movers_opened | Enter the Movers view, including direct links | Discovery engagement |
| portfolio_setup_started | First focus in an empty holding form | Setup intent |
| portfolio_created | First holding successfully persisted | Activation |
| holding_added | Subsequent holding successfully persisted | Continued engagement |
| return_visit | Browser visited on a previous UTC calendar day | Repeat use |

Use created / setup-started event counts as a directional activation measure,
not a user-level funnel: no persistent identity is sent. Return visits are browser
based and do not measure a cohort or cross-device retention. Refreshes on the same
day do not count as return visits. Storage clearing and blocked analytics affect
counts.

No financial properties or search text are attached. Analytics URLs discard
query strings, fragments, company symbols, and invite codes. Do Not Track disables
events and pageviews. The browser stores only a last-visit date for repeat-use
measurement.
