/**
 * Belori — Couture email HTML template helper.
 *
 * Builds an editorial bridal-atelier email body that matches the app's
 * visual language:
 *   - Italiana display + Cormorant Garamond italic headlines
 *   - Warm ivory body (#F8F4F0) with a cream card (#FEFBF7)
 *   - Champagne-gold hairline accents and diamond fleuron ornaments
 *   - Small-caps tracked labels
 *
 * Robust inline CSS — gracefully degrades in email clients that block
 * web fonts (fallback stack: Didot → Georgia → Times New Roman → serif).
 *
 * Usage:
 *   import { renderEmail } from '../_shared/emailTemplate.ts'
 *   await sendEmail({
 *     to,
 *     subject,
 *     html: renderEmail({
 *       preheader: 'Your appointment tomorrow',
 *       kicker: 'Atelier reminder',
 *       title: 'A small note about tomorrow.',
 *       body: '<p>...</p>',
 *       cta: { label: 'View details', href: '…' },
 *       boutiqueName,
 *     }),
 *   })
 */

export interface EmailButtonSpec { label: string; href: string }

export interface EmailTemplateSpec {
  /** Invisible preview text that shows in the inbox summary. */
  preheader?: string
  /** Small-caps eyebrow above the title (e.g. "PAYMENT REMINDER"). */
  kicker?: string
  /** Editorial italic serif headline (plain text — we add styling). */
  title: string
  /** Inner HTML for the body — use <p>, <strong>, <em>, basic tables. */
  bodyHtml: string
  /** Primary call-to-action button (optional). */
  cta?: EmailButtonSpec
  /** Secondary inline link below the CTA (optional). */
  secondary?: EmailButtonSpec
  /** Name of the sending boutique — shown in the footer signature. */
  boutiqueName?: string
  /** Optional footer note (address, legal, opt-out hint, etc.). */
  footerNote?: string
}

export function escHtml(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/** Build a couture-branded transactional email body. */
export function renderEmail(spec: EmailTemplateSpec): string {
  const {
    preheader = '',
    kicker = '',
    title,
    bodyHtml,
    cta,
    secondary,
    boutiqueName = 'Belori',
    footerNote = '',
  } = spec

  const safeTitle      = escHtml(title)
  const safeKicker     = escHtml(kicker.toUpperCase())
  const safeBoutique   = escHtml(boutiqueName)
  const safeFooterNote = escHtml(footerNote)
  const safePreheader  = escHtml(preheader)

  // CTA button — ink bg, warm cream text, uppercase tracked
  const ctaHtml = cta
    ? `<tr><td align="left" style="padding:12px 0 8px;">
         <a href="${escHtml(cta.href)}" style="
           display:inline-block;
           background:#1C1118;color:#FEFBF7;
           padding:14px 28px;
           text-decoration:none;
           font-family:'DM Sans','Helvetica Neue',Helvetica,Arial,sans-serif;
           font-size:11px;font-weight:500;
           text-transform:uppercase;letter-spacing:0.18em;
           border-radius:2px;
           mso-padding-alt:14px 28px;
         ">${escHtml(cta.label)}</a>
       </td></tr>`
    : ''

  // Secondary link — small-caps inline
  const secondaryHtml = secondary
    ? `<tr><td align="left" style="padding:0 0 8px;">
         <a href="${escHtml(secondary.href)}" style="
           display:inline-block;
           color:#8E6B34;
           font-family:'DM Sans','Helvetica Neue',Helvetica,Arial,sans-serif;
           font-size:10px;font-weight:500;
           text-transform:uppercase;letter-spacing:0.16em;
           text-decoration:none;padding:8px 0;
         ">${escHtml(secondary.label)} →</a>
       </td></tr>`
    : ''

  // Ornament — diamond flanked by gold rules (using HTML table cells for compat)
  const ornament = `
    <table role="presentation" border="0" cellspacing="0" cellpadding="0" style="margin:0 auto;">
      <tr>
        <td style="padding:0 10px;"><div style="height:1px;width:48px;background:#B08A4E;opacity:0.5;"></div></td>
        <td style="padding:0;">
          <div style="width:8px;height:8px;background:#B08A4E;transform:rotate(45deg);"></div>
        </td>
        <td style="padding:0 10px;"><div style="height:1px;width:48px;background:#B08A4E;opacity:0.5;"></div></td>
      </tr>
    </table>`

  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="en">
<head>
  <meta charset="utf-8">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>${safeBoutique}</title>
  <!--[if mso]>
    <style type="text/css">
      body, table, td, div, p, a { font-family: Georgia, serif !important; }
    </style>
  <![endif]-->
  <style type="text/css">
    @import url('https://fonts.googleapis.com/css2?family=Italiana&family=Cormorant+Garamond:ital,wght@0,300;0,400;1,400&family=DM+Sans:wght@400;500;600&display=swap');
    body { margin:0; padding:0; background:#F8F4F0; }
    a { color:#8E6B34; }
    a:hover { color:#1C1118; }
    /* Phone */
    @media only screen and (max-width: 620px) {
      .couture-card { width:100% !important; }
      .couture-pad  { padding-left:24px !important; padding-right:24px !important; }
      .couture-title { font-size:28px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background:#F8F4F0;color:#1C1118;-webkit-font-smoothing:antialiased;">
  <!-- Preheader (hidden preview text) -->
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:#F8F4F0;">
    ${safePreheader}
  </div>

  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background:#F8F4F0;">
    <tr>
      <td align="center" style="padding:40px 20px;">

        <!-- Masthead: Italiana "Belori · ATELIER" with gold hairline -->
        <table role="presentation" class="couture-card" width="560" border="0" cellspacing="0" cellpadding="0" style="max-width:560px;margin:0 auto 0;">
          <tr>
            <td align="center" style="padding:0 0 20px;">
              <div style="
                font-family:'Italiana','Didot',Georgia,serif;
                font-size:32px;color:#1C1118;letter-spacing:0.01em;line-height:1;
              ">Belori</div>
              <div style="margin-top:6px;
                font-family:'DM Sans','Helvetica Neue',Helvetica,Arial,sans-serif;
                font-size:9px;color:#B08A4E;
                text-transform:uppercase;letter-spacing:0.32em;
              ">Atelier</div>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:0 0 28px;">
              ${ornament}
            </td>
          </tr>
        </table>

        <!-- Card -->
        <table role="presentation" class="couture-card" width="560" border="0" cellspacing="0" cellpadding="0" style="
          max-width:560px;margin:0 auto;
          background:#FEFBF7;
          border:1px solid #EDE7E2;
          box-shadow:0 1px 4px rgba(28,17,24,0.05);
        ">
          <!-- Top hairline accent -->
          <tr>
            <td style="height:2px;background:#B08A4E;line-height:2px;font-size:2px;">&nbsp;</td>
          </tr>

          <!-- Title block -->
          <tr>
            <td class="couture-pad" style="padding:40px 40px 16px;">
              ${safeKicker ? `<div style="
                font-family:'DM Sans','Helvetica Neue',Helvetica,Arial,sans-serif;
                font-size:10px;color:#8E6B34;
                text-transform:uppercase;letter-spacing:0.22em;font-weight:600;
                margin:0 0 16px;
              ">${safeKicker}</div>` : ''}
              <h1 class="couture-title" style="
                margin:0;
                font-family:'Cormorant Garamond','Didot',Georgia,'Times New Roman',serif;
                font-size:30px;font-style:italic;font-weight:400;
                color:#1C1118;line-height:1.2;letter-spacing:0.005em;
              ">${safeTitle}</h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td class="couture-pad" style="
              padding:12px 40px 20px;
              font-family:'DM Sans','Helvetica Neue',Helvetica,Arial,sans-serif;
              font-size:14px;line-height:1.65;color:#1C1118;
            ">
              ${bodyHtml}
            </td>
          </tr>

          ${cta || secondary ? `
          <!-- CTA -->
          <tr>
            <td class="couture-pad" style="padding:8px 40px 32px;">
              <table role="presentation" border="0" cellspacing="0" cellpadding="0">
                ${ctaHtml}
                ${secondaryHtml}
              </table>
            </td>
          </tr>` : ''}

          <!-- Footer signature -->
          <tr>
            <td style="border-top:1px solid #EDE7E2;padding:0;">&nbsp;</td>
          </tr>
          <tr>
            <td class="couture-pad" style="padding:24px 40px 32px;background:#F8F4F0;">
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="
                    font-family:'Cormorant Garamond','Didot',Georgia,serif;
                    font-style:italic;font-size:14px;color:#5C4A52;
                  ">
                    With care,<br/>
                    <span style="color:#1C1118;">${safeBoutique}</span>
                  </td>
                  <td align="right" style="
                    font-family:'DM Sans','Helvetica Neue',Helvetica,Arial,sans-serif;
                    font-size:9px;color:#9C8A92;
                    text-transform:uppercase;letter-spacing:0.22em;
                  ">
                    Belori · Atelier
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>

        ${safeFooterNote ? `
        <!-- Tiny footer note -->
        <table role="presentation" width="560" border="0" cellspacing="0" cellpadding="0" style="max-width:560px;margin:16px auto 0;">
          <tr>
            <td align="center" style="
              font-family:'DM Sans','Helvetica Neue',Helvetica,Arial,sans-serif;
              font-size:11px;color:#9C8A92;line-height:1.5;padding:0 20px;
            ">
              ${safeFooterNote}
            </td>
          </tr>
        </table>` : ''}

        <!-- Bottom ornament -->
        <table role="presentation" width="560" border="0" cellspacing="0" cellpadding="0" style="max-width:560px;margin:20px auto 0;">
          <tr>
            <td align="center" style="padding:0 0 8px;">
              ${ornament}
            </td>
          </tr>
          <tr>
            <td align="center" style="
              font-family:'DM Sans','Helvetica Neue',Helvetica,Arial,sans-serif;
              font-size:9px;color:#9C8A92;
              text-transform:uppercase;letter-spacing:0.28em;padding-top:4px;
            ">
              Crafted for the boutique
            </td>
          </tr>
        </table>

      </td>
    </tr>
  </table>
</body>
</html>`
}
