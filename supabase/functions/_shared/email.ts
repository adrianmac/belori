/**
 * Send a transactional email via Resend.
 *
 * Required Supabase secret:
 *   RESEND_API_KEY
 *   RESEND_FROM_EMAIL  (e.g. "Belori <noreply@yourdomain.com>")
 */
export interface EmailPayload {
  to: string
  subject: string
  html: string
  text?: string
}

export async function sendEmail(payload: EmailPayload): Promise<void> {
  const apiKey   = Deno.env.get('RESEND_API_KEY')
  const fromAddr = Deno.env.get('RESEND_FROM_EMAIL') ?? 'Belori <noreply@belori.app>'

  if (!apiKey) {
    console.warn('[email] RESEND_API_KEY not set — skipping email to', payload.to)
    return
  }

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
  })

  if (!resp.ok) {
    const err = await resp.text()
    throw new Error(`Resend error ${resp.status}: ${err}`)
  }
}
