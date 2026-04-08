/**
 * Belori — Inngest event helper
 *
 * Sends events to Inngest via the inngest-send edge function,
 * keeping INNGEST_EVENT_KEY server-side.
 */

const SEND_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/inngest-send`

/**
 * Fire an Inngest event from the frontend.
 * Fire-and-forget — errors are swallowed (non-critical path).
 *
 * @param {string} name  - Event name, e.g. 'belori/boutique.created'
 * @param {object} data  - Event payload
 */
export async function sendInngestEvent(name, data = {}) {
  try {
    await fetch(SEND_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, data }),
    })
  } catch (err) {
    // Non-critical — don't block the UI
    console.warn('[inngest] Failed to send event:', name, err)
  }
}
