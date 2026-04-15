/**
 * Send a transactional email via Resend.
 *
 * Required Supabase secret:
 *   RESEND_API_KEY
 *   RESEND_FROM_EMAIL  (e.g. "Belori <noreply@yourdomain.com>")
 *
 * Returns { ok: true } on success or { ok: false, error: string } on failure.
 * NEVER throws — callers can safely iterate over many recipients without
 * one bad address aborting the entire run (INN-04 fix).
 */
export interface EmailPayload {
  to: string
  subject: string
  html: string
  text?: string
}

export async function sendEmail(payload: EmailPayload): Promise<{ ok: boolean; error?: string }> {
  const apiKey   = Deno.env.get('RESEND_API_KEY')
  const fromAddr = Deno.env.get('RESEND_FROM_EMAIL') ?? 'Belori <noreply@belori.app>'

  if (!apiKey) {
    console.warn('[email] RESEND_API_KEY not set — skipping email to', payload.to)
    return { ok: false, error: 'RESEND_API_KEY not configured' }
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10_000)
  try {
    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from: fromAddr,
        to: [payload.to],
        subject: payload.subject,
        html: payload.html,
        text: payload.text,
      }),
      signal: controller.signal,
    })
    if (!resp.ok) {
      const err = await resp.text()
      const msg = `Resend error ${resp.status}: ${err}`
      console.error('[email] Failed to send to', payload.to, '—', msg)
      return { ok: false, error: msg }
    }
    return { ok: true }
  } catch (err) {
    const msg = (err as Error).name === 'AbortError'
      ? 'Resend request timed out after 10s'
      : String(err)
    console.error('[email] Exception sending to', payload.to, '—', msg)
    return { ok: false, error: msg }
  } finally {
    clearTimeout(timeout)
  }
}
