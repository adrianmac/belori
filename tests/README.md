# Belori — Tests

## Layout

```
tests/
├── README.md                  (this file)
├── setup/
│   ├── vitest.setup.js        Unit-test global setup (jsdom polyfills, jest-dom)
│   └── global.setup.ts        Playwright one-time setup — seeds auth, verifies env
├── fixtures/
│   └── supabase.ts            Test Supabase client helpers (anon + service-role)
├── unit/
│   └── *.test.{js,ts}         Pure-function / component unit tests (Vitest)
├── e2e/
│   ├── auth/                  Login, Signup, JoinInvite flows
│   ├── events/                Event wizard, event detail, edits
│   ├── clients/               Client list, detail tabs
│   ├── payments/              Mark paid, new milestone
│   ├── rls/                   Cross-tenant isolation tests
│   └── a11y/                  axe accessibility smoke tests
└── .auth/                     (gitignored) Playwright storageState JSON per user
```

## Running

**Unit / component tests (Vitest):**
```bash
npm test                  # run once
npm run test:watch        # watch mode
npm run test:ui           # Vitest web UI
npm run test:coverage     # with coverage report
```

**E2E tests (Playwright) — requires .env.test configured:**
```bash
npm run test:e2e              # headless, all smoke tests
npm run test:e2e:ui           # Playwright UI mode
npm run test:e2e:debug        # step-through debugger
npm run test:e2e:report       # open last HTML report
```

`test:e2e` is gated by `scripts/verify-test-env.mjs` — it will refuse to run
against the production Supabase project. See `docs/TESTING_SUPABASE_SETUP.md`.

## Fixtures

The seed data lives in `supabase/seed.test.sql`. Key UUIDs:

| Who | UUID | Email |
|---|---|---|
| Owner A | `11111111-aaaa-1111-aaaa-111111111111` | owner-a@belori-test.local |
| Staff A | `22222222-aaaa-2222-aaaa-222222222222` | coordinator-a@belori-test.local |
| Owner B | `33333333-bbbb-3333-bbbb-333333333333` | owner-b@belori-test.local |
| Staff B | `44444444-bbbb-4444-bbbb-444444444444` | seamstress-b@belori-test.local |
| Boutique Alpha | `aaaaaaaa-1111-1111-1111-aaaaaaaaaaaa` | — |
| Boutique Beta  | `bbbbbbbb-2222-2222-2222-bbbbbbbbbbbb` | — |

Password for all test users: `TestPassword123!` (from `.env.test`).

## Writing new tests

**Unit:** Drop `foo.test.js` alongside the module (`src/hooks/foo.test.js`) or under `tests/unit/`.

**E2E:** Create `tests/e2e/<domain>/<feature>.spec.ts`. Default project runs
authenticated as Owner A (via `tests/.auth/owner-a.json`). For multi-user tests,
use `test.use({ storageState: 'tests/.auth/owner-b.json' })`.

## Re-seed between runs

```bash
npm run test:seed
```

The seed script is idempotent — DELETEs seed rows scoped by UUID, then INSERTs
fresh ones. Safe to run anytime; never touches non-seed data.
