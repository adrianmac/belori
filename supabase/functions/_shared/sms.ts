/**
 * Send an SMS via Twilio.
 *
 * Required Supabase secrets:
 *   TWILIO_ACCOUNT_SID
 *   TWILIO_AUTH_TOKEN
 *   TWILIO_FROM_NUMBER  (e.g. "+15551234567")
 *
 * Returns { ok: true } on success or { ok: false, error: string } on failure.
 * NEVER throws — callers can safely iterate over many recipients without
 * one bad number aborting the entire run (INN-04 fix).
 */
export async function sendSms(to: string, body: string): Promise<{ ok: boolean; error?: string }> {
  const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID')
  const authToken  = Deno.env.get('TWILIO_AUTH_TOKEN')
  const from       = Deno.env.get('TWILIO_FROM_NUMBER')

  if (!accountSid || !authToken || !from) {
    console.warn('[sms] Twilio env vars not set — skipping SMS to', to)
    return { ok: false, error: 'Twilio env vars not configured' }
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10_000)
  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: 'Basic ' + btoa(`${accountSid}:${authToken}`),
      },
      body: new URLSearchParams({ To: to, From: from, Body: body }).toString(),
      signal: controller.signal,
    })
    if (!resp.ok) {
      const err = await resp.text()
      const msg = `Twilio error ${resp.status}: ${err}`
      console.error('[sms] Failed to send to', to, '—', msg)
      return { ok: false, error: msg }
    }
    return { ok: true }
  } catch (err) {
    const msg = (err as Error).name === 'AbortError'
      ? 'Twilio request timed out after 10s'
      : String(err)
    console.error('[sms] Exception sending to', to, '—', msg)
    return { ok: false, error: msg }
  } finally {
    clearTimeout(timeout)
  }
}

/** Format a phone number to E.164. Strips non-digits, prepends +1 if 10 digits. */
export function toE164(phone: string): string | null {
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 10) return `+1${digits}`
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`
  // E.164 max is 15 digits — reject anything outside 10-15 digits
  if (digits.length >= 12 && digits.length <= 15) return `+${digits}`
  return null
}
