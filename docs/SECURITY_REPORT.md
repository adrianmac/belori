# Belori Security & Compliance Audit Report

**Report Date:** April 16, 2026
**Classification:** Confidential — Internal Use Only
**Prepared by:** Security Engineering, Threat Detection, Compliance, and Legal Audit Teams
**Product:** Belori — Bridal Boutique SaaS (Vite + React 19 / Supabase / Vercel)

---

## Finding Count Summary

| Severity | Count | Status |
|---|---|---|
| CRITICAL | 5 | Must fix immediately — exploitable now |
| HIGH | 8 | Must fix before commercial launch |
| MEDIUM | 12 | Fix within 30 days of launch |
| LOW | 5 | Backlog |
| **Total** | **30** | |

| Compliance Category | Launch-Blocking | Within 30 Days |
|---|---|---|
| Legal / Regulatory Documents | 5 | 5 |

---

## 1. Executive Summary

A four-team audit of Belori covering infrastructure security, threat modeling, data privacy (GDPR/CCPA/TCPA/CAN-SPAM), and legal compliance identified **30 technical findings** and **10 compliance/legal gaps**, of which **5 findings are critical exploits and 5 legal items are launch-blocking**. The most severe issues are: a missing Row Level Security policy on the `pipeline_leads` table that allows any authenticated user to read or overwrite any boutique's sales pipeline data; a fully unauthenticated calendar feed Edge Function that leaks client PII including names, venues, financial totals, and birthdays to anyone who knows a boutique UUID; a Stripe payment-link Edge Function that accepts any string as "authorization" without verifying the JWT or checking boutique ownership; a stored XSS vector where unsanitized database HTML is rendered directly in the contract signing page; and an automation engine that sends SMS messages to clients without checking opt-out preferences, creating direct TCPA exposure of $500–$1,500 per message per recipient. Additionally, no Terms of Service, Privacy Policy, or SMS opt-out mechanism exists anywhere in the product, making commercial launch legally untenable without remediation. The overall security posture requires urgent attention before any production traffic involving real client data.

---

## 2. Critical Findings (Exploitable Now)

---

### SEC-001 — `pipeline_leads` Table Has No Row Level Security

| Field | Detail |
|---|---|
| **Finding ID** | SEC-001 |
| **Severity** | CRITICAL |
| **Category** | Authorization / Database RLS |
| **Location** | `supabase/migrations/` — no RLS migration exists for `pipeline_leads`; `src/pages/LeadForm.jsx:129` |

**Description:** No migration enables RLS on the `pipeline_leads` table, and no policies restrict access by boutique. Any authenticated Supabase user (i.e., any boutique owner or staff member who has signed up) can execute `SELECT`, `INSERT`, `UPDATE`, and `DELETE` against every row in the table across all tenants. Compounding this, `src/pages/LeadForm.jsx` reads `boutique_id` directly from a URL parameter and inserts it verbatim into the database, enabling a cross-tenant data injection with no server-side enforcement to block it.

**Impact:** Full read and write access to sales pipeline data — prospect names, phone numbers, event types, estimated values, and conversion status — for every boutique on the platform. A single compromised or malicious user account can exfiltrate or corrupt the pipeline data of all other boutiques.

**Remediation:**
1. Add a migration: `ALTER TABLE pipeline_leads ENABLE ROW LEVEL SECURITY;`
2. Add four policies using `my_boutique_id()` (SELECT, INSERT WITH CHECK, UPDATE USING+WITH CHECK, DELETE USING).
3. In `LeadForm.jsx`, move the insert to an Edge Function that resolves `boutique_id` from a boutique slug server-side, never from a URL parameter.

---

### SEC-002 — Calendar Feed Leaks Full Client PII Without Authentication

| Field | Detail |
|---|---|
| **Finding ID** | SEC-002 |
| **Severity** | CRITICAL |
| **Category** | Authentication / Information Disclosure |
| **Location** | `supabase/functions/calendar-feed/index.ts` |

**Description:** The `calendar-feed` Edge Function requires only a `boutique_id` UUID query parameter — no JWT, no token, no authentication of any kind. It uses the Supabase service-role key internally, bypassing all RLS policies, and returns a full calendar payload including client names, venue details, guest counts, payment totals, and client birthdays. A boutique's UUID is trivially extractable from browser DevTools network requests by any authenticated user of that boutique, and UUIDs have low entropy against targeted enumeration when combined with other leaked identifiers.

**Impact:** Complete disclosure of client PII, event financials, and scheduling data to any unauthenticated HTTP caller. This constitutes a GDPR/CCPA reportable data breach if exploited.

**Remediation:** Replace UUID-only access with one of: (a) a cryptographically random, per-boutique opaque calendar token stored in the `boutiques` table and never exposed in the main app UI, or (b) JWT verification using `getUser()` with boutique membership confirmation before returning data.

---

### SEC-003 — `create-payment-link` Edge Function Does Not Verify JWT or Boutique Ownership

| Field | Detail |
|---|---|
| **Finding ID** | SEC-003 |
| **Severity** | CRITICAL |
| **Category** | Authentication / Authorization |
| **Location** | `supabase/functions/create-payment-link/index.ts:17–25` |

**Description:** The function checks whether an `Authorization` header is present but never calls `getUser()` to validate the token. Any non-empty string satisfies the check. Additionally, there is no verification that the `milestone_id` in the request body belongs to the caller's boutique — no ownership join is performed before creating a Stripe payment link.

**Impact:** Any HTTP client can forge an arbitrary authorization string to trigger Stripe payment link creation for milestones belonging to other boutiques. This could be used to misdirect payments, generate fraudulent Stripe links, or probe financial data across tenants.

**Remediation:**
1. Add `const { data: { user }, error } = await supabase.auth.getUser(jwt)` and return 401 on error.
2. Before creating the Stripe link, confirm that the `payment_milestones` row for the given `milestone_id` has `boutique_id = my_boutique_id()` — either via RLS on the service-role query or an explicit ownership JOIN.

---

### SEC-004 — Stored XSS via Unsanitized HTML in Contract Signing Page

| Field | Detail |
|---|---|
| **Finding ID** | SEC-004 |
| **Severity** | CRITICAL |
| **Category** | Cross-Site Scripting (Stored XSS) |
| **Location** | `src/pages/SignContractPage.jsx:179` |

**Description:** `contract.body_html` retrieved from the database is rendered directly via `dangerouslySetInnerHTML={{ __html: contract.body_html }}`. The `get-contract` Edge Function that supplies this data is unauthenticated by design, meaning the HTML content is reachable and injectable without authentication. If a malicious actor can write to the `contracts` table (see SEC-005), they can inject arbitrary JavaScript that executes in the signing client's browser.

**Impact:** Session hijacking, credential theft, and arbitrary actions on behalf of the signing user — which in this case is typically the end client (the bride or event organizer), not boutique staff.

**Remediation:** Install DOMPurify (`npm install dompurify`) and sanitize before render: `dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(contract.body_html) }}`. Apply server-side sanitization as a defense-in-depth measure before storing HTML in the database.

---

### SEC-005 — `contracts` Table Has No Migration and Unknown RLS State

| Field | Detail |
|---|---|
| **Finding ID** | SEC-005 |
| **Severity** | CRITICAL |
| **Category** | Authorization / Database RLS |
| **Location** | `src/components/ContractsCard.jsx`; `supabase/functions/` (contract-related functions); `supabase/migrations/` (absent) |

**Description:** `ContractsCard.jsx` and multiple Edge Functions reference a `contracts` table, but no `CREATE TABLE` migration and no RLS policies exist for it anywhere in the migration history. The table was presumably created manually in the Supabase dashboard. Its current RLS state is unknown; if RLS is disabled (the Supabase default for dashboard-created tables), any authenticated user can read, modify, or delete contracts belonging to any boutique. This finding is directly chained to SEC-004: injecting malicious HTML into a contract body triggers stored XSS on the signing page.

**Impact:** Unauthorized read/write of all contract data across all tenants; combined with SEC-004, enables stored XSS against signing clients.

**Remediation:**
1. Create a proper migration for the `contracts` table with all columns documented.
2. Enable RLS: `ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;`
3. Add policies for SELECT, INSERT WITH CHECK, UPDATE, and DELETE using `my_boutique_id()`.
4. Audit what other tables may have been created outside of migrations.

---

## 3. High Severity Findings (Must Fix Before Launch)

---

### SEC-006 — Storage Buckets Have No Verified RLS Policies

| Field | Detail |
|---|---|
| **Finding ID** | SEC-006 |
| **Severity** | HIGH |
| **Category** | Authorization / Storage |
| **Location** | `src/hooks/useEventFiles.js:19–49`; `src/pages/PhotoGalleryPage.jsx:350`; `src/pages/ClientDetail.jsx:289` |

**Description:** Multiple storage buckets are used throughout the application — `event-files`, `mood-board`, `event-photos`, `dress-images`, `voice-notes`, `event-inspiration`, `invoice-attachments` — but no bucket-level RLS policies appear in any migration. If any of these buckets were created as "public" in the Supabase dashboard, all objects within them are readable by anyone with the URL. The codebase uses `getPublicUrl()` in multiple locations, confirming that at least some bucket paths are permanently public.

**Impact:** Permanent, unauthenticated access to client photographs, voice notes, event inspiration boards, invoice attachments, and mood boards. URLs do not expire and cannot be revoked once generated.

**Remediation:**
1. Audit every bucket in the Supabase Storage dashboard immediately. Identify which are public vs. private.
2. For genuinely public buckets (`dress-images`, `mood-board`), ensure object paths are non-guessable (UUID-prefixed).
3. For all private buckets, configure RLS storage policies restricting access to the owning boutique's members.
4. Migrate all `getPublicUrl()` calls in private bucket contexts to signed URLs with short expiry.
5. Document bucket policies in a new migration file for reproducibility.

---

### SEC-007 — Staff Can Escalate Their Own Role to Owner

| Field | Detail |
|---|---|
| **Finding ID** | SEC-007 |
| **Severity** | HIGH |
| **Category** | Authorization / Privilege Escalation |
| **Location** | `src/hooks/useBoutique.js:29–34` |

**Description:** `updateStaffMember()` passes an updates object directly to a Supabase `UPDATE` on `boutique_members` with no field allowlist and no server-side check that the caller holds the `owner` role. Any staff member can open browser DevTools and execute `supabase.from('boutique_members').update({ role: 'owner' }).eq('id', their_own_id)` to elevate their privileges.

**Impact:** Any staff member (front desk, coordinator) can silently promote themselves to boutique owner, gaining access to billing controls, staff management, module configuration, and all sensitive settings.

**Remediation:**
1. Add a Postgres RLS policy restricting `UPDATE` on `boutique_members` to callers whose own `boutique_members.role = 'owner'`: `USING (EXISTS (SELECT 1 FROM boutique_members bm WHERE bm.user_id = auth.uid() AND bm.boutique_id = boutique_id AND bm.role = 'owner'))`.
2. Enforce a field allowlist in `updateStaffMember()`: only allow `name`, `initials`, `color` to be set by non-owners; only allow `role` to be set if caller is owner (enforced server-side).

---

### SEC-008 — Third-Party API Keys Stored Plaintext in `boutiques` Table

| Field | Detail |
|---|---|
| **Finding ID** | SEC-008 |
| **Severity** | HIGH |
| **Category** | Secrets Management |
| **Location** | `supabase/migrations/20260402_integrations.sql` |

**Description:** The integrations migration adds `qbo_access_token`, `qbo_refresh_token`, `mailchimp_api_key`, and `klaviyo_api_key` as plain `text` columns on the `boutiques` table. Any staff member with SELECT access to this table — or any bug that leaks boutique data — also exposes live OAuth tokens and API keys for third-party services.

**Impact:** Compromise of a single boutique staff account results in exposure of the boutique's QuickBooks OAuth token (financial data access), Mailchimp API key (subscriber list manipulation), and Klaviyo API key (email campaign access).

**Remediation:**
1. Move all integration credentials to a separate `boutique_integrations` table with column-level encryption or at minimum tighter RLS restricting SELECT to `owner`-role members only.
2. Consider using Supabase Vault (`pgsodium`) for at-rest encryption of OAuth tokens.
3. Rotate all currently stored tokens immediately upon deploying the fix, as they have been stored in plaintext since the migration ran.

---

### SEC-009 — `send-push` Edge Function Has No Authentication

| Field | Detail |
|---|---|
| **Finding ID** | SEC-009 |
| **Severity** | HIGH |
| **Category** | Authentication |
| **Location** | `supabase/functions/send-push/index.ts` |

**Description:** The `send-push` Edge Function performs no JWT verification. CORS is configured as `*`. Any HTTP client on the internet can push arbitrary notifications to any boutique's staff without any credentials.

**Impact:** Notification spam, social engineering attacks against staff via push notifications, potential for push notification phishing (directing staff to malicious URLs).

**Remediation:** Add JWT verification via `supabase.auth.getUser()` at the start of the function handler. Restrict CORS to the Vercel deployment domain rather than `*`.

---

### SEC-010 — INSERT Policies Missing `WITH CHECK` on Multiple Tables

| Field | Detail |
|---|---|
| **Finding ID** | SEC-010 |
| **Severity** | HIGH |
| **Category** | Authorization / Database RLS |
| **Location** | `supabase/migrations/20260402_purchase_orders.sql:33–39`; `supabase/migrations/20260402_bridal_party.sql`; `supabase/migrations/20260402_damage_assessment.sql` |

**Description:** RLS policies for `purchase_orders`, `bridal_party`, and `damage_reports` use only a `USING` clause. In Postgres, `USING` is evaluated on rows being read (SELECT/UPDATE/DELETE). For `INSERT`, Postgres uses `WITH CHECK`. Tables with only `USING` on their INSERT policy apply no check at insert time, meaning any authenticated user can insert rows with an arbitrary `boutique_id`, including a foreign boutique's ID. The row is then visible to that foreign boutique.

**Impact:** Cross-tenant data injection into purchase orders, bridal party records, and damage reports. An attacker can plant records in a competitor's boutique account or corrupt their data.

**Remediation:** For each affected table, replace or augment the INSERT policy with an explicit `WITH CHECK (boutique_id = my_boutique_id())` clause. Also add explicit `UPDATE` and `DELETE` policies where missing.

---

### SEC-011 — `booking_requests` Table Has No Migration and No RLS

| Field | Detail |
|---|---|
| **Finding ID** | SEC-011 |
| **Severity** | HIGH |
| **Category** | Authorization / Database RLS |
| **Location** | `supabase/functions/booking-page-data/index.ts` |

**Description:** The `booking-page-data` Edge Function inserts into a `booking_requests` table using the service-role key, but no migration creates this table or enables RLS. If the table was created manually, its REST endpoint may be accessible anonymously without any policy to restrict access.

**Impact:** Unauthenticated read access to all booking requests across all boutiques; potential for spam injection of fake booking requests at scale.

**Remediation:**
1. Create a proper migration: `CREATE TABLE booking_requests (...)` with all columns, then `ALTER TABLE booking_requests ENABLE ROW LEVEL SECURITY`.
2. Add an INSERT policy allowing anonymous inserts (for the public booking form) and a SELECT policy restricting reads to the owning boutique's members.
3. Add rate limiting in the Edge Function to prevent spam.

---

### SEC-012 — `boutique_audit_log` Table Missing — All Audit Records Silently Dropped

| Field | Detail |
|---|---|
| **Finding ID** | SEC-012 |
| **Severity** | HIGH |
| **Category** | Audit Integrity |
| **Location** | `supabase/migrations/20260402_audit_triggers.sql`; `src/pages/AuditLog.jsx` |

**Description:** `20260402_audit_triggers.sql` creates database triggers that INSERT into `boutique_audit_log` on sensitive mutations, but no migration creates the `boutique_audit_log` table. All trigger executions fail silently at runtime (Postgres drops the error if the trigger function uses `EXCEPTION WHEN OTHERS`), resulting in zero audit records being written. `AuditLog.jsx` always displays an empty state.

**Impact:** No security audit trail exists. Unauthorized access, data exfiltration, and configuration changes leave no forensic record. This is a compliance gap for SOC 2, GDPR accountability requirements, and the boutique's own terms of service.

**Remediation:**
1. Add a migration creating `boutique_audit_log` with appropriate columns (`id`, `boutique_id`, `user_id`, `action`, `table_name`, `row_id`, `old_data jsonb`, `new_data jsonb`, `created_at`).
2. Verify triggers fire correctly after the migration by inserting a test record manually.
3. Add RLS restricting SELECT to boutique owners.

---

### SEC-013 — SMS Automations Do Not Check Client Opt-Out (TCPA Violation)

| Field | Detail |
|---|---|
| **Finding ID** | SEC-013 |
| **Severity** | HIGH |
| **Category** | Regulatory Compliance / TCPA |
| **Location** | `supabase/functions/inngest/index.ts` (all 9 automation functions) |

**Description:** All 9 automation functions (`sms24h`, `sms2h`, `paymentReminder`, `overdueAlert`, `returnReminder`, `reviewRequest`, `winBack`, and others) send SMS messages via Twilio without first checking `clients.comm_prefs->>'sms_opt_out'`. The `winBack` automation additionally sends to clients inactive for 60+ days with no maximum staleness cutoff, contacting clients who may have an expectation that the relationship has ended.

**Impact:** Direct violation of the Telephone Consumer Protection Act (TCPA). Statutory damages of $500–$1,500 per unsolicited message per recipient. Class action exposure. Twilio account suspension for non-compliant messaging patterns.

**Remediation:**
1. Add `AND (comm_prefs->>'sms_opt_out')::boolean IS NOT TRUE` to every client query that precedes an SMS send in all automation functions.
2. For `winBack`: additionally skip clients inactive more than 2 years.
3. Add a "Reply STOP to opt-out" footer to every outbound SMS (see also SEC-026 in legal section).
4. Implement inbound STOP handling that sets `comm_prefs.sms_opt_out = true` on receipt.

---

## 4. Medium Severity Findings (Fix Within 30 Days of Launch)

---

### SEC-014 — Supabase Anon Key Hardcoded as Fallback in Source Code

| Field | Detail |
|---|---|
| **Finding ID** | SEC-014 |
| **Severity** | MEDIUM |
| **Category** | Secrets Management |
| **Location** | `src/lib/supabase.js:4` |

**Description:** A full Supabase anon JWT and project URL are hardcoded as fallback values in `supabase.js`. These values are present in the git history and shipped in the built JavaScript bundle.

**Impact:** The anon key is publicly accessible to anyone who inspects the bundle or git history. While the anon key has limited direct power (RLS enforces boutique scoping), its exposure allows unlimited unauthenticated API calls to the Supabase project, enabling enumeration attacks, quota exhaustion, and bypassing of any future IP-based rate limits.

**Remediation:** Remove the hardcoded fallback entirely. Add a startup assertion: `if (!import.meta.env.VITE_SUPABASE_URL) throw new Error('VITE_SUPABASE_URL is required')`. Rotate the anon key in the Supabase dashboard (note: this requires updating all deployments).

---

### SEC-015 — `myRole` Defaults to `'owner'` on Failed Membership Lookup

| Field | Detail |
|---|---|
| **Finding ID** | SEC-015 |
| **Severity** | MEDIUM |
| **Category** | Authorization / Fail-Open Logic |
| **Location** | `src/context/AuthContext.jsx:54–55` |

**Description:** `setMyRole(activeMember?.role || 'owner')` silently grants owner-level UI permissions if the boutique membership record is missing, deleted, or the query fails due to a race condition or network error. A deleted staff member who retains a valid Supabase session token would be treated as owner until they sign out.

**Impact:** Terminated staff members or users in edge-case auth states receive the highest privilege level in the UI, potentially exposing billing controls, staff management, and module configuration.

**Remediation:** Default to the least-privilege role: `setMyRole(activeMember?.role || 'front_desk')`. Additionally, redirect to an "access denied" screen if `activeMember` is null after the membership query resolves (distinguishing a loading state from a confirmed missing member).

---

### SEC-016 — `sms-inbound` Edge Function Lacks Twilio Signature Verification

| Field | Detail |
|---|---|
| **Finding ID** | SEC-016 |
| **Severity** | MEDIUM |
| **Category** | Input Validation / Webhook Security |
| **Location** | `supabase/functions/sms-inbound/index.ts` |

**Description:** The function accepts POST requests from Twilio without validating the `X-Twilio-Signature` header. Any HTTP client can forge inbound SMS messages, triggering appointment confirmation, cancellation, or other business logic. The function also falls back to the first boutique in the database if no boutique is matched from the phone number, further broadening the impact of forged requests.

**Impact:** Forged SMS can cancel legitimate appointments, manipulate booking state, and trigger confirmation messages to clients who did not initiate contact.

**Remediation:**
1. Implement HMAC-SHA1 validation of the `X-Twilio-Signature` header using the Twilio Auth Token (already available as a secret).
2. Remove the "first boutique" fallback; return 400 if no boutique is matched.

---

### SEC-017 — `ai-suggest` Edge Function Has No Rate Limiting

| Field | Detail |
|---|---|
| **Finding ID** | SEC-017 |
| **Severity** | MEDIUM |
| **Category** | Resource Exhaustion |
| **Location** | `supabase/functions/ai-suggest/index.ts` |

**Description:** The function correctly requires a valid JWT but imposes no per-user or per-boutique call rate limit. A compromised session token or a disgruntled staff member can make unlimited requests to the claude-haiku-4-5 API endpoint.

**Impact:** Anthropic API budget exhaustion; potential service degradation for all boutiques if rate limits at the API level are hit.

**Remediation:** Track invocation counts in a Supabase table (e.g., `ai_usage` with `user_id`, `window_start`, `count`). Enforce a cap of 20 requests per hour per user. Return HTTP 429 when exceeded.

---

### SEC-018 — `send-email` Edge Function Allows Sending Arbitrary Email From Boutique Domain

| Field | Detail |
|---|---|
| **Finding ID** | SEC-018 |
| **Severity** | MEDIUM |
| **Category** | Authorization / Abuse |
| **Location** | `supabase/functions/send-email/index.ts` |

**Description:** After JWT verification, the function accepts arbitrary `to`, `subject`, and `html` fields with no validation. Any authenticated boutique member can send email from the boutique's verified sender domain to any address with any content.

**Impact:** Phishing emails sent from a trusted boutique domain; bulk email abuse; sender domain reputation damage leading to deliverability failures for legitimate emails.

**Remediation:**
1. Validate that `to` is a client whose `boutique_id` matches `my_boutique_id()`.
2. Add a rate limit (e.g., 50 emails per hour per boutique).
3. Add subject-line length validation and optional allowlisting of HTML content patterns.

---

### SEC-019 — Contract Signing Has No IP Logging, No Token Expiry, and Accepts Forged Signatures

| Field | Detail |
|---|---|
| **Finding ID** | SEC-019 |
| **Severity** | MEDIUM |
| **Category** | Non-Repudiation / Audit |
| **Location** | `supabase/functions/sign-contract/index.ts` |

**Description:** The contract signing endpoint accepts a `sign_token` and a `signed_by_name` string verbatim. There is no email verification, no IP address logging, no token expiry, and the token is not invalidated after a contract is signed. Anyone who obtains a signing link (e.g., via a forwarded email) can sign — or re-sign — a contract with any name, indefinitely.

**Impact:** Contracts are legally unenforceable if their signing mechanism cannot demonstrate the identity and intent of the signer. Signed contracts cannot be trusted as non-repudiable documents.

**Remediation:**
1. Log the signer's IP address and user-agent at signing time.
2. Add `expires_at` to the contract token; reject expired tokens.
3. Invalidate the token after first use (mark contract as `signed` and reject further signing attempts).
4. Consider an optional OTP flow (email code to the signer) for higher-assurance contexts.

---

### SEC-020 — `updateBoutique` Allows Mass Assignment of Sensitive Fields

| Field | Detail |
|---|---|
| **Finding ID** | SEC-020 |
| **Severity** | MEDIUM |
| **Category** | Mass Assignment |
| **Location** | `src/hooks/useBoutique.js:9–18` |

**Description:** The `updateBoutique()` hook spreads an updates object directly into a Supabase `UPDATE` with no field allowlist. Any boutique member with owner-level UI access (or any staff member who has exploited SEC-007) can set `plan`, `stripe_customer_id`, `trial_ends_at`, `subscription_status`, or any other column on the `boutiques` table from the browser console.

**Impact:** Self-service plan upgrades without payment; manipulation of trial expiry; Stripe customer ID replacement causing billing to be directed to an attacker's Stripe account.

**Remediation:** Enforce an explicit allowlist in `updateBoutique()`: only permit updates to `name`, `email`, `phone`, `address`, `instagram`, `booking_url`, `automations`. Move all billing-related field updates (plan, stripe fields, trial) to server-side Edge Functions with Stripe webhook confirmation.

---

### SEC-021 — Payment Milestone Amounts Have No Server-Side Validation

| Field | Detail |
|---|---|
| **Finding ID** | SEC-021 |
| **Severity** | MEDIUM |
| **Category** | Input Validation |
| **Location** | `src/hooks/usePayments.js:121` |

**Description:** `usePayments.js` inserts `payload.amount` into `payment_milestones` without any positive-value constraint. Negative amounts can be inserted, which would decrement `events.paid` if any aggregation logic sums milestones.

**Impact:** Financial data corruption; potential manipulation of payment progress displays; downstream accounting errors.

**Remediation:** Add a Postgres `CHECK` constraint: `ALTER TABLE payment_milestones ADD CONSTRAINT amount_positive CHECK (amount > 0);`. Also validate on the client side before the insert call.

---

### SEC-022 — `data_deletion_requests` Table Has No RLS

| Field | Detail |
|---|---|
| **Finding ID** | SEC-022 |
| **Severity** | MEDIUM |
| **Category** | Authorization / PII Exposure |
| **Location** | `supabase/migrations/` (comment states "no RLS needed") |

**Description:** The migration comment explicitly disables RLS on `data_deletion_requests`. Unauthenticated or cross-tenant authenticated users can SELECT all pending deletion requests, exposing the name, email address, and stated reason of every client who has submitted a deletion request across all boutiques.

**Impact:** PII exposure of individuals who have specifically requested their data be deleted — a particularly sensitive class of data subject. CCPA/GDPR breach risk.

**Remediation:** Enable RLS. Add a SELECT policy restricting access to boutique owners whose `boutique_id` matches the request's `boutique_id`. Anon SELECT should be disallowed entirely.

---

### SEC-023 — Kiosk Anonymous INSERT on Appointments Has No Rate Limiting

| Field | Detail |
|---|---|
| **Finding ID** | SEC-023 |
| **Severity** | MEDIUM |
| **Category** | Abuse / Denial of Service |
| **Location** | `supabase/migrations/20260402_catalog_kiosk_appt_policy.sql` |

**Description:** An RLS policy allows unauthenticated INSERT on `appointments` (for the kiosk consultation booking flow). There is no rate limiting at the database or Edge Function level. Any caller can flood the appointments table with fake consultation bookings.

**Impact:** Staff calendar pollution with fake appointments; potential denial-of-service against the appointment management workflow; email/SMS notification spam if automations are triggered per insertion.

**Remediation:** Add rate limiting in the Edge Function or Postgres trigger (e.g., max 5 inserts per IP per hour). Consider requiring a CAPTCHA token for the public kiosk form.

---

### SEC-024 — `localStorage` Retains Boutique Context After Sign-Out

| Field | Detail |
|---|---|
| **Finding ID** | SEC-024 |
| **Severity** | MEDIUM |
| **Category** | Session Management |
| **Location** | `src/context/AuthContext.jsx` (auth state change handler) |

**Description:** `activeBoutiqueId` persists in `localStorage` under a `belori_*` key. When a user signs out, the auth state is cleared but localStorage is not purged. The next user on a shared device (salon kiosk, shared computer) loads with the previous user's boutique context pre-selected.

**Impact:** On shared devices, the subsequent user may briefly see or interact with the prior user's boutique data before their own session loads, or may be able to exploit a race condition to access the prior boutique context.

**Remediation:** In the Supabase `onAuthStateChange` handler, when the event is `SIGNED_OUT`, clear all `belori_*` keys from `localStorage` and `sessionStorage`.

---

### SEC-025 — Portal Token Never Expires

| Field | Detail |
|---|---|
| **Finding ID** | SEC-025 |
| **Severity** | MEDIUM |
| **Category** | Session Management |
| **Location** | `get_event_by_portal_token` Postgres function (SECURITY DEFINER, granted to anon) |

**Description:** The portal access token (UUID) has no expiry mechanism. It is valid indefinitely and is never invalidated when the event is completed. A token shared with a client for their event portal remains valid years after the event.

**Impact:** Permanent unauthenticated read access to event data for anyone who retains the URL (email inbox, forwarded link, browser history).

**Remediation:** Add `expires_at TIMESTAMPTZ` to the token storage. Invalidate tokens 90 days after event completion or on boutique request. The `get_event_by_portal_token` function should check expiry before returning data.

---

## 5. Low Severity Findings (Backlog)

---

### SEC-026 — Role Enforcement Is Client-Side Only

| Field | Detail |
|---|---|
| **Finding ID** | SEC-026 |
| **Severity** | LOW |
| **Category** | Authorization |
| **Location** | `src/lib/permissions.js` |

**Description:** All role-based UI gating is enforced in client-side JavaScript. A staff member can modify `myRole` in browser DevTools to unlock any screen. RLS enforces boutique-level isolation but not role-level separation within a boutique.

**Impact:** Staff can access owner-only UI screens and trigger mutations. However, if server-side Edge Functions enforce role checks (and RLS prevents cross-boutique writes), the practical blast radius is limited to within-boutique mischief.

**Remediation:** Add server-side role validation in Edge Functions handling sensitive mutations (e.g., staff management, billing changes, module toggles). Query the caller's `boutique_members.role` from the JWT user ID before processing the request.

---

### SEC-027 — Open CORS (`*`) on Internal Edge Functions

| Field | Detail |
|---|---|
| **Finding ID** | SEC-027 |
| **Severity** | LOW |
| **Category** | Configuration |
| **Location** | `supabase/functions/send-push/index.ts`; `supabase/functions/inngest/index.ts` |

**Description:** Internal-only Edge Functions (send-push, inngest) use `Access-Control-Allow-Origin: *`. These functions are not intended to be called from third-party browser contexts.

**Remediation:** Restrict CORS to the Vercel deployment domain (`https://yourapp.vercel.app`) for functions not intended to be called cross-origin. JWT-authenticated functions are lower risk but benefit from the defense-in-depth of origin restriction.

---

### SEC-028 — SMS/Email Templates Do Not HTML-Escape Interpolated Client Names

| Field | Detail |
|---|---|
| **Finding ID** | SEC-028 |
| **Severity** | LOW |
| **Category** | Output Encoding |
| **Location** | `supabase/functions/inngest/index.ts` (email HTML templates) |

**Description:** Client names and other fields are interpolated directly into HTML email bodies without escaping. A client name containing `<`, `>`, or `&` will produce malformed HTML. This is not an injection risk given the current caller context (server-side automation) but represents a correctness and quality issue.

**Remediation:** Pass all interpolated values through a simple HTML escaping function before inserting into email templates.

---

### SEC-029 — QR Codes Page Uses `dangerouslySetInnerHTML` for SVG

| Field | Detail |
|---|---|
| **Finding ID** | SEC-029 |
| **Severity** | LOW |
| **Category** | Cross-Site Scripting (Low Risk) |
| **Location** | `src/pages/QRCodesPage.jsx:38` |

**Description:** SVG output from a QR code generation library is rendered via `dangerouslySetInnerHTML`. The SVG is generated locally from library output (not from network data), so the practical XSS risk is very low. However, the pattern is a code smell.

**Remediation:** Use DOMPurify with the SVG profile (`DOMPurify.sanitize(svg, { USE_PROFILES: { svg: true } })`), or render the QR code to a `<canvas>` element instead.

---

### SEC-030 — Body Measurements Stored Indefinitely in Plaintext

| Field | Detail |
|---|---|
| **Finding ID** | SEC-030 |
| **Severity** | LOW |
| **Category** | Data Minimization / Privacy |
| **Location** | `client_measurements` table |

**Description:** Biometric-adjacent measurements (bust, waist, hips, shoe size) are stored indefinitely with no retention policy and no column-level encryption.

**Impact:** Unnecessary retention of sensitive personal data beyond its useful purpose. GDPR Article 5 data minimization principle; potentially BIPA-adjacent in some jurisdictions.

**Remediation:** Consider column-level encryption using Supabase Vault / pgsodium. Add an automated purge policy (e.g., via pg_cron) to null out measurement columns N years after the client's last event date.

---

## 6. Required Legal & Compliance Documents

### 6a. Launch-Blocking (Must Be Live Before Any Commercial Users)

| Item | Requirement | Action |
|---|---|---|
| **Terms of Service** | No ToS exists. No enforceable agreement with boutiques. No TCPA liability transfer. No limitation of liability clause. | Create ToS document. Add acceptance checkbox to `Signup.jsx` and `Onboarding.jsx`. Store acceptance timestamp and ToS version per user. |
| **Privacy Policy** | No Privacy Policy exists or is linked anywhere. Required by CCPA, Stripe ToS, Twilio messaging compliance, and Supabase AUP. | Create Privacy Policy covering data collected, retention, third-party sharing (Stripe, Twilio, Resend/Anthropic), and rights. Link from signup, login footer, and app footer. |
| **SMS "STOP" Opt-Out in All Outgoing Messages** | None of the 9 SMS automations include "Reply STOP to opt-out." Federally required under TCPA. Twilio can suspend the account. | Add "Reply STOP to opt-out" to the footer of every outgoing Twilio SMS message. Implement inbound STOP handling that sets `comm_prefs.sms_opt_out = true`. |
| **SMS Consent Recording** | No `sms_consent` field or intake UI. No record of when or how consent was obtained. TCPA requires prior express written consent for marketing SMS. | Add `sms_consent` boolean and `sms_consent_at` timestamp to the `clients` table. Add consent capture to the client intake form. Display consent status in the client detail view. |
| **CAN-SPAM Unsubscribe in Consumer-Facing Emails** | Payment reminder, review request, and overdue alert emails are sent to brides with no unsubscribe link. CAN-SPAM violation. | Add `List-Unsubscribe` header and a one-click unsubscribe footer link to all consumer-facing emails. Build the unsubscribe handler that sets the appropriate `comm_prefs` flag. |

### 6b. Within 30 Days of Launch

| Item | Requirement | Action |
|---|---|---|
| **Data Processing Agreement (DPA)** | Belori acts as data processor for boutique-as-controller. Required for GDPR compliance; best practice for CCPA. | Draft DPA defining the controller/processor relationship, subprocessors (Supabase, Stripe, Twilio, Resend, Anthropic), and data handling obligations. Present to boutique customers at signup. |
| **Conspicuous Data Deletion Mechanism** | `DataDeletionPage.jsx` is an orphaned route not linked from any navigation. CCPA requires a conspicuous right-to-delete mechanism. Also: the page submits a DB row but no automated fulfillment job exists. | Link the deletion request page from the client-facing portal and app footer. Build a fulfillment function that anonymizes client PII on request. Send confirmation email to the requester. |
| **Staff Privacy Notice** | `JoinInvite.jsx` creates staff accounts with no privacy disclosure to the staff member about what data is collected. | Add a privacy disclosure to the staff invite acceptance flow explaining what personal data is collected and how it is used. |
| **Data Breach Notification Procedure** | No incident response plan. GDPR requires notification within 72 hours of discovery. California breach notification statute applies. | Document an internal incident response runbook. Identify the notification contact for each boutique. Prepare template breach notification letters. |
| **Automation Consent Warning Banner** | Before a boutique enables SMS automations, they must acknowledge that they have obtained client consent for those messages. | Add a confirmation modal in the Automations settings tab that displays the consent requirement and records acceptance before enabling any SMS automation. |

---

## 7. Remediation Priority Roadmap

### Week 1 — Stop Active Exploits

These items represent exploitable vulnerabilities or launch-blocking legal exposure that must be addressed before any production traffic.

| Priority | Finding | Owner | Effort |
|---|---|---|---|
| 1 | SEC-001 — Add RLS to `pipeline_leads`; fix `LeadForm.jsx` boutique_id | Backend | 2 hours |
| 2 | SEC-005 — Create `contracts` table migration + RLS | Backend | 3 hours |
| 3 | SEC-003 — Fix `create-payment-link` JWT verification + ownership check | Backend | 2 hours |
| 4 | SEC-004 — Add DOMPurify to `SignContractPage.jsx` | Frontend | 1 hour |
| 5 | SEC-002 — Add auth to `calendar-feed` (opaque token or JWT) | Backend | 3 hours |
| 6 | SEC-013 — Add opt-out check to all 9 SMS automations | Backend | 4 hours |
| 7 | SEC-007 — Add RLS UPDATE policy on `boutique_members` restricting role changes to owners | Backend | 1 hour |
| 8 | SEC-010 — Add `WITH CHECK` to INSERT policies on `purchase_orders`, `bridal_party`, `damage_reports` | Backend | 2 hours |
| 9 | SEC-009 — Add JWT verification to `send-push` Edge Function | Backend | 1 hour |
| 10 | Legal — Draft and publish Terms of Service + Privacy Policy; add ToS checkbox to Signup | Legal + Frontend | 1–2 days |
| 11 | Legal — Add "Reply STOP" to all outgoing SMS; implement inbound STOP handler | Backend | 3 hours |
| 12 | SEC-012 — Create `boutique_audit_log` table migration | Backend | 1 hour |

---

### Week 2 — Close High-Risk Gaps

| Priority | Finding | Owner | Effort |
|---|---|---|---|
| 13 | SEC-006 — Audit all storage buckets; configure RLS for private buckets; migrate to signed URLs | Backend | 1 day |
| 14 | SEC-008 — Move OAuth tokens to `boutique_integrations` with tighter RLS; rotate existing tokens | Backend | 1 day |
| 15 | SEC-011 — Create `booking_requests` migration + RLS + rate limiting | Backend | 3 hours |
| 16 | SEC-015 — Fix `myRole` default to `'front_desk'` in `AuthContext.jsx` | Frontend | 30 min |
| 17 | SEC-014 — Remove hardcoded anon key fallback from `supabase.js` | Frontend | 30 min |
| 18 | SEC-020 — Add field allowlist to `updateBoutique()` | Frontend | 1 hour |
| 19 | SEC-016 — Add Twilio signature validation to `sms-inbound` | Backend | 2 hours |
| 20 | SEC-021 — Add `amount > 0` CHECK constraint to `payment_milestones` | Backend | 30 min |
| 21 | Legal — Add SMS consent capture to client intake; add `sms_consent` columns | Backend + Frontend | 1 day |
| 22 | Legal — Add CAN-SPAM unsubscribe to all consumer-facing emails | Backend | 3 hours |

---

### 30 Days Post-Launch — Systematic Hardening

| Priority | Finding | Owner | Effort |
|---|---|---|---|
| 23 | SEC-017 — Add rate limiting to `ai-suggest` Edge Function | Backend | 2 hours |
| 24 | SEC-018 — Add recipient validation + rate limiting to `send-email` | Backend | 3 hours |
| 25 | SEC-019 — Add token expiry, IP logging, and one-time use to `sign-contract` | Backend | 4 hours |
| 26 | SEC-022 — Enable RLS on `data_deletion_requests` | Backend | 1 hour |
| 27 | SEC-023 — Add rate limiting to kiosk appointment INSERT | Backend | 2 hours |
| 28 | SEC-024 — Clear `localStorage` on sign-out in `AuthContext.jsx` | Frontend | 30 min |
| 29 | SEC-025 — Add `expires_at` to portal tokens; invalidate on event completion | Backend | 2 hours |
| 30 | Legal — Publish DPA; link DataDeletionPage from navigation; build fulfillment job | Legal + Backend | 1–2 days |
| 31 | Legal — Add staff privacy notice to `JoinInvite.jsx` | Frontend | 1 hour |
| 32 | Legal — Draft incident response runbook + breach notification templates | Legal | 1 day |
| 33 | Legal — Add automation consent warning banner to Settings | Frontend | 2 hours |
| 34 | SEC-026 — Add server-side role checks to sensitive Edge Functions | Backend | 1 day |
| 35 | SEC-027 — Restrict CORS on internal Edge Functions | Backend | 1 hour |
| 36 | SEC-028 — HTML-escape interpolated values in email templates | Backend | 1 hour |
| 37 | SEC-030 — Add retention policy + evaluate encryption for `client_measurements` | Backend | 3 hours |

---

*Report generated April 16, 2026. Findings are based on static code analysis, migration file review, and regulatory cross-reference. Dynamic testing (penetration testing, fuzzing) was not performed and is recommended before launch as a complement to this audit.*
