# Test Supabase Project — Provisioning Checklist

> **Status:** NOT YET PROVISIONED. Complete every step below **before** running any automated test against Belori. Tests written today would hit production project `bohdabdgqgfeatpxyvbz` — creating real boutiques, sending real Twilio SMS, inflating Resend counters, and potentially firing real Stripe webhooks. Do not skip this.

---

## Why this exists

- Tests delete, mutate, and bulk-insert data. Running them against the production Supabase project would corrupt real customer data and expose real PII.
- Inngest automations send SMS and email when certain DB conditions are met. Seeding a fake wedding 24 hours from now with your real Twilio credentials would text actual phone numbers.
- RLS tests intentionally simulate cross-boutique access violations. Logs would fill with fake "security violation" alerts from the real app.
- The service-role key you already hold (`SUPABASE_SERVICE_ROLE_KEY` for production) **must never be used by test code**.

## Two-project model

| Project | URL | Use |
|---|---|---|
| **Production** — `bohdabdgqgfeatpxyvbz.supabase.co` | `VITE_SUPABASE_URL` in `.env.local` | Real customer data. Never touched by tests. |
| **Test** (to be created) — `<your-test-ref>.supabase.co` | `VITE_SUPABASE_URL` in `.env.test` | Disposable. Wiped and re-seeded on every test run. Destroyed and recreated whenever migrations diverge. |

Both projects live under the same Supabase organization. Both use the **same codebase**; only environment variables differ at runtime.

---

## Prerequisites

- [ ] Supabase account with access to create a second project (free tier is fine)
- [ ] Supabase CLI installed locally: `npm install -g supabase@latest` then `supabase --version`
- [ ] A browser session signed in to [supabase.com/dashboard](https://supabase.com/dashboard)
- [ ] 1Password / Bitwarden / secure vault to store service-role keys
- [ ] **Test Twilio subaccount** (recommended — the main account's bill should not include test SMS). In the [Twilio console](https://console.twilio.com/): Account → Subaccounts → Create. Suffix the name with `-test`.
- [ ] **Stripe test mode** credentials (already available — Stripe's built-in test mode is fine; no separate account needed).
- [ ] **Resend sandbox domain** OR a dedicated `@resend.dev` from address for tests.

---

## Step 1 — Create the test Supabase project

1. Open [supabase.com/dashboard](https://supabase.com/dashboard) → **New project**.
2. Name it **`belori-test`** (not `belori-staging` — that's a different environment with real users).
3. Pick the **same region** as production (`us-east-1` or whatever production uses) so latency characteristics in tests match reality.
4. Generate a **strong database password** (1Password → Generate → 30-char). Save it under a vault entry named `belori-test · db password`.
5. Click **Create**. Wait ~90 seconds for provisioning.
6. From the new project's dashboard → **Settings → API**:
   - Copy `Project URL` → save as `TEST_SUPABASE_URL`
   - Copy `anon public` key → save as `TEST_SUPABASE_ANON_KEY`
   - Copy `service_role` key → save as `TEST_SUPABASE_SERVICE_ROLE_KEY` — **DO NOT paste this into any chat, screenshot, or file outside the vault.**
7. From **Settings → General**: copy the **Project Ref** (looks like `abcdefghijklmnopqrst`). You'll need this for the CLI.

**Checkpoint:** you now have three secrets stored in your vault, and one Project Ref you can share openly.

---

## Step 2 — Link the Supabase CLI to the test project

From the repo root (`C:\Dev\novela`):

```bash
# One-time: log in to Supabase CLI with a PAT from https://supabase.com/dashboard/account/tokens
supabase login

# Create a test-specific CLI context (don't overwrite the production link)
supabase link --project-ref <YOUR_TEST_PROJECT_REF>
```

> **Warning:** `supabase link` updates `supabase/.temp/linked-project.json` — meaning any subsequent `supabase db push` or `supabase functions deploy` goes to whichever project is currently linked. **Before every CLI operation**, run `supabase projects list` and verify the checkmark is on `belori-test`, not `belori`.

A safer pattern: use separate shell sessions with a helper alias.

```bash
# .bashrc / .zshrc / powershell profile
alias sbx-prod='supabase link --project-ref bohdabdgqgfeatpxyvbz'
alias sbx-test='supabase link --project-ref <YOUR_TEST_PROJECT_REF>'
```

---

## Step 3 — Apply all 61 migrations to the test project

```bash
# Verify you're linked to test
supabase projects list   # look for ✓ on belori-test

# Push every migration from supabase/migrations/ to the test project
supabase db push
```

Expected output: `Applying migration 20260402_alteration_timer.sql…` × 61. Takes ~2 minutes.

If any migration fails, the test project is in a half-migrated state — either fix the migration and re-push, or **delete and recreate the project** (Settings → General → Danger Zone → Delete project, then restart from Step 1).

**Checkpoint:** `supabase db diff` should return empty. Schema parity with production confirmed.

---

## Step 4 — Create the seed file

A deterministic seed lives at `supabase/seed.test.sql` (created alongside this checklist). It creates:

- 2 boutiques (`Maison Alpha`, `Atelier Beta`) — one on `pro` plan, one on `starter`
- 4 users — Owner A, Coordinator A, Owner B, Seamstress B
- 3 clients per boutique (Alice, Bob, Cara / Xavier, Yara, Zoe)
- 2 events per boutique (one wedding, one quinceañera), each with milestones
- 2 dresses per boutique in inventory
- 1 alteration job per boutique

Apply it to the **test project only** (never production):

```bash
# Safety: grep the URL before running
echo $TEST_SUPABASE_URL | grep -q "bohdabdgqgfeatpxyvbz" && echo "❌ WRONG — that's production" && exit 1

# Apply
supabase db execute --file supabase/seed.test.sql
```

The seed script is **idempotent** — it `TRUNCATE`s the target tables first (scoped to the seed boutiques by UUID). Safe to re-run.

**Checkpoint:** `SELECT count(*) FROM boutiques WHERE name LIKE '%Alpha%' OR name LIKE '%Beta%';` returns 2.

---

## Step 5 — Configure auth for testing

In the test project dashboard → **Authentication → Providers → Email**:

1. **Disable "Confirm email"** — tests can't click a confirmation link. Users are created `email_confirmed = true` immediately.
2. **Lower "Minimum password length"** to 8 (matches app code).
3. **Disable rate limiting** for email signups during CI runs. Settings → Auth → Rate Limits → set signups-per-hour to `1000` for test project.

In **Authentication → URL Configuration**:
- **Site URL**: `http://localhost:5173` (Vite dev)
- **Redirect URLs**: add `http://localhost:5173/**` AND `http://localhost:4173/**` (Vite preview, used by Playwright webServer)

> **Never** add `belori.app` to the test project's redirect URLs. Keep the two projects isolated.

---

## Step 6 — Deploy edge functions to the test project

```bash
# Make sure test is linked
supabase projects list   # ✓ belori-test

# Deploy every function
supabase functions deploy inngest
supabase functions deploy inngest-send
supabase functions deploy pdf
supabase functions deploy send-email
supabase functions deploy send-sms
supabase functions deploy sign-contract
supabase functions deploy stripe-webhook
supabase functions deploy get-contract
supabase functions deploy get-portal-data
supabase functions deploy booking-page-data
supabase functions deploy create-checkout-session
supabase functions deploy billing-portal
supabase functions deploy calendar-feed
supabase functions deploy ai-suggest
supabase functions deploy send-push
supabase functions deploy push-notify
supabase functions deploy sms-inbound
supabase functions deploy create-payment-link
supabase functions deploy klaviyo-sync
supabase functions deploy mailchimp-sync
supabase functions deploy qbo-sync
```

Or bulk: `supabase functions list | tail -n +2 | awk '{print $1}' | xargs -I {} supabase functions deploy {}`

---

## Step 7 — Configure secrets in the test project

These are read by the edge functions. Set them on the **test** project only:

```bash
# Required
supabase secrets set AUTOMATION_SECRET_KEY="$(openssl rand -hex 32)"

# Twilio — use test subaccount credentials
supabase secrets set TWILIO_ACCOUNT_SID=ACxxx_TEST_xxx
supabase secrets set TWILIO_AUTH_TOKEN=xxx_TEST_xxx
supabase secrets set TWILIO_FROM_NUMBER=+15005550006   # Twilio magic test number

# Resend — dedicated sandbox domain or @resend.dev
supabase secrets set RESEND_API_KEY=re_TEST_xxx
supabase secrets set RESEND_FROM_EMAIL="Belori Test <onboarding@resend.dev>"

# Stripe — test mode keys (sk_test_...)
supabase secrets set STRIPE_SECRET_KEY=sk_test_xxx
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_test_xxx

# Inngest — use a separate Inngest app for test
supabase secrets set INNGEST_EVENT_KEY=xxx
supabase secrets set INNGEST_SIGNING_KEY=xxx
```

> **Twilio magic numbers:** `+15005550006` always succeeds, `+15005550001` always fails. Use them so tests never actually send to a real phone.

**Checkpoint:** `supabase secrets list` shows all keys set on the test project.

---

## Step 8 — Create the `.env.test` file

1. Copy the template: `cp .env.test.example .env.test`
2. Fill in the three secrets from Step 1 (paste from your vault, not chat):
   ```
   VITE_SUPABASE_URL=https://<your-test-ref>.supabase.co
   VITE_SUPABASE_ANON_KEY=<paste from vault>
   TEST_SUPABASE_SERVICE_ROLE_KEY=<paste from vault>
   ```
3. **Confirm `.env.test` is gitignored** (it should be — see `.gitignore`).

---

## Step 9 — Verify isolation before a single test runs

Run the safety-rail script:

```bash
node scripts/verify-test-env.mjs
```

It will:
- ✅ Refuse if `VITE_SUPABASE_URL` contains `bohdabdgqgfeatpxyvbz` (production)
- ✅ Refuse if `TEST_SUPABASE_URL` is empty
- ✅ Refuse if `VITE_SUPABASE_URL !== TEST_SUPABASE_URL` (mismatch = misconfig)
- ✅ Ping the test project's `/rest/v1/boutiques` and confirm the two seed boutiques exist
- ✅ Print the test project's ref and the URL **in green** if all checks pass

If any check fails, the script exits 1 and no tests run. **Wire this as a prerequisite in the `test:e2e` npm script later.**

---

## Step 10 — Key storage & rotation

**Rotate the test service-role key every 90 days.** Keys are low-risk (they only access the test project) but rotation builds the muscle memory.

Storage layout in your vault:

```
belori · secrets
├── production
│   ├── supabase URL
│   ├── supabase anon key
│   └── supabase service_role   ← sensitive — last 4 chars only in chat
└── test
    ├── supabase URL
    ├── supabase anon key
    ├── supabase service_role   ← rotated quarterly
    └── DB password
```

**Never:**
- Paste the service-role key into Claude Code, Cursor, a PR description, or a Slack message.
- Commit `.env.test` to git.
- Copy the production service-role key as a fallback — regenerate a fresh one for the test project.

---

## Step 11 — GitHub Actions secrets (for later, when CI is added)

When CI comes online, add these repository secrets at `Settings → Secrets and variables → Actions → New secret`:

| Secret name | Value |
|---|---|
| `TEST_SUPABASE_URL` | from test project |
| `TEST_SUPABASE_ANON_KEY` | from test project |
| `TEST_SUPABASE_SERVICE_ROLE_KEY` | from test project |
| `TEST_STRIPE_SECRET_KEY` | test mode `sk_test_...` |

Never add production equivalents to the test workflow's environment.

---

## Safety rails summary

1. Separate Supabase projects → no URL collision possible
2. `.env.test` gitignored → can't leak to repo
3. `scripts/verify-test-env.mjs` → refuses production URLs at runtime
4. Twilio magic numbers → no real SMS on happy or sad path
5. Stripe test mode → no real charges
6. Resend sandbox → no real emails to real people
7. Seed script `TRUNCATE`s by UUID scope → can never wipe production even if misfired
8. Edge function deploys gated on `supabase projects list` check

---

## Completion checklist

Before moving to Playwright install, confirm:

- [ ] `belori-test` project exists in Supabase dashboard
- [ ] All 61 migrations applied (`supabase db diff` clean)
- [ ] All 22 edge functions deployed to test project
- [ ] All edge-function secrets set on test project
- [ ] `supabase/seed.test.sql` applied → 2 seed boutiques present
- [ ] Auth email-confirmation disabled, rate limits relaxed
- [ ] `.env.test` exists with correct URLs/keys, gitignored
- [ ] `node scripts/verify-test-env.mjs` exits 0 with green checkmarks
- [ ] Three secrets safely stored in password manager
- [ ] Production `.env.local` untouched and still working

**When every box is checked**, tell me and I'll proceed to install Playwright + scaffold the first five smoke tests against the test project.

---

## Appendix — resetting the test project

During development you'll want to blow away the test DB between runs.

Full reset (nuke all data, re-run migrations, re-seed):
```bash
supabase db reset --linked   # requires belori-test linked
supabase db execute --file supabase/seed.test.sql
```

Data-only reset (keep schema, re-seed):
```bash
supabase db execute --file supabase/seed.test.sql   # idempotent — TRUNCATEs first
```

Add either to your test scripts as `"test:e2e:reset": "supabase db execute --file supabase/seed.test.sql"`.
