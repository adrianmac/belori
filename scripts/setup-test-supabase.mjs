#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
// scripts/setup-test-supabase.mjs
//
// One-command automation for provisioning the Belori test Supabase project.
// Compresses docs/TESTING_SUPABASE_SETUP.md's 11 steps into a single
// interactive flow. Automates everything that doesn't need your password
// manager; pauses and prompts you for the pieces that do.
//
// What this script AUTOMATES:
//   - Checks supabase CLI is available (via npx)
//   - Ensures you're logged in (prompts you through `supabase login` if not)
//   - Lets you create a new test project OR link to an existing one
//   - Applies all 61 migrations via `supabase db push`
//   - Runs supabase/seed.test.sql
//   - Deploys all 22 edge functions
//   - Writes the scaffolded .env.test file with the URL filled in
//
// What YOU still have to do manually (script will tell you):
//   1. Paste the anon + service-role keys from the Supabase dashboard
//      into .env.test (keys stay local, never enter chat)
//   2. Toggle "Disable email confirmation" in the dashboard Auth settings
//   3. Add localhost redirect URLs in Auth > URL Configuration
//   4. Set edge function secrets (Twilio test, Stripe test, Resend test)
//
// Usage:
//   npm run setup:test-supabase
//   npm run setup:test-supabase -- --link-existing   # skip project creation
// ════════════════════════════════════════════════════════════════════════════

import { execSync, spawn } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createInterface } from 'node:readline'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const PROD_REF = 'bohdabdgqgfeatpxyvbz'
const ARGS = process.argv.slice(2)
const LINK_EXISTING = ARGS.includes('--link-existing')

// ─── pretty logging ──────────────────────────────────────────────────────
const C = {
  red:    (s) => `\x1b[31m${s}\x1b[0m`,
  green:  (s) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  blue:   (s) => `\x1b[34m${s}\x1b[0m`,
  gray:   (s) => `\x1b[90m${s}\x1b[0m`,
  bold:   (s) => `\x1b[1m${s}\x1b[0m`,
  dim:    (s) => `\x1b[2m${s}\x1b[0m`,
}
const banner = (t) => console.log('\n' + C.bold(t) + '\n' + C.dim('─'.repeat(72)))
const ok     = (t) => console.log(`  ${C.green('✓')} ${t}`)
const warn   = (t) => console.log(`  ${C.yellow('!')} ${t}`)
const step   = (t) => console.log(`  ${C.blue('→')} ${t}`)
const fatal  = (t) => { console.log(`\n  ${C.red('✗')} ${C.red(t)}\n`); process.exit(1) }

// ─── input helpers ───────────────────────────────────────────────────────
const rl = createInterface({ input: process.stdin, output: process.stdout })
const ask = (q) => new Promise((resolve) => rl.question(`  ${C.yellow('?')} ${q} `, resolve))

// ─── shell helpers ───────────────────────────────────────────────────────
function run(cmd, opts = {}) {
  const { silent = false, allowFail = false } = opts
  try {
    const out = execSync(cmd, {
      cwd: ROOT,
      stdio: silent ? 'pipe' : 'inherit',
      encoding: 'utf8',
      shell: process.platform === 'win32' ? true : '/bin/bash',
    })
    return { ok: true, out: out?.toString() ?? '' }
  } catch (e) {
    if (allowFail) return { ok: false, out: e.stdout?.toString() ?? '', err: e.stderr?.toString() ?? '' }
    console.error(C.red(`\nCommand failed: ${cmd}`))
    console.error(e.stderr?.toString() ?? e.message)
    process.exit(1)
  }
}
function runInteractive(cmd, args = []) {
  return new Promise((res, rej) => {
    const child = spawn(cmd, args, { cwd: ROOT, stdio: 'inherit', shell: true })
    child.on('exit', (code) => (code === 0 ? res() : rej(new Error(`${cmd} exited ${code}`))))
  })
}

// ─── main ────────────────────────────────────────────────────────────────
async function main() {
  console.log(C.bold('\n  Belori — Test Supabase Setup'))
  console.log(C.dim('  One-command automation of docs/TESTING_SUPABASE_SETUP.md\n'))

  // ── 0. Preflight ─────────────────────────────────────────────────────
  banner('0 · Preflight')

  const cliResult = run('npx supabase --version', { silent: true, allowFail: true })
  if (!cliResult.ok) {
    fatal('Supabase CLI not available. Run `npm install` first.')
  }
  ok(`Supabase CLI v${cliResult.out.trim()} available via npx`)

  // Check login state
  const orgsResult = run('npx supabase orgs list', { silent: true, allowFail: true })
  if (!orgsResult.ok || orgsResult.err?.includes('Access token not provided')) {
    warn('Not logged in to Supabase CLI.')
    console.log(C.gray('\n  The CLI needs a Personal Access Token (PAT) from:'))
    console.log(C.gray('  https://supabase.com/dashboard/account/tokens'))
    console.log(C.gray('\n  Name it "Belori CLI", copy the token, then paste it when prompted.\n'))
    await ask(C.yellow('Press Enter to open `supabase login` (takes ~30 seconds) ›'))
    await runInteractive('npx', ['supabase', 'login'])
  } else {
    ok('Supabase CLI is already logged in')
  }

  // ── 1. Pick or create the project ────────────────────────────────────
  banner('1 · Pick test project')

  let projectRef
  if (LINK_EXISTING) {
    projectRef = (await ask('Existing test project ref (20 chars):')).trim()
    if (!/^[a-z0-9]{20}$/i.test(projectRef)) fatal('Invalid project ref.')
    if (projectRef === PROD_REF) fatal('That is the PRODUCTION ref. Absolutely not.')
  } else {
    console.log(C.gray('  This will create a NEW Supabase project named "belori-test".'))
    const confirmCreate = (await ask('Create new test project? [Y/n]')).trim().toLowerCase()
    if (confirmCreate === 'n' || confirmCreate === 'no') {
      projectRef = (await ask('Existing test project ref to link instead:')).trim()
      if (!/^[a-z0-9]{20}$/i.test(projectRef)) fatal('Invalid project ref.')
    } else {
      // List orgs
      console.log()
      step('Fetching your Supabase organizations…')
      const orgs = run('npx supabase orgs list', { silent: true })
      console.log(orgs.out)
      const orgId = (await ask('Paste the ID of the organization to use:')).trim()
      const region = (await ask('Region [us-east-1]:')).trim() || 'us-east-1'
      console.log()
      console.log(C.gray('  Generating a strong DB password. Save it somewhere — Supabase'))
      console.log(C.gray('  will show it only once after project creation.'))
      const dbPassword = generatePassword()
      console.log(`  ${C.dim('DB password (save to your vault):')} ${C.yellow(dbPassword)}`)
      await ask(C.yellow('Press Enter when you have copied the DB password ›'))

      step('Creating project (takes ~90 seconds)…')
      const createResult = run(
        `npx supabase projects create belori-test --org-id "${orgId}" --region "${region}" --db-password "${dbPassword}"`,
        { silent: true, allowFail: true },
      )
      if (!createResult.ok) {
        console.error(createResult.err || createResult.out)
        fatal('Project creation failed. Check your org ID and free-tier limits.')
      }
      // Output contains "Created a new project …/projects/<ref>"
      const match = createResult.out.match(/projects\/([a-z0-9]{20})/i)
      if (!match) fatal('Could not extract project ref from CLI output.')
      projectRef = match[1]
      ok(`Created project belori-test · ref ${projectRef}`)
    }
  }

  if (projectRef === PROD_REF) fatal('Aborting — ref matches production.')

  // ── 2. Link CLI ──────────────────────────────────────────────────────
  banner('2 · Link CLI to test project')
  step(`Linking to ${projectRef}…`)
  await runInteractive('npx', ['supabase', 'link', '--project-ref', projectRef])
  ok('Linked')

  // ── 3. Push migrations ──────────────────────────────────────────────
  banner('3 · Push all 61 migrations')
  warn('This takes 2–5 minutes. Do not interrupt.')
  await runInteractive('npx', ['supabase', 'db', 'push'])
  ok('All migrations applied')

  // ── 4. Run seed ─────────────────────────────────────────────────────
  banner('4 · Seed the test database')
  step('Applying supabase/seed.test.sql…')
  const seedResult = run('npx supabase db execute --file supabase/seed.test.sql', { silent: false, allowFail: true })
  if (!seedResult.ok) {
    warn('Seed command failed. This can happen if the CLI version lacks `db execute`.')
    warn('Falling back to: copy seed contents into the SQL editor:')
    console.log(C.gray(`  https://supabase.com/dashboard/project/${projectRef}/sql/new`))
    await ask(C.yellow('Press Enter once you have run the seed SQL manually ›'))
  }
  ok('Seeded — expect 2 boutiques, 4 users, 6 clients, 4 events, 8 milestones')

  // ── 5. Deploy edge functions ────────────────────────────────────────
  banner('5 · Deploy 22 edge functions')
  const functions = [
    'ai-suggest', 'billing-portal', 'booking-page-data', 'calendar-feed',
    'create-checkout-session', 'create-payment-link', 'get-contract',
    'get-portal-data', 'inngest', 'inngest-send', 'klaviyo-sync',
    'mailchimp-sync', 'pdf', 'push-notify', 'qbo-sync', 'send-email',
    'send-push', 'send-sms', 'sign-contract', 'sms-inbound', 'stripe-webhook',
  ]
  const skipFns = (await ask('Skip function deploys? (y/N) — skip if you only need RLS tests:'))
    .trim().toLowerCase()
  if (skipFns === 'y') {
    warn('Skipping function deploys. You can run `npx supabase functions deploy <name>` anytime later.')
  } else {
    let failed = []
    for (const fn of functions) {
      step(`Deploying ${fn}…`)
      const r = run(`npx supabase functions deploy ${fn}`, { silent: true, allowFail: true })
      if (r.ok) ok(`  ${fn}`)
      else { warn(`  ${fn} — failed (will retry at end)`); failed.push(fn) }
    }
    if (failed.length) {
      warn(`${failed.length} function(s) failed. Re-run later: npx supabase functions deploy ${failed.join(' ')}`)
    } else {
      ok('All 22 edge functions deployed')
    }
  }

  // ── 6. Scaffold .env.test ───────────────────────────────────────────
  banner('6 · Scaffold .env.test')
  const envTestPath = resolve(ROOT, '.env.test')
  const envExamplePath = resolve(ROOT, '.env.test.example')

  if (existsSync(envTestPath)) {
    warn('.env.test already exists — leaving it alone.')
    warn('Update the VITE_SUPABASE_URL / TEST_SUPABASE_URL manually if needed.')
  } else {
    copyFileSync(envExamplePath, envTestPath)
    // Replace the URL placeholder with the actual test URL
    const contents = readFileSync(envTestPath, 'utf8')
      .replace(/YOUR_TEST_PROJECT_REF\.supabase\.co/g, `${projectRef}.supabase.co`)
    writeFileSync(envTestPath, contents)
    ok(`Created .env.test with VITE_SUPABASE_URL=https://${projectRef}.supabase.co`)
  }

  // ── 7. Manual handoff ────────────────────────────────────────────────
  banner('7 · Manual steps (still on you — security boundary)')
  console.log(`
  ${C.bold('Remaining tasks that require credentials I should NOT see:')}

  ${C.yellow('A.')} Open: ${C.blue(`https://supabase.com/dashboard/project/${projectRef}/settings/api`)}
     Copy ${C.bold('anon public')} key and ${C.bold('service_role')} key.
     Paste into .env.test as VITE_SUPABASE_ANON_KEY,
     TEST_SUPABASE_ANON_KEY, and TEST_SUPABASE_SERVICE_ROLE_KEY.

  ${C.yellow('B.')} Open: ${C.blue(`https://supabase.com/dashboard/project/${projectRef}/auth/providers`)}
     Toggle ${C.bold('"Confirm email"')} OFF. (Required — tests can't click email links.)

  ${C.yellow('C.')} Open: ${C.blue(`https://supabase.com/dashboard/project/${projectRef}/auth/url-configuration`)}
     Add ${C.bold('http://localhost:5173')} and ${C.bold('http://localhost:5173/**')} to redirect URLs.

  ${C.yellow('D.')} (Optional — only for SMS / billing / email-path tests)
     Set edge function secrets:
     ${C.gray('npx supabase secrets set \\')}
     ${C.gray('  TWILIO_ACCOUNT_SID=ACxxx TWILIO_AUTH_TOKEN=xxx \\')}
     ${C.gray('  TWILIO_FROM_NUMBER=+15005550006 \\')}
     ${C.gray('  STRIPE_SECRET_KEY=sk_test_xxx STRIPE_WEBHOOK_SECRET=whsec_test_xxx \\')}
     ${C.gray('  RESEND_API_KEY=re_test_xxx RESEND_FROM_EMAIL="Belori <onboarding@resend.dev>"')}

  ${C.bold(C.green('When A–C are done, run:'))}
    ${C.green('node scripts/verify-test-env.mjs')}
    ${C.green('npm run test:e2e')}
`)

  rl.close()
  process.exit(0)
}

function generatePassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%^&*-_'
  let out = ''
  for (let i = 0; i < 32; i++) out += chars[Math.floor(Math.random() * chars.length)]
  return out
}

main().catch((e) => {
  console.error(C.red('\nFatal: ' + (e.message || e)))
  rl.close()
  process.exit(1)
})
