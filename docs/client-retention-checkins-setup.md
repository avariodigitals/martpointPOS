# Client Retention and Check-Ins: setup and recovery guide

This guide covers the founder/client check-ins in MartPointPOS and the usage signal sent by each MartPoint Retail installation. They are two apps with a small authenticated bridge; they do not share a database.

## The URLs that must agree

There are three URL roles. Keep them distinct:

| Role | Example / source | Purpose |
|---|---|---|
| Retail installation URL | `https://shop.example.com/` or `https://example.com/retail/` | The canonical URL of that client's CodeIgniter install. |
| MartPointPOS deployment URL | `business_deployments.environment_url` | Maps the canonical install URL to one business record. |
| Fleet registration URL | `db_fleet_installs.install_url` on the Central Retail app | Proves the install owns its private `install_key`. |

For automatic enrollment, the first URL, the deployment URL, and Fleet's registered URL must identify the **same HTTPS URL, including any subfolder path**. The enrollment code lowercases the hostname and normalizes a trailing slash; do not rely on other URL variations being treated as equivalent. A `www` alias, a different subfolder, `http` versus `https`, a query string, or a wrong domain will fail closed. The enrollment code deliberately does not use `admin_url` or `online_store_url` as proof of the software install.

The current production endpoints in the Retail reporter are:

- Enrollment: `https://martpoint.com.ng/api/usage/enroll`
- Usage report: `https://martpoint.com.ng/api/usage/ping`
- Fleet proof: `https://central.martpoint.com.ng/fleet/verify_usage_install` (overridable with MartPointPOS `FLEET_CENTRAL_URL`)

If the public MartPointPOS domain changes, update the Retail reporter's API base URL as part of the same release. If the Fleet domain changes, set `FLEET_CENTRAL_URL` in the MartPointPOS production environment. Do not change only one side of a domain move.

## Repair a URL mismatch

Do this for one affected client first:

1. Copy the public URL from the browser address bar when the user opens the Retail POS. It must load the POS directly over HTTPS and should be the canonical URL, with no query string. Include the subfolder if the app is installed under one.
2. Confirm Retail generates the same URL as `base_url()`. In cPanel, check the domain's HTTPS/SSL and document root. If TLS terminates at a proxy, verify CodeIgniter still sees HTTPS; `application/config/config.php` currently infers the scheme from `$_SERVER['HTTPS']`.
3. In MartPointPOS, mirror that URL into the business deployment's `environment_url`. The current business detail page displays this value but does not provide an edit form; the admin `PATCH /api/admin/businesses/{businessId}/deployments` endpoint accepts `environmentUrl` for an authorized admin. Do not mistake the read-only display for a saved change.
4. In Central Fleet, confirm the corresponding installation is registered under the same exact URL. If its URL is stale, correct/re-enroll the installation through Fleet's supported flow so its `install_key` remains associated with that install. Never copy or paste the private key into a ticket or this guide.
5. Reload the client's POS and use it while signed in. Open browser DevTools → Network and confirm the Retail request to `usage/ping` returns HTTP 200. That response only means the local request completed; it does **not** prove Central matched the install.
6. In MartPointPOS → Settings → Client Check-Ins, refresh the page. Confirm the client changes from **Not connected** to **Recently active** and inspect recent check-in issues if it does not.

If the client is hosted under a new domain, update all three URL records and verify TLS before testing. If two clients share one hostname in different subfolders, keep their full paths distinct. Never solve an attribution mismatch by relaxing matching to hostname-only: that could credit activity to the wrong business.

### If Business Details says “No deployment record exists”

That message is **not** a URL mismatch. The Business Details page looks up `business_deployments` by the Next.js business UUID. A Fleet row for `https://modestwears.martpoint.com.ng/` does not create or link that Next.js row; Fleet and MartPointPOS keep separate records, and there is no automatic URL-based import/link in this flow.

Likely causes are a legacy business created before deployment tracking existed, a business imported/created outside the current onboarding path, or a failed deployment-row insert during business creation. The current creation functions attempt that insert but do not stop or report business creation when the deployment insert fails. Also, the read helper returns `null` for both “no row” and a database lookup error, so the UI can show this message for either case.

To check the record in the Supabase SQL editor, search by business name and verify the business UUID before repairing anything:

```sql
SELECT b.id, b.business_name, d.status, d.environment_url
FROM public.businesses AS b
LEFT JOIN public.business_deployments AS d ON d.business_id = b.id
WHERE b.business_name ILIKE '%modest%';
```

If `environment_url` is non-null, the deployment row exists; investigate the page's lookup/error state. If the deployment columns are null, create or repair the deployment row through the authorized MartPointPOS deployment API, then verify the exact URL against Central Fleet. Do not insert a second row when one already exists.

### Token exists, but login/activity is still blank

The token shown by MartPointPOS proves only that an active token exists for that business. It does not prove the Retail install has enrolled with it or successfully reported. **Cron does not update login/activity timestamps.** A signed-in Retail page triggers the report; the reminders cron sends due emails.

Check in this order:

1. In the Retention page, inspect **Recent install check-ins that could not be saved**. If there is a row, note its outcome and time. `invalid` can mean a stale token or a rejected timestamp/RPC call; `save_failed` means a database write failed; `unmatched`/`ambiguous` concern the legacy hostname path.
   You can also inspect the business and token state in Supabase without selecting or exposing the token itself:

   ```sql
   SELECT b.business_name, b.last_login_at, b.last_usage_at, b.last_system_ping_at,
          d.environment_url, t.status AS token_status, t.last_used_at
   FROM public.businesses AS b
   LEFT JOIN public.business_deployments AS d ON d.business_id = b.id
   LEFT JOIN public.install_tokens AS t ON t.business_id = b.id AND t.status = 'active'
   WHERE b.id = '<BUSINESS_UUID>'::uuid;

   SELECT created_at, source, ping_type, outcome, detail
   FROM public.usage_ping_log
   WHERE business_id = '<BUSINESS_UUID>'::uuid
   ORDER BY created_at DESC
   LIMIT 20;
   ```
2. Sign into the Retail installation, then open a page and interact with it. In DevTools → Network, check that the local `usage/ping` request is made. A local HTTP 200 only confirms the PHP endpoint ran; it does not confirm the backend accepted the report.
3. On the Retail server, confirm `application/cache` is writable by PHP and cURL is enabled. `Usage_reporter` silently skips reporting if it cannot open its local cache file or initialize cURL. Confirm the shared Assist panel is included on the page being tested.
4. Confirm the outbound calls can reach `https://martpoint.com.ng/api/usage/enroll` and `/api/usage/ping`, and that the Retail server's `base_url()` is the same HTTPS install URL recorded in Central Fleet and MartPointPOS `environment_url`.
5. If the diagnostics list has no row after the attempt, the request may not have reached the Next.js API, or diagnostic logging/schema may be unavailable. Check the Retail PHP error log and MartPointPOS production function logs. Do not rotate the token as a first step; the client reporter should re-enroll after a confirmed rejected token.

### Confirming the email cron

The reminders cron is separate from usage reporting. `vercel.json` schedules `/api/cron/reminders` at minute 23 of each hour. In Vercel → Project → Cron Jobs, confirm it is enabled for the production deployment, then open its invocation logs. Set `CRON_SECRET` in the Vercel Production environment and redeploy. If the project is on Vercel Hobby, its hourly schedule is not supported; use the single cPanel fallback described above or move to a plan that supports hourly cron. A successful cron invocation can process emails, but it cannot fill a missing `last_login_at` or `last_usage_at`.

## Required database setup

Apply these MartPointPOS migrations to the production Supabase project, in order, if they are not already applied:

1. `supabase/migrations/089_client_checkin_automation.sql`
2. `supabase/migrations/092_install_checkin_tokens.sql`
3. `supabase/migrations/096_install_retention.sql`

They add the milestone automation, install tokens and diagnostics, plus the login/activity timestamps and secure persistence function. Do not apply them to the Retail MySQL database.

## Where the cron runs

The **client milestone and dormancy sweep** belongs to MartPointPOS, because that app owns the automation records and sends the email. The repository already configures it in `vercel.json`:

```text
/api/cron/reminders — minute 23 of every hour (UTC)
```

Recommended setup:

1. Deploy the MartPointPOS production branch to Vercel.
2. In Vercel → Project → Settings → Environment Variables, set a strong `CRON_SECRET` for **Production**. The cron route currently allows requests without a secret if both `CRON_SECRET` and `INBOUND_EMAIL_WEBHOOK_SECRET` are unset, so configure `CRON_SECRET` before relying on it.
3. Redeploy after setting the variable. Vercel Cron invokes only production deployments; check Project → Cron Jobs and the function logs for `/api/cron/reminders`.
4. Confirm the response is successful and due automation runs are processed. An HTTP 200 alone does not prove that a client had a pending sequence or that an email was delivered.

Do **not** also add this same reminders route to cPanel or GitHub Actions while Vercel Cron is active. Duplicate schedulers can run the sweep concurrently. The code has some duplicate-send protections, but a single scheduler is easier to diagnose.

### If Vercel cannot run this schedule

The configured schedule is hourly. Vercel's current Hobby plan only supports a cron once per day; if this project is on Hobby, use a single cPanel Cron Job as the scheduler or move to a Vercel plan that supports hourly runs. Do not configure both.

A cPanel fallback can call the **MartPointPOS production URL**, not the Retail POS URL:

```cron
23 * * * * curl -fsS --max-time 55 -H 'Authorization: Bearer REPLACE_WITH_CRON_SECRET' 'https://martpoint.com.ng/api/cron/reminders' >/dev/null 2>&1
```

Replace the placeholder with the same production `CRON_SECRET`; restrict access to the cPanel account and avoid sharing screenshots of the command. If possible, put the secret in a protected script outside `public_html` instead of directly in the cron command. Remove/disable the Vercel schedule before enabling this fallback.

GitHub Actions is a last-choice scheduler for this job. It requires a workflow on the default branch, can be delayed under load, and introduces another secret and log surface. If used, store the secret as a GitHub Actions secret and call the same production endpoint; do not put the secret in the workflow YAML.

## What each system does not do

- cPanel cron on a merchant's Retail install does not send the founder milestone emails. Retail usage is reported from signed-in user activity through the Assist panel; the usage report is intentionally outside login and sale submission.
- Retail's Fleet/system heartbeat updates system-health time only. It must not be treated as user activity or a client login.
- Client milestone emails start when onboarding access details are first sent. Existing clients may need **Start** or **Backfill** from Client Check-Ins once migrations and email settings are ready.
- Dormancy emails are disabled by default. Enable them only after a controlled client's usage timestamp is updating correctly.

## Controlled rollout checklist

1. Apply the three MartPointPOS migrations.
2. Confirm the production API domain, `FLEET_CENTRAL_URL`, Fleet registration URL, and `environment_url` are correct.
3. Deploy the Retail integration and MartPointPOS API changes.
4. Configure exactly one reminders scheduler and set `CRON_SECRET`.
5. Test one active client. Check `last_login_at`, `last_usage_at`, `last_system_ping_at`, and `usage_ping_log` in the Client Check-Ins page; a user login should update login/activity, while a system heartbeat should update system time only.
6. Start that client's sequence and use the manual sweep once to verify the email path. Keep dormancy emails off during this check.
7. After successful checks, start/backfill other clients and decide whether to enable dormancy emails.

## Official scheduler references

- [Vercel Cron Jobs](https://vercel.com/docs/cron-jobs): production deployment behavior, UTC schedule, secrets and logs.
- [GitHub scheduled workflows](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule): default-branch requirement, UTC schedule and possible delays.
