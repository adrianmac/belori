import { Link } from 'react-router-dom';

const rosa = '#C9697A';
const bg = '#FBF7F5';
const ink = '#1C1012';
const bodyInk = '#2D1A1C';
const muted = '#7A5A5E';
const border = '#E8D8DA';

const styles = {
  page: {
    backgroundColor: bg,
    minHeight: '100vh',
    fontFamily: "'DM Sans', sans-serif",
    color: bodyInk,
  },
  nav: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 32px',
    height: 60,
    borderBottom: `1px solid ${border}`,
    backgroundColor: bg,
    position: 'sticky',
    top: 0,
    zIndex: 10,
  },
  wordmark: {
    fontFamily: "'Playfair Display', serif",
    fontSize: 20,
    fontWeight: 700,
    color: rosa,
    textDecoration: 'none',
    letterSpacing: '0.08em',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  wordmarkSquare: {
    display: 'inline-block',
    width: 10,
    height: 10,
    backgroundColor: rosa,
    flexShrink: 0,
  },
  article: {
    maxWidth: 720,
    margin: '0 auto',
    padding: '56px 24px 80px',
  },
  h1: {
    fontFamily: "'Playfair Display', serif",
    fontSize: 40,
    fontWeight: 700,
    color: ink,
    margin: '0 0 12px',
    lineHeight: 1.2,
  },
  effectiveDate: {
    fontSize: 14,
    color: muted,
    margin: '0 0 48px',
    fontStyle: 'italic',
  },
  h2: {
    fontFamily: "'DM Sans', sans-serif",
    fontSize: 18,
    fontWeight: 600,
    color: ink,
    margin: '44px 0 12px',
    paddingBottom: 8,
    borderBottom: `1px solid ${border}`,
  },
  p: {
    fontSize: 15,
    lineHeight: 1.75,
    color: bodyInk,
    margin: '0 0 16px',
  },
  ul: {
    fontSize: 15,
    lineHeight: 1.75,
    color: bodyInk,
    margin: '0 0 16px',
    paddingLeft: 24,
  },
  li: {
    marginBottom: 6,
  },
  strong: {
    fontWeight: 600,
    color: ink,
  },
  a: {
    color: rosa,
    textDecoration: 'none',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: 14,
    margin: '12px 0 20px',
  },
  th: {
    textAlign: 'left',
    padding: '8px 12px',
    backgroundColor: '#F2E8EA',
    color: ink,
    fontWeight: 600,
    borderBottom: `1px solid ${border}`,
  },
  td: {
    padding: '8px 12px',
    borderBottom: `1px solid ${border}`,
    verticalAlign: 'top',
    lineHeight: 1.5,
  },
  highlight: {
    backgroundColor: '#F9EFF1',
    borderLeft: `3px solid ${rosa}`,
    padding: '12px 16px',
    margin: '16px 0',
    borderRadius: '0 6px 6px 0',
    fontSize: 14,
    lineHeight: 1.7,
    color: bodyInk,
  },
  footer: {
    borderTop: `1px solid ${border}`,
    padding: '32px 24px',
    textAlign: 'center',
    fontSize: 13,
    color: muted,
  },
  footerLinks: {
    display: 'flex',
    justifyContent: 'center',
    gap: 24,
    marginBottom: 12,
    flexWrap: 'wrap',
  },
  footerLink: {
    color: rosa,
    textDecoration: 'none',
    fontSize: 13,
  },
};

export default function PrivacyPolicy() {
  return (
    <div style={styles.page}>
      {/* Nav */}
      <nav style={styles.nav}>
        <Link to="/" style={styles.wordmark}>
          <span style={styles.wordmarkSquare} />
          BELORI
        </Link>
        <span style={{ fontSize: 13, color: muted }}>Privacy Policy</span>
      </nav>

      {/* Article */}
      <article style={styles.article}>
        <h1 style={styles.h1}>Privacy Policy</h1>
        <p style={styles.effectiveDate}>Effective date: April 17, 2026</p>

        {/* 1. Who We Are */}
        <h2 style={styles.h2}>1. Who We Are</h2>
        <p style={styles.p}>
          Belori is a bridal boutique management platform operated by{' '}
          <strong style={styles.strong}>Belori Inc.</strong> ("Belori," "we," "us," or "our").
          We provide software that helps bridal boutiques manage events, client relationships,
          dress rentals, alterations, payments, and inventory.
        </p>
        <p style={styles.p}>
          We play two distinct roles depending on the data involved:
        </p>
        <ul style={styles.ul}>
          <li style={styles.li}>
            <strong style={styles.strong}>Data Controller</strong> — for account data, billing
            data, and usage data relating to boutique owners and their staff ("Boutiques"). We
            determine the purposes and means of processing this data.
          </li>
          <li style={styles.li}>
            <strong style={styles.strong}>Data Processor</strong> — for personal data that
            Boutiques upload about their own clients (e.g., client names, contact information,
            measurements, event details, payment history). In this capacity we process data
            strictly on behalf of and under the instructions of the Boutique, who is the data
            controller for their clients ("End Users").
          </li>
        </ul>
        <p style={styles.p}>
          Boutiques should provide their own privacy notices to their End Users explaining how
          client data is collected and used within the boutique's operations. Our Data Processing
          Agreement ("DPA"), available at <Link to="/dpa" style={styles.a}>/dpa</Link>, governs
          our obligations when acting as a data processor.
        </p>

        {/* 2. What Data We Collect */}
        <h2 style={styles.h2}>2. What Data We Collect</h2>

        <p style={styles.p}><strong style={styles.strong}>Account Data</strong></p>
        <p style={styles.p}>
          When a Boutique registers for or uses Belori, we collect information necessary to
          create and manage the account:
        </p>
        <ul style={styles.ul}>
          <li style={styles.li}>Name and email address of the account owner and invited staff members</li>
          <li style={styles.li}>Boutique name, phone number, address, and business details</li>
          <li style={styles.li}>
            Billing and payment information — managed by Stripe. We do not store credit card
            numbers or bank account details on our servers; Stripe handles all sensitive payment
            data under their own PCI-DSS compliant infrastructure.
          </li>
          <li style={styles.li}>Subscription plan, trial status, and billing history</li>
          <li style={styles.li}>Authentication credentials (passwords are hashed; we never store plaintext)</li>
        </ul>

        <p style={styles.p}><strong style={styles.strong}>Boutique Client Data</strong></p>
        <p style={styles.p}>
          When Boutiques enter information about their own clients into the platform, we store
          that data as a processor on their behalf. This may include:
        </p>
        <ul style={styles.ul}>
          <li style={styles.li}>End User names, email addresses, and phone numbers</li>
          <li style={styles.li}>Dress measurements and fitting notes</li>
          <li style={styles.li}>Event details such as event type, date, venue, and guest count</li>
          <li style={styles.li}>Payment milestones and transaction history</li>
          <li style={styles.li}>Alteration job records and associated notes</li>
          <li style={styles.li}>Client communications, appointment history, and loyalty point balances</li>
          <li style={styles.li}>Photos and inspiration assets uploaded by the Boutique</li>
        </ul>

        <p style={styles.p}><strong style={styles.strong}>Usage Data</strong></p>
        <p style={styles.p}>
          We automatically collect certain technical information when you access or use the Service:
        </p>
        <ul style={styles.ul}>
          <li style={styles.li}>IP addresses and approximate geolocation derived from IP</li>
          <li style={styles.li}>Browser type, version, and operating system</li>
          <li style={styles.li}>Pages visited, features used, and time spent on screens</li>
          <li style={styles.li}>Referral URLs and session identifiers</li>
          <li style={styles.li}>Error logs and performance diagnostics</li>
        </ul>

        <p style={styles.p}><strong style={styles.strong}>Communications</strong></p>
        <p style={styles.p}>
          If you contact us for support, respond to in-app prompts, or participate in user
          research, we collect the content of those communications along with any contact
          information you provide.
        </p>

        {/* 3. How We Use Data */}
        <h2 style={styles.h2}>3. How We Use Data</h2>
        <p style={styles.p}>We use the data we collect to:</p>
        <ul style={styles.ul}>
          <li style={styles.li}>
            <strong style={styles.strong}>Provide and operate the Service</strong> — authenticate
            users, display boutique data, process form submissions, and render all platform features
          </li>
          <li style={styles.li}>
            <strong style={styles.strong}>Process payments</strong> — create Stripe checkout
            sessions, manage subscriptions, and handle billing events via Stripe webhooks
          </li>
          <li style={styles.li}>
            <strong style={styles.strong}>Send transactional communications</strong> — account
            confirmation emails, password resets, billing receipts, and service notifications
            that are necessary for the operation of your account
          </li>
          <li style={styles.li}>
            <strong style={styles.strong}>Send product updates and marketing</strong> — occasional
            emails about new features, tips, and Belori news. You may opt out at any time using
            the unsubscribe link in any marketing email, or by emailing{' '}
            <a href="mailto:privacy@belori.app" style={styles.a}>privacy@belori.app</a>.
          </li>
          <li style={styles.li}>
            <strong style={styles.strong}>Improve the Service</strong> — analyze usage patterns,
            diagnose bugs, and inform product roadmap decisions (using aggregated or anonymized
            data where possible)
          </li>
          <li style={styles.li}>
            <strong style={styles.strong}>Comply with legal obligations</strong> — respond to
            lawful requests from courts or regulators, prevent fraud, and enforce our Terms of Service
          </li>
        </ul>
        <div style={styles.highlight}>
          We do <strong style={styles.strong}>not</strong> sell personal data to third parties
          for advertising or any other commercial purpose. We do not use End User data uploaded
          by Boutiques for any purpose other than providing the Service.
        </div>

        {/* 4. SMS & Communications */}
        <h2 style={styles.h2}>4. SMS &amp; Communications</h2>
        <p style={styles.p}>
          Belori offers SMS automation features that allow Boutiques to send automated messages
          to their clients — such as appointment reminders, payment notices, and follow-ups.
          These messages are sent on behalf of the Boutique via Twilio, our SMS sub-processor.
        </p>
        <p style={styles.p}>
          <strong style={styles.strong}>The Boutique is responsible for obtaining proper consent</strong>{' '}
          from their End Users before enabling SMS communications. Belori provides the technical
          infrastructure; the consent relationship exists between the Boutique and its clients.
        </p>
        <p style={styles.p}>
          Every SMS message sent through the platform includes opt-out instructions (e.g.,
          "Reply STOP to unsubscribe"). Opt-out requests are processed promptly and honored
          across all future automated messages. Standard messaging rates from your carrier may apply.
        </p>
        <p style={styles.p}>
          For complete details on SMS data handling, message categories, and consent requirements,
          see our <Link to="/sms-terms" style={styles.a}>SMS Terms</Link>.
        </p>

        {/* 5. Legal Bases (GDPR) */}
        <h2 style={styles.h2}>5. Legal Bases for Processing (GDPR &amp; UK GDPR)</h2>
        <p style={styles.p}>
          If you are located in the European Economic Area (EEA) or the United Kingdom, we
          process personal data under the following legal bases:
        </p>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Processing Activity</th>
              <th style={styles.th}>Legal Basis</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={styles.td}>Providing the Service under your subscription</td>
              <td style={styles.td}>Performance of a contract (Art. 6(1)(b))</td>
            </tr>
            <tr>
              <td style={styles.td}>Billing and payment processing</td>
              <td style={styles.td}>Performance of a contract (Art. 6(1)(b))</td>
            </tr>
            <tr>
              <td style={styles.td}>Security, fraud prevention, and abuse detection</td>
              <td style={styles.td}>Legitimate interests (Art. 6(1)(f))</td>
            </tr>
            <tr>
              <td style={styles.td}>Product analytics and service improvement</td>
              <td style={styles.td}>Legitimate interests (Art. 6(1)(f))</td>
            </tr>
            <tr>
              <td style={styles.td}>Compliance with legal obligations</td>
              <td style={styles.td}>Legal obligation (Art. 6(1)(c))</td>
            </tr>
            <tr>
              <td style={styles.td}>Marketing emails and product news</td>
              <td style={styles.td}>Consent (Art. 6(1)(a)) — withdrawable at any time</td>
            </tr>
          </tbody>
        </table>
        <p style={styles.p}>
          <strong style={styles.strong}>Your rights under GDPR/UK GDPR:</strong> You have the
          right to access, rectify, erase, restrict, and port your personal data, and to object
          to certain processing. Where processing is based on consent, you may withdraw that
          consent at any time without affecting the lawfulness of prior processing.
        </p>
        <p style={styles.p}>
          To exercise any of these rights, contact us at{' '}
          <a href="mailto:privacy@belori.app" style={styles.a}>privacy@belori.app</a>. We will
          respond within 30 days. You also have the right to lodge a complaint with your local
          supervisory authority (e.g., the ICO in the UK or your national DPA in the EU).
        </p>

        {/* 6. CCPA Rights */}
        <h2 style={styles.h2}>6. California Privacy Rights (CCPA / CPRA)</h2>
        <p style={styles.p}>
          If you are a California resident, the California Consumer Privacy Act (CCPA) as amended
          by the California Privacy Rights Act (CPRA) grants you the following rights:
        </p>
        <ul style={styles.ul}>
          <li style={styles.li}>
            <strong style={styles.strong}>Right to Know</strong> — You may request that we
            disclose the categories and specific pieces of personal information we have collected
            about you, the categories of sources, the business purposes for collection, and the
            categories of third parties with whom we share it.
          </li>
          <li style={styles.li}>
            <strong style={styles.strong}>Right to Delete</strong> — You may request that we
            delete personal information we have collected, subject to certain exceptions (e.g.,
            data needed to complete a transaction or comply with a legal obligation).
          </li>
          <li style={styles.li}>
            <strong style={styles.strong}>Right to Correct</strong> — You may request correction
            of inaccurate personal information.
          </li>
          <li style={styles.li}>
            <strong style={styles.strong}>Right to Opt Out of Sale or Sharing</strong> — We do
            not sell or share personal information for cross-context behavioral advertising.
            No opt-out action is required, but you may contact us to confirm.
          </li>
          <li style={styles.li}>
            <strong style={styles.strong}>Right to Non-Discrimination</strong> — We will not
            discriminate against you for exercising any of your CCPA rights.
          </li>
        </ul>
        <p style={styles.p}>
          To submit a California privacy request, email{' '}
          <a href="mailto:privacy@belori.app" style={styles.a}>privacy@belori.app</a> or visit
          our <Link to="/data-deletion" style={styles.a}>Data Deletion page</Link>. We will
          verify your identity before processing requests and respond within 45 days (extendable
          by an additional 45 days with notice).
        </p>

        {/* 7. Data Sharing */}
        <h2 style={styles.h2}>7. Data Sharing &amp; Sub-Processors</h2>
        <p style={styles.p}>
          We do not sell, rent, or trade personal data. We share data only with the following
          categories of recipients, strictly as necessary to provide the Service:
        </p>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Sub-Processor</th>
              <th style={styles.th}>Purpose</th>
              <th style={styles.th}>Data Location</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={styles.td}><strong style={styles.strong}>Stripe</strong></td>
              <td style={styles.td}>Payment processing, subscription management</td>
              <td style={styles.td}>US / EU</td>
            </tr>
            <tr>
              <td style={styles.td}><strong style={styles.strong}>Twilio</strong></td>
              <td style={styles.td}>SMS delivery for automated boutique messages</td>
              <td style={styles.td}>US</td>
            </tr>
            <tr>
              <td style={styles.td}><strong style={styles.strong}>Resend</strong></td>
              <td style={styles.td}>Transactional and automated email delivery</td>
              <td style={styles.td}>US</td>
            </tr>
            <tr>
              <td style={styles.td}><strong style={styles.strong}>Supabase</strong></td>
              <td style={styles.td}>Database hosting, authentication, file storage</td>
              <td style={styles.td}>US (AWS us-east-1)</td>
            </tr>
            <tr>
              <td style={styles.td}><strong style={styles.strong}>Inngest</strong></td>
              <td style={styles.td}>Workflow automation and scheduled job orchestration</td>
              <td style={styles.td}>US</td>
            </tr>
          </tbody>
        </table>
        <p style={styles.p}>
          All sub-processors are contractually bound by data processing agreements that require
          them to protect personal data with at least the same level of care as this policy and
          applicable law requires. We review sub-processor security posture before onboarding
          and periodically thereafter.
        </p>
        <p style={styles.p}>
          We may also disclose personal data (a) to comply with applicable law, regulation, or
          legal process; (b) to protect the rights, property, or safety of Belori, our users, or
          the public; or (c) in connection with a merger, acquisition, or sale of all or
          substantially all of our assets, in which case we will provide notice before personal
          data is transferred and becomes subject to a different privacy policy.
        </p>

        {/* 8. Data Retention */}
        <h2 style={styles.h2}>8. Data Retention</h2>
        <ul style={styles.ul}>
          <li style={styles.li}>
            <strong style={styles.strong}>Account data</strong> — retained for the duration of
            the active subscription and for 90 days following account termination, after which it
            is permanently deleted or anonymized. You may request earlier deletion at any time.
          </li>
          <li style={styles.li}>
            <strong style={styles.strong}>Boutique client data</strong> (measurements, event
            records, payment history) — retained for up to 7 years by default to accommodate
            alteration history and legal record-keeping. Boutiques may configure shorter retention
            periods or request bulk deletion within the Settings panel.
          </li>
          <li style={styles.li}>
            <strong style={styles.strong}>Usage logs and diagnostic data</strong> — retained for
            90 days and then automatically purged.
          </li>
          <li style={styles.li}>
            <strong style={styles.strong}>Database backups</strong> — retained for 30 days on a
            rolling basis; older backups are deleted automatically.
          </li>
          <li style={styles.li}>
            <strong style={styles.strong}>Legal hold</strong> — notwithstanding the above, we
            may retain data longer if required by applicable law, regulation, or ongoing legal proceedings.
          </li>
        </ul>

        {/* 9. Security */}
        <h2 style={styles.h2}>9. Security</h2>
        <p style={styles.p}>
          We implement technical, organizational, and administrative safeguards designed to
          protect personal data against unauthorized access, disclosure, alteration, and destruction:
        </p>
        <ul style={styles.ul}>
          <li style={styles.li}>
            <strong style={styles.strong}>Encryption in transit</strong> — all data transmitted
            between your browser and our servers is encrypted using TLS 1.2 or higher.
          </li>
          <li style={styles.li}>
            <strong style={styles.strong}>Encryption at rest</strong> — all data stored in our
            database and backups is encrypted using AES-256.
          </li>
          <li style={styles.li}>
            <strong style={styles.strong}>Row-level security (RLS)</strong> — our database
            enforces tenant isolation at the row level, ensuring that one boutique's data is
            never accessible to another boutique's account, regardless of application-layer controls.
          </li>
          <li style={styles.li}>
            <strong style={styles.strong}>Authentication</strong> — user passwords are hashed
            using industry-standard algorithms. We support multi-factor authentication and
            role-based access controls for boutique staff.
          </li>
          <li style={styles.li}>
            <strong style={styles.strong}>SOC 2 compliance</strong> — we are actively pursuing
            SOC 2 Type II certification and maintain ongoing security monitoring and logging.
          </li>
        </ul>
        <p style={styles.p}>
          No method of transmission over the internet or electronic storage is 100% secure. If
          you believe your account has been compromised, contact us immediately at{' '}
          <a href="mailto:privacy@belori.app" style={styles.a}>privacy@belori.app</a>.
        </p>

        {/* 10. Cookies */}
        <h2 style={styles.h2}>10. Cookies</h2>
        <p style={styles.p}>
          We use cookies and similar tracking technologies to operate and improve the Service:
        </p>
        <ul style={styles.ul}>
          <li style={styles.li}>
            <strong style={styles.strong}>Essential cookies</strong> — required for the Service
            to function. These include authentication session tokens and CSRF protection cookies.
            You cannot opt out of these while using the Service.
          </li>
          <li style={styles.li}>
            <strong style={styles.strong}>Analytics cookies</strong> — optional cookies that
            help us understand how users navigate the platform and which features are most
            valuable. We use aggregated, anonymized data from these cookies to improve the Service.
          </li>
        </ul>
        <p style={styles.p}>
          You can manage or block cookies through your browser settings. Note that disabling
          essential cookies will prevent you from logging in or using the Service. Most browsers
          allow you to configure cookie preferences per site.
        </p>

        {/* 11. Children's Privacy */}
        <h2 style={styles.h2}>11. Children's Privacy</h2>
        <p style={styles.p}>
          The Belori platform is designed for use by business operators (bridal boutiques) and
          their adult staff. It is not directed to, and we do not knowingly collect personal
          information from, anyone under the age of 18.
        </p>
        <p style={styles.p}>
          If we become aware that we have inadvertently collected personal information from a
          minor, we will take prompt steps to delete that information. If you believe a minor's
          data has been submitted to the Service, please contact us at{' '}
          <a href="mailto:privacy@belori.app" style={styles.a}>privacy@belori.app</a>.
        </p>

        {/* 12. International Transfers */}
        <h2 style={styles.h2}>12. International Data Transfers</h2>
        <p style={styles.p}>
          Belori's infrastructure is hosted in the United States (Supabase on AWS us-east-1).
          If you access the Service from outside the United States, your personal data may be
          transferred to, stored in, and processed in the US, which may not provide the same
          level of data protection as your home jurisdiction.
        </p>
        <p style={styles.p}>
          For transfers of personal data from the European Economic Area, the United Kingdom,
          or Switzerland to the United States, we rely on the European Commission's{' '}
          <strong style={styles.strong}>Standard Contractual Clauses (SCCs)</strong> as the
          lawful transfer mechanism. Our Data Processing Agreement incorporating the applicable
          SCCs is available at <Link to="/dpa" style={styles.a}>/dpa</Link>.
        </p>
        <p style={styles.p}>
          By using the Service, you acknowledge that your data may be processed in the United
          States and in other countries where our sub-processors operate.
        </p>

        {/* 13. Changes */}
        <h2 style={styles.h2}>13. Changes to This Policy</h2>
        <p style={styles.p}>
          We may update this Privacy Policy from time to time to reflect changes in our
          practices, technology, legal requirements, or for other operational reasons.
        </p>
        <p style={styles.p}>
          For <strong style={styles.strong}>material changes</strong> — those that meaningfully
          affect your rights or how we use your data — we will provide at least{' '}
          <strong style={styles.strong}>30 days' advance notice</strong> via email to the
          address associated with your account, and will display a prominent notice within the
          application. Your continued use of the Service after the effective date of a material
          change constitutes your acceptance of the updated policy.
        </p>
        <p style={styles.p}>
          For minor, non-material changes (such as clarifications or corrections), we will
          update the effective date at the top of this page without separate notification.
          We encourage you to review this policy periodically.
        </p>

        {/* 14. Contact */}
        <h2 style={styles.h2}>14. Contact Us</h2>
        <p style={styles.p}>
          If you have questions, concerns, or requests related to this Privacy Policy or our
          data practices, please contact us:
        </p>
        <ul style={styles.ul}>
          <li style={styles.li}>
            <strong style={styles.strong}>Email:</strong>{' '}
            <a href="mailto:privacy@belori.app" style={styles.a}>privacy@belori.app</a>
          </li>
          <li style={styles.li}>
            <strong style={styles.strong}>Mail:</strong> Belori Inc., Austin, TX, United States
          </li>
          <li style={styles.li}>
            <strong style={styles.strong}>Data deletion requests:</strong>{' '}
            <Link to="/data-deletion" style={styles.a}>belori.app/data-deletion</Link>
          </li>
          <li style={styles.li}>
            <strong style={styles.strong}>Data Processing Agreement:</strong>{' '}
            <Link to="/dpa" style={styles.a}>belori.app/dpa</Link>
          </li>
        </ul>
        <p style={styles.p}>
          We aim to respond to all privacy inquiries within 10 business days. For GDPR and
          CCPA requests, we will respond within the legally required timeframes as described
          in Sections 5 and 6 above.
        </p>
      </article>

      {/* Footer */}
      <footer style={styles.footer}>
        <div style={styles.footerLinks}>
          <Link to="/terms" style={styles.footerLink}>Terms of Service</Link>
          <Link to="/sms-terms" style={styles.footerLink}>SMS Terms</Link>
          <Link to="/dpa" style={styles.footerLink}>Data Processing Agreement</Link>
          <Link to="/data-deletion" style={styles.footerLink}>Data Deletion</Link>
        </div>
        <div style={{ color: muted, fontSize: 12 }}>
          &copy; {new Date().getFullYear()} Belori Inc. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
