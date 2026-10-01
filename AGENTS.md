<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Status feed for installed POS instances

`GET /api/status` (`app/api/status/route.ts` + `lib/status-feed.ts`) is the public feed every installed MartPoint POS polls (~15 min, server-to-server) to mirror the incident banner. It is derived from `status_incidents` — incidents are created/resolved in admin → Status (`/admin/status`).

- Contract: `{ status: "ok", generated_at: ISO, incident: { active: 0|1, severity, message, url, started_at } }` where `severity ∈ investigating | identified | monitoring | maintenance`.
- `active:0` = all-clear; installs clear only backend-sourced banners on it.
- Non-200 = keep last known state on installs (fail-open) — never return `active:0` on a backend error.
- Mapping lives in `lib/status-feed.ts` (tested in `__tests__/status-feed.test.ts`): maintenance `scheduled` windows do not count until their start time; `verifying` maps to `monitoring`; a live incident outranks a maintenance window, then impact rank, then newest.
- The banner links to `/status` (public page) with `target="_blank"`.
