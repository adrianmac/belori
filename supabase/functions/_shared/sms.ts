/**
 * Send an SMS via Twilio.
 *
 * Required Supabase secrets:
 *   TWILIO_ACCOUNT_SID
 *   TWILIO_AUTH_TOKEN
 *   TWILIO_FROM_NUMBER  (e.g. "+15551234567")
 */
export async function sendSms(to: string, body: string): Promise<void> {
  const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID')
  const authToken  = Deno.env.get('TWILIO_AUTH_TOKEN')
  const from       = Deno.env.get('TWILIO_FROM_NUMBER')

  if (!accountSid || !authToken || !from) {
    console.warn('[sms] Twilio env vars not set — skipping SMS to', to)
    return
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: 'Basic ' + btoa(`${accountSid}:${authToken}`),
    },
    body: new URLSearchParams({ To: to, From: from, Body: body }).toString(),
  })

  if (!resp.ok) {
    const err = await resp.text()
    throw new Error(`Twilio error ${resp.status}: ${err}`)
  }
}

/** Format a phone number to E.164. Strips non-digits, prepends +1 if 10 digits. */
export function toE164(phone: string): string | null {
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 10) return `+1${digits}`
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`
  if (digits.length > 11) return `+${digits}`
  return null
}
