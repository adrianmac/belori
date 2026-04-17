import React from 'react'

const SANS = '"DM Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
const SERIF = '"Playfair Display", Georgia, serif'

const C = {
  rosa:  '#C9697A',
  ink:   '#1C1012',
  bg:    '#FBF7F5',
  gray:  '#6B5B5E',
  muted: '#8A7578',
  border:'#E8DCDE',
  white: '#FFFFFF',
}

const styles = {
  page: {
    minHeight: '100vh',
    background: C.bg,
    fontFamily: SANS,
    color: C.ink,
  },
  nav: {
    borderBottom: `1px solid ${C.border}`,
    background: C.white,
    padding: '0 24px',
    height: 56,
    display: 'flex',
    alignItems: 'center',
  },
  navBrand: {
    fontFamily: SERIF,
    fontSize: 20,
    fontWeight: 700,
    color: C.rosa,
    textDecoration: 'none',
    letterSpacing: 2,
  },
  main: {
    maxWidth: 720,
    margin: '0 auto',
    padding: '48px 24px 80px',
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: 600,
    letterSpacing: 2,
    color: C.rosa,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  h1: {
    fontFamily: SERIF,
    fontSize: 38,
    fontWeight: 700,
    color: C.ink,
    margin: '0 0 12px',
    lineHeight: 1.2,
  },
  effectiveDate: {
    fontSize: 14,
    color: C.muted,
    marginBottom: 40,
    borderBottom: `1px solid ${C.border}`,
    paddingBottom: 24,
  },
  section: {
    marginBottom: 36,
  },
  h2: {
    fontSize: 17,
    fontWeight: 700,
    color: C.ink,
    marginBottom: 10,
    marginTop: 0,
  },
  p: {
    fontSize: 15,
    lineHeight: 1.75,
    color: '#2E1A1E',
    margin: '0 0 10px',
  },
  ul: {
    margin: '8px 0 0',
    paddingLeft: 22,
  },
  li: {
    fontSize: 15,
    lineHeight: 1.75,
    color: '#2E1A1E',
    marginBottom: 6,
  },
  highlight: {
    background: '#FDF0F2',
    border: `1px solid ${C.border}`,
    borderLeft: `3px solid ${C.rosa}`,
    borderRadius: 6,
    padding: '14px 18px',
    marginBottom: 10,
    fontSize: 15,
    lineHeight: 1.7,
    color: C.ink,
  },
  footer: {
    borderTop: `1px solid ${C.border}`,
    background: C.white,
    padding: '28px 24px',
    textAlign: 'center',
  },
  footerInner: {
    maxWidth: 720,
    margin: '0 auto',
  },
  footerText: {
    fontSize: 13,
    color: C.muted,
    marginBottom: 10,
  },
  footerLinks: {
    display: 'flex',
    justifyContent: 'center',
    gap: 24,
    flexWrap: 'wrap',
  },
  footerLink: {
    fontSize: 13,
    color: C.rosa,
    textDecoration: 'none',
    fontWeight: 500,
  },
}

export default function SmsTerms() {
  return (
    <div style={styles.page}>
      {/* Nav */}
      <nav style={styles.nav}>
        <a href="/" style={styles.navBrand}>■ BELORI</a>
      </nav>

      {/* Main content */}
      <main style={styles.main}>
        <div style={styles.eyebrow}>Legal</div>
        <h1 style={styles.h1}>SMS Messaging Terms</h1>
        <p style={styles.effectiveDate}>Effective Date: April 17, 2026</p>

        {/* 1. Program Description */}
        <section style={styles.section}>
          <h2 style={styles.h2}>1. Program Description</h2>
          <p style={styles.p}>
            Belori is a bridal boutique management platform that enables boutique owners and their staff
            ("Boutiques") to send automated SMS text messages to their clients. These messages may include
            appointment reminders (24 hours and 2 hours before a scheduled appointment), payment reminders
            (3 days and at 1, 7, and 14 days past a missed due date), dress return reminders (48 hours
            before a return date), post-event review requests (24 hours after an event), and win-back
            messages to clients who have been inactive for 60 or more days.
          </p>
          <p style={styles.p}>
            The program is provided to assist Boutiques in maintaining timely, professional communication
            with their clients throughout the event lifecycle — from initial consultation through post-event
            follow-up.
          </p>
        </section>

        {/* 2. Who Sends the Messages */}
        <section style={styles.section}>
          <h2 style={styles.h2}>2. Who Sends the Messages</h2>
          <p style={styles.p}>
            All SMS messages transmitted through the Belori platform are sent <strong>by the Boutique</strong>,
            not by Belori Inc. directly. Belori acts solely as a technology provider and communications
            infrastructure intermediary. The Boutique is the advertiser, originator, and sender of record
            for all messages and bears full responsibility for compliance with the Telephone Consumer
            Protection Act (TCPA), the CAN-SPAM Act (where applicable), applicable state laws, and all
            wireless carrier requirements.
          </p>
          <p style={styles.p}>
            Belori does not independently initiate, author, or control the content of messages sent to
            end clients, except for system-generated opt-out confirmation messages required by law.
          </p>
        </section>

        {/* 3. Consent Requirement */}
        <section style={styles.section}>
          <h2 style={styles.h2}>3. Consent Requirement</h2>
          <p style={styles.p}>
            Prior to sending any SMS message to a client, Boutiques must obtain valid consent as required
            by applicable law:
          </p>
          <ul style={styles.ul}>
            <li style={styles.li}>
              <strong>Transactional / Informational Messages</strong> (appointment reminders, payment due
              notices, return reminders): Require <em>prior express consent</em> from the recipient. Consent
              must be clearly communicated and documented at the time it is collected.
            </li>
            <li style={styles.li}>
              <strong>Marketing / Promotional Messages</strong> (win-back campaigns, promotional offers):
              Require <em>prior express written consent</em> that meets the TCPA standard — a clear,
              conspicuous written agreement that authorizes the Boutique to send autodialed or pre-recorded
              text messages to the recipient's phone number.
            </li>
          </ul>
          <div style={styles.highlight}>
            <strong>Important:</strong> Consent to receive SMS messages may not be made a condition of
            purchasing any goods or services. Boutiques must provide a clear disclosure of the message
            program at the point of consent collection, including the program name, message frequency,
            that message and data rates may apply, and how to opt out.
          </div>
          <p style={styles.p}>
            Boutiques are solely responsible for collecting, documenting, and retaining records of client
            consent for a minimum of four (4) years. Belori recommends capturing consent via signed
            intake forms, digital agreements, or double opt-in text flows.
          </p>
        </section>

        {/* 4. How to Opt Out */}
        <section style={styles.section}>
          <h2 style={styles.h2}>4. How to Opt Out</h2>
          <p style={styles.p}>
            Recipients can opt out of SMS messages at any time by replying <strong>STOP</strong> to any
            message. Upon receiving a STOP request:
          </p>
          <ul style={styles.ul}>
            <li style={styles.li}>
              The recipient will receive one (1) final confirmation message acknowledging the opt-out
              and confirming that no further messages will be sent.
            </li>
            <li style={styles.li}>
              No additional SMS messages will be sent to that phone number by the relevant Boutique
              through the Belori platform.
            </li>
            <li style={styles.li}>
              Belori automatically suppresses future messages to opted-out numbers at the platform level,
              providing an additional safeguard beyond manual opt-out management.
            </li>
            <li style={styles.li}>
              Boutiques must honor opt-out requests within <strong>10 business days</strong> of receipt
              and must not send any messages to opted-out numbers after that period.
            </li>
          </ul>
          <p style={styles.p}>
            Opt-outs are number-specific and program-wide. A client who opts out will not receive any
            further SMS messages from the Boutique through Belori unless the client re-subscribes by
            texting START or by providing new written consent.
          </p>
        </section>

        {/* 5. How to Get Help */}
        <section style={styles.section}>
          <h2 style={styles.h2}>5. How to Get Help</h2>
          <p style={styles.p}>
            Recipients who need assistance may reply <strong>HELP</strong> to any message to receive a
            help response with contact information. For questions about a specific appointment, payment,
            or event, please contact your Boutique directly using the contact information they provided
            to you.
          </p>
          <p style={styles.p}>
            For platform-level support or TCPA-related inquiries, you may also contact Belori at:{' '}
            <strong>support@belori.app</strong>.
          </p>
        </section>

        {/* 6. Message Frequency */}
        <section style={styles.section}>
          <h2 style={styles.h2}>6. Message Frequency</h2>
          <p style={styles.p}>
            Message frequency varies depending on the Boutique's settings and your event schedule.
            Typical message frequencies are as follows:
          </p>
          <ul style={styles.ul}>
            <li style={styles.li}>
              <strong>Appointment reminders:</strong> Up to 2 messages per scheduled appointment
              (one 24 hours before, one 2 hours before).
            </li>
            <li style={styles.li}>
              <strong>Payment reminders:</strong> Up to 4 messages per payment milestone
              (one 3 days before due date; one each at 1, 7, and 14 days past due).
            </li>
            <li style={styles.li}>
              <strong>Dress return reminders:</strong> Up to 1 message per dress rental
              (48 hours before the scheduled return date).
            </li>
            <li style={styles.li}>
              <strong>Review requests:</strong> 1 message per event, sent approximately 24 hours
              after the event date.
            </li>
            <li style={styles.li}>
              <strong>Win-back messages:</strong> Up to 1 message per campaign cycle for inactive
              clients, sent no more frequently than weekly.
            </li>
          </ul>
          <p style={styles.p}>
            Individual Boutiques may configure their automation settings to send fewer messages than
            the maximums described above.
          </p>
        </section>

        {/* 7. Message & Data Rates */}
        <section style={styles.section}>
          <h2 style={styles.h2}>7. Message &amp; Data Rates</h2>
          <p style={styles.p}>
            <strong>Message and data rates may apply.</strong> SMS messages sent through the Belori
            platform are standard text messages. Depending on your wireless plan, your carrier may
            charge standard messaging rates for each text message sent or received. Belori does not
            charge recipients directly for receiving messages. Contact your wireless carrier for details
            about your plan's messaging rates.
          </p>
        </section>

        {/* 8. Supported Carriers */}
        <section style={styles.section}>
          <h2 style={styles.h2}>8. Supported Carriers</h2>
          <p style={styles.p}>
            Belori's SMS program supports most major United States wireless carriers, including but not
            limited to AT&amp;T, Verizon, T-Mobile, Sprint (T-Mobile), US Cellular, and regional carriers.
            Coverage and deliverability may vary by carrier and geographic location.
          </p>
          <p style={styles.p}>
            Carriers are not liable for delayed or undelivered messages. Message delivery is subject to
            network availability and carrier processing times, which are outside Belori's and the
            Boutique's control.
          </p>
        </section>

        {/* 9. Boutique Obligations */}
        <section style={styles.section}>
          <h2 style={styles.h2}>9. Boutique Obligations</h2>
          <p style={styles.p}>
            By using Belori's SMS features, Boutiques expressly agree to comply with all applicable
            laws and the following requirements:
          </p>
          <ul style={styles.ul}>
            <li style={styles.li}>
              <strong>(a) Obtain valid consent</strong> before sending any SMS message to any recipient,
              in accordance with Section 3 above.
            </li>
            <li style={styles.li}>
              <strong>(b) Maintain records of consent</strong> for each recipient for a minimum of four
              (4) years, including the date, method, and content of the consent disclosure.
            </li>
            <li style={styles.li}>
              <strong>(c) Honor opt-out requests immediately</strong> and no later than 10 business days
              after receipt, and not re-send messages to opted-out numbers without new written consent.
            </li>
            <li style={styles.li}>
              <strong>(d) Include opt-out instructions</strong> in every marketing or promotional message
              (e.g., "Reply STOP to unsubscribe").
            </li>
            <li style={styles.li}>
              <strong>(e) Respect quiet hours</strong> — do not send messages between 9:00 PM and 8:00 AM
              local time of the recipient's area code, in accordance with TCPA regulations and FCC rules.
            </li>
            <li style={styles.li}>
              <strong>(f) Not send deceptive or misleading content</strong> — all messages must accurately
              identify the Boutique and the purpose of the message, and must not contain false,
              misleading, or fraudulent information.
            </li>
          </ul>
          <p style={styles.p}>
            Boutiques that violate these obligations may have their SMS access suspended or terminated.
            Belori reserves the right to disable SMS features for any Boutique that fails to comply with
            applicable laws or these terms.
          </p>
        </section>

        {/* 10. Contact */}
        <section style={styles.section}>
          <h2 style={styles.h2}>10. Contact</h2>
          <p style={styles.p}>
            For general support: <strong>support@belori.app</strong>
          </p>
          <p style={styles.p}>
            For TCPA compliance inquiries or legal matters: <strong>legal@belori.app</strong>
          </p>
          <p style={styles.p}>
            Belori Inc. · Austin, TX 78701
          </p>
        </section>
      </main>

      {/* Footer */}
      <footer style={styles.footer}>
        <div style={styles.footerInner}>
          <p style={styles.footerText}>
            &copy; {new Date().getFullYear()} Belori Inc. All rights reserved.
          </p>
          <div style={styles.footerLinks}>
            <a href="/terms" style={styles.footerLink}>Terms of Service</a>
            <a href="/privacy" style={styles.footerLink}>Privacy Policy</a>
            <a href="/dpa" style={styles.footerLink}>Data Processing Agreement</a>
          </div>
        </div>
      </footer>
    </div>
  )
}
