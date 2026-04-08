# Push Notifications Setup

## Overview

Belori supports browser push notifications for overdue payments, appointment reminders, and other key events. Push notifications work in Chrome, Edge, Firefox, and Safari 16.4+ (iOS/macOS).

## Quick Setup

### 1. Generate VAPID Keys

VAPID (Voluntary Application Server Identification) keys are required to authenticate push messages from your server.

```bash
npx web-push generate-vapid-keys
```

This outputs something like:

```
Public Key:
Bxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

Private Key:
xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### 2. Add the public key to your frontend `.env`

```env
VITE_VAPID_PUBLIC_KEY=Bxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

Restart your dev server after updating `.env`.

### 3. Set secrets on Supabase

```bash
npx supabase secrets set \
  VAPID_PUBLIC_KEY=Bxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx \
  VAPID_PRIVATE_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx \
  VAPID_SUBJECT=mailto:your@email.com
```

`VAPID_SUBJECT` must be either a `mailto:` address or an `https:` URL for your app.

### 4. Deploy the Edge Functions

```bash
npx supabase functions deploy send-push
npx supabase functions deploy push-notify
```

### 5. Apply the database migration

```bash
npx supabase db push
```

Or apply manually in the Supabase dashboard SQL editor — see `supabase/migrations/20260403_push_subscriptions.sql`.

---

## How It Works

1. The user opens **Settings → Profile** and clicks **"Enable notifications"**
2. The browser requests permission and creates a Web Push subscription
3. The subscription (endpoint + encryption keys) is saved to `push_subscriptions` in Supabase
4. When automations run (payment reminders, appointment reminders), the `send-push` Edge Function delivers push notifications to all active subscriptions for that boutique
5. The service worker (`public/sw.js`) receives the push event and shows a system notification
6. Clicking a notification navigates the user to the relevant screen in the app

## Notification Events

| Trigger | Title | Navigates to |
|---|---|---|
| Payment due in 3 days | "Payment Reminder" | `/?screen=payments` |
| Payment overdue 1/7/14 days | "Overdue Payment" | `/?screen=payments` |
| Appointment tomorrow (24h) | "Appointment Reminder" | `/?screen=events` |

## Graceful Degradation

- If VAPID keys are not configured, `send-push` returns `{ sent: 0, reason: 'VAPID not configured' }` without erroring
- Expired/gone subscriptions (HTTP 410/404) are automatically removed from the database
- If `PushManager` is not available in the browser, the Settings UI shows a "not supported" message instead of the toggle
- All push calls in `inngest/index.ts` are fire-and-forget (`.catch(() => {})`) so automation failures don't block SMS/email delivery
