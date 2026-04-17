import React from 'react'

/* ─── design tokens ─────────────────────────────────────────── */
const C = {
  rosa:   '#C9697A',
  ink:    '#1C1012',
  inkl:   '#2D1A1C',
  canvas: '#FBF7F5',
  border: 'rgba(201,105,122,.15)',
  gray:   '#6B5A5C',
  gl:     '#9C8A8C',
}

const fonts = {
  serif: "'Playfair Display', serif",
  sans:  "'DM Sans', sans-serif",
}

/* ─── shared style objects ───────────────────────────────────── */
const st = {
  page: {
    fontFamily: fonts.sans,
    background: C.canvas,
    color: C.inkl,
    minHeight: '100vh',
  },
  nav: {
    background: C.canvas,
    borderBottom: `1px solid ${C.border}`,
    padding: '18px 40px',
    display: 'flex',
    alignItems: 'center',
  },
  logoLink: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    textDecoration: 'none',
  },
  logoMark: {
    width: 30,
    height: 30,
    background: C.rosa,
    borderRadius: 7,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#fff',
    fontSize: 14,
    fontWeight: 700,
    lineHeight: 1,
    flexShrink: 0,
  },
  wordmark: {
    fontFamily: fonts.serif,
    fontSize: 18,
    fontWeight: 500,
    color: C.rosa,
    letterSpacing: '0.06em',
  },
  article: {
    maxWidth: 720,
    margin: '0 auto',
    padding: '48px 24px 80px',
  },
  h1: {
    fontFamily: fonts.serif,
    fontSize: 38,
    fontWeight: 400,
    color: C.ink,
    marginBottom: 10,
    lineHeight: 1.2,
  },
  subtitle: {
    fontFamily: fonts.sans,
    fontSize: 14,
    color: C.gl,
    marginBottom: 40,
    letterSpacing: '0.01em',
  },
  divider: {
    border: 'none',
    borderTop: `1px solid ${C.border}`,
    margin: '40px 0',
  },
  h2: {
    fontFamily: fonts.sans,
    fontSize: 18,
    fontWeight: 600,
    color: C.ink,
    marginBottom: 12,
    marginTop: 40,
  },
  p: {
    fontSize: 15,
    lineHeight: 1.75,
    color: C.inkl,
    marginBottom: 14,
  },
  ul: {
    fontSize: 15,
    lineHeight: 1.75,
    color: C.inkl,
    paddingLeft: 22,
    marginBottom: 14,
  },
  li: {
    marginBottom: 6,
  },
  caps: {
    fontSize: 14,
    lineHeight: 1.7,
    color: C.inkl,
    fontWeight: 500,
    marginBottom: 14,
    letterSpacing: '0.01em',
  },
  footer: {
    borderTop: `1px solid ${C.border}`,
    padding: '28px 40px',
    display: 'flex',
    alignItems: 'center',
    gap: 24,
    flexWrap: 'wrap',
  },
  footerNote: {
    fontSize: 13,
    color: C.gl,
    flex: 1,
    minWidth: 180,
  },
  footerLinks: {
    display: 'flex',
    gap: 20,
    flexWrap: 'wrap',
  },
  footerLink: {
    fontSize: 13,
    color: C.gray,
    textDecoration: 'none',
  },
}

/* ─── small helpers ──────────────────────────────────────────── */
function Section({ id, title, children }) {
  return (
    <section id={id}>
      <h2 style={st.h2}>{title}</h2>
      {children}
    </section>
  )
}

function P({ children, caps }) {
  return <p style={caps ? st.caps : st.p}>{children}</p>
}

function UL({ items }) {
  return (
    <ul style={st.ul}>
      {items.map((item, i) => (
        <li key={i} style={st.li}>{item}</li>
      ))}
    </ul>
  )
}

/* ─── main component ─────────────────────────────────────────── */
export default function TermsOfService() {
  return (
    <div style={st.page}>
      {/* Google Fonts */}
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500&family=DM+Sans:wght@300;400;500;600&display=swap"
      />

      {/* Nav */}
      <nav style={st.nav}>
        <a href="/" style={st.logoLink}>
          <div style={st.logoMark}>■</div>
          <span style={st.wordmark}>BELORI</span>
        </a>
      </nav>

      {/* Article */}
      <article style={st.article}>
        <h1 style={st.h1}>Terms of Service</h1>
        <p style={st.subtitle}>Effective date: April 17, 2026</p>
        <hr style={st.divider} />

        {/* 1 */}
        <Section id="acceptance" title="1. Acceptance of Terms">
          <P>
            These Terms of Service ("Terms") constitute a legally binding agreement between you (the
            "Boutique," "Customer," or "you") and Belori, Inc. ("Belori," "we," "our," or "us")
            governing your access to and use of the Belori platform and related services
            (collectively, the "Service").
          </P>
          <P>
            By creating an account, clicking "I agree," or otherwise accessing or using the Service,
            you acknowledge that you have read, understood, and agree to be bound by these Terms and
            our Privacy Policy, which is incorporated herein by reference.
          </P>
          <P>
            If you are accepting these Terms on behalf of a company or other legal entity, you
            represent and warrant that you have the authority to bind that entity to these Terms. In
            that case, "you" refers to that entity. If you do not have such authority, or if you do
            not agree to these Terms, you may not use the Service.
          </P>
        </Section>

        {/* 2 */}
        <Section id="description" title="2. Description of Service">
          <P>
            Belori is a cloud-based boutique management platform designed for bridal and special-event
            boutiques. The Service includes tools for managing events and appointments, client
            relationships (CRM), dress rentals and inventory, alteration job tracking, payment
            milestones, and automated communications such as SMS reminders and email sequences
            (collectively, "Features").
          </P>
          <P>
            Access to specific Features is determined by your subscription plan. Belori reserves the
            right to add, modify, or remove Features with reasonable notice. The Service is provided
            on an "as-is" and "as-available" basis, subject to the uptime commitment described in
            Section 10.
          </P>
          <P>
            Belori is a business-to-business (B2B) service. You are purchasing the Service to manage
            your boutique's operations; your boutique's clients are not direct customers of Belori,
            and these Terms do not create any rights or obligations between Belori and your clients.
          </P>
        </Section>

        {/* 3 */}
        <Section id="account" title="3. Account Registration & Security">
          <P>
            To use the Service you must register for an account. You agree to provide accurate,
            current, and complete information during registration and to update that information as
            necessary to keep it accurate.
          </P>
          <P>
            You are solely responsible for maintaining the confidentiality of your account
            credentials, including your password, and for all activity that occurs under your account.
            You may not share your credentials with any person outside your boutique or transfer your
            account to another party without Belori's written consent.
          </P>
          <P>
            You agree to notify Belori immediately at{' '}
            <a href="mailto:security@belori.app" style={{ color: C.rosa }}>security@belori.app</a>{' '}
            if you become aware of any unauthorized access to or use of your account. Belori is not
            liable for any loss or damage arising from your failure to protect your credentials.
          </P>
          <P>
            You must be at least 18 years of age to create an account or use the Service.
          </P>
        </Section>

        {/* 4 */}
        <Section id="billing" title="4. Subscription & Billing">
          <P>
            Belori offers subscription plans billed on a monthly or annual basis ("Subscription
            Period"). All fees are quoted and charged in U.S. dollars and are non-refundable except as
            expressly stated herein.
          </P>
          <P>
            <strong>Free Trial.</strong> Belori may offer a free trial period for new accounts. At
            the end of the trial, your account will automatically convert to a paid plan unless you
            cancel before the trial expires. Belori reserves the right to modify or discontinue free
            trial offers at any time.
          </P>
          <P>
            <strong>Price Changes.</strong> Belori may change subscription prices at any time upon at
            least 30 days' prior written notice delivered via email to your account's registered
            address or via an in-app notification. Price changes will take effect at the start of your
            next Subscription Period following the notice date.
          </P>
          <P>
            <strong>No Partial-Month Refunds.</strong> Subscription fees are charged at the beginning
            of each Subscription Period and are non-refundable. There are no credits or refunds for
            partial months of service, plan downgrades, or unused features.
          </P>
          <P>
            <strong>Payment Failure & Suspension.</strong> If payment fails or is not received by the
            due date, Belori will provide a 10-day grace period during which you may update your
            payment information. If payment is not received within the grace period, Belori may
            suspend your access to the Service. Suspension does not relieve you of the obligation to
            pay outstanding fees. Your account data will be retained during suspension in accordance
            with Section 13.
          </P>
        </Section>

        {/* 5 */}
        <Section id="acceptable-use" title="5. Acceptable Use">
          <P>
            You agree to use the Service only for lawful purposes and in a manner consistent with
            these Terms and all applicable laws and regulations. You agree that you will not:
          </P>
          <UL items={[
            'Use the Service to engage in any illegal activity or to facilitate illegal activity by others.',
            'Send unsolicited bulk communications ("spam") or commercial messages without the prior express consent of recipients.',
            'Reverse engineer, decompile, disassemble, or attempt to derive the source code of any component of the Service.',
            'Resell, sublicense, or otherwise make the Service available to third parties without Belori\'s prior written consent.',
            'Upload, transmit, or distribute viruses, malware, or any other malicious code through the Service.',
            'Attempt to gain unauthorized access to Belori\'s systems or networks, or to other customers\' accounts or data.',
            'Use the Service to harass, threaten, or intimidate your clients or any other person.',
            'Interfere with or disrupt the integrity or performance of the Service or related systems.',
            'Circumvent any access controls, rate limits, or usage restrictions imposed by Belori.',
            'Use the Service to collect or store personal data about individuals without complying with applicable privacy laws.',
          ]} />
          <P>
            Belori reserves the right to investigate suspected violations of these Terms and to
            suspend or terminate access to the Service for any account found to be in violation,
            without prior notice.
          </P>
        </Section>

        {/* 6 */}
        <Section id="client-data-sms" title="6. Client Data & SMS Communications">
          <P>
            The Service includes automated SMS features that allow you to send appointment reminders,
            payment reminders, and other communications to your boutique's clients. The following
            obligations apply whenever you use SMS or other automated messaging features:
          </P>
          <P>
            <strong>Prior Express Written Consent.</strong> You are solely responsible for obtaining
            valid prior express written consent from each client before sending any SMS message
            through the Service, as required by the Telephone Consumer Protection Act (TCPA) and
            applicable state and federal laws. You may not use Belori's SMS features to send messages
            to individuals who have not provided such consent.
          </P>
          <P>
            <strong>Opt-Out Compliance.</strong> You must honor opt-out requests immediately. When a
            client replies "STOP" or any standard opt-out keyword, you must cease sending SMS messages
            to that client. The Service provides technical support for STOP keyword processing, but
            you remain legally responsible for ensuring opt-outs are honored.
          </P>
          <P>
            <strong>Data Controller / Processor Relationship.</strong> With respect to personal data
            about your boutique's clients, you are the "data controller" (or equivalent under
            applicable law) and Belori is the "data processor." You determine the purposes and means
            of processing that client data; Belori processes it solely to provide the Service on your
            behalf. Our Data Processing Agreement ("DPA"), available at{' '}
            <a href="/dpa" style={{ color: C.rosa }}>/dpa</a>, governs the processing of personal
            data under applicable data protection laws including GDPR and CCPA where applicable.
          </P>
          <P>
            <strong>Your Responsibility.</strong> You represent and warrant that all client data you
            upload or input into the Service has been collected lawfully and that your use of the
            Service to process such data complies with all applicable laws, including but not limited
            to the TCPA, CAN-SPAM Act, GDPR, and CCPA. Belori is not responsible for your failure to
            comply with applicable law in connection with client data or communications.
          </P>
        </Section>

        {/* 7 */}
        <Section id="ip" title="7. Intellectual Property">
          <P>
            <strong>Belori's IP.</strong> The Service, including its software, design, features,
            trademarks, trade names, logos, and all related documentation, is owned by Belori, Inc.
            and protected by applicable intellectual property laws. These Terms do not grant you any
            ownership interest in the Service. All rights not expressly granted herein are reserved
            by Belori.
          </P>
          <P>
            <strong>Your Data.</strong> You retain full ownership of the data you input into the
            Service, including boutique information, client records, event data, and other content
            ("Your Data"). Belori does not claim any ownership interest in Your Data.
          </P>
          <P>
            <strong>License to Process Your Data.</strong> You grant Belori a limited, non-exclusive,
            royalty-free license to access, store, process, and use Your Data solely for the purpose
            of providing and improving the Service, fulfilling our obligations under these Terms, and
            as otherwise described in our Privacy Policy. This license terminates when your account is
            closed, subject to the data retention and export provisions in Section 13.
          </P>
          <P>
            <strong>Feedback.</strong> If you provide Belori with suggestions, ideas, enhancement
            requests, or other feedback about the Service ("Feedback"), you grant Belori an
            irrevocable, perpetual, royalty-free license to use and incorporate that Feedback into the
            Service without restriction or compensation to you.
          </P>
        </Section>

        {/* 8 */}
        <Section id="confidentiality" title="8. Confidentiality">
          <P>
            Each party (as "Receiving Party") agrees to keep confidential all non-public information
            disclosed by the other party (as "Disclosing Party") that is designated as confidential
            or that reasonably should be understood to be confidential given the nature of the
            information and circumstances of disclosure ("Confidential Information").
          </P>
          <P>
            Your boutique data, client records, and business information constitute Confidential
            Information of yours. Belori's pricing models, product roadmap, unreleased features, and
            proprietary technology constitute Confidential Information of Belori.
          </P>
          <P>
            Each party agrees to: (a) use the other's Confidential Information only as necessary to
            perform obligations under these Terms; (b) not disclose Confidential Information to third
            parties without prior written consent, except to employees or contractors who need to know
            it and are bound by confidentiality obligations at least as protective as these Terms; and
            (c) protect Confidential Information using at least the same degree of care used for its
            own confidential information, but no less than reasonable care.
          </P>
          <P>
            <strong>No Data Sales.</strong> Belori will not sell, rent, or trade Your Data to any
            third party for commercial purposes. Belori may share Your Data with third-party service
            providers (e.g., cloud infrastructure, payment processors) solely to the extent necessary
            to provide the Service, and such providers are bound by appropriate confidentiality and
            data protection obligations.
          </P>
          <P>
            Confidentiality obligations do not apply to information that: (a) is or becomes publicly
            known through no fault of the Receiving Party; (b) was already known to the Receiving
            Party before disclosure; (c) is independently developed by the Receiving Party without use
            of the Confidential Information; or (d) is required to be disclosed by law, regulation,
            or court order, provided the Receiving Party gives the Disclosing Party prompt prior
            notice where legally permitted.
          </P>
        </Section>

        {/* 9 */}
        <Section id="privacy" title="9. Privacy">
          <P>
            Belori's collection, use, and disclosure of personal information in connection with the
            Service is governed by our Privacy Policy, available at{' '}
            <a href="/privacy" style={{ color: C.rosa }}>/privacy</a>. The Privacy Policy is
            incorporated into these Terms by reference.
          </P>
          <P>
            By creating an account and using the Service, you consent to Belori's collection and use
            of information as described in our Privacy Policy. You are responsible for ensuring that
            your boutique's use of the Service complies with applicable privacy laws with respect to
            your clients' personal data.
          </P>
          <P>
            For SMS-specific data practices, including message content retention and carrier
            obligations, please see our SMS Terms at{' '}
            <a href="/sms-terms" style={{ color: C.rosa }}>/sms-terms</a>.
          </P>
        </Section>

        {/* 10 */}
        <Section id="uptime" title="10. Uptime & Support">
          <P>
            <strong>Uptime Target.</strong> Belori targets 99.5% monthly uptime for the Service,
            calculated as: <em>(total minutes in month − downtime minutes) / total minutes × 100</em>.
            Scheduled maintenance windows (announced with at least 24 hours' notice) and outages
            caused by third-party providers, force majeure events, or your actions are excluded from
            downtime calculations.
          </P>
          <P>
            <strong>Scheduled Maintenance.</strong> Belori may perform routine maintenance that
            temporarily affects availability. We will use commercially reasonable efforts to schedule
            maintenance during off-peak hours and to provide advance notice via in-app notification or
            email.
          </P>
          <P>
            <strong>Support.</strong> Belori provides customer support via email at{' '}
            <a href="mailto:support@belori.app" style={{ color: C.rosa }}>support@belori.app</a>.
            Belori targets an initial response within 48 hours on business days (Monday through
            Friday, excluding U.S. federal holidays). Response times are targets only and do not
            constitute a guarantee.
          </P>
          <P>
            THE UPTIME TARGET IN THIS SECTION IS A COMMITMENT, NOT A GUARANTEE. YOUR SOLE REMEDY FOR
            A FAILURE TO MEET THE UPTIME TARGET IS SERVICE CREDITS AS DESCRIBED IN BELORI'S SUPPORT
            DOCUMENTATION, WHERE APPLICABLE.
          </P>
        </Section>

        {/* 11 */}
        <Section id="liability" title="11. Limitation of Liability">
          <P caps>
            TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, IN NO EVENT SHALL BELORI, ITS
            AFFILIATES, DIRECTORS, OFFICERS, EMPLOYEES, AGENTS, OR LICENSORS BE LIABLE FOR ANY
            INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, EXEMPLARY, OR PUNITIVE DAMAGES, INCLUDING
            BUT NOT LIMITED TO LOSS OF PROFITS, LOSS OF REVENUE, LOSS OF DATA, LOSS OF GOODWILL,
            BUSINESS INTERRUPTION, OR COST OF SUBSTITUTE SERVICES, HOWEVER CAUSED AND REGARDLESS OF
            THE THEORY OF LIABILITY (TORT, CONTRACT, OR OTHERWISE), EVEN IF BELORI HAS BEEN ADVISED
            OF THE POSSIBILITY OF SUCH DAMAGES.
          </P>
          <P caps>
            TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, BELORI'S TOTAL CUMULATIVE LIABILITY
            TO YOU FOR ANY AND ALL CLAIMS ARISING OUT OF OR RELATED TO THESE TERMS OR THE SERVICE
            SHALL NOT EXCEED THE TOTAL FEES ACTUALLY PAID BY YOU TO BELORI IN THE TWELVE (12) MONTHS
            IMMEDIATELY PRECEDING THE EVENT GIVING RISE TO THE CLAIM.
          </P>
          <P>
            Some jurisdictions do not allow the exclusion or limitation of certain damages. In such
            jurisdictions, Belori's liability will be limited to the greatest extent permitted by
            applicable law.
          </P>
          <P>
            The limitations of liability in this Section reflect a reasonable allocation of risk
            between the parties and are an essential basis of the bargain between Belori and you.
            Belori would not be able to provide the Service at the prices offered without these
            limitations.
          </P>
        </Section>

        {/* 12 */}
        <Section id="indemnification" title="12. Indemnification">
          <P>
            You agree to indemnify, defend, and hold harmless Belori, its affiliates, and their
            respective directors, officers, employees, and agents (each, an "Indemnified Party") from
            and against any and all claims, damages, losses, liabilities, costs, and expenses
            (including reasonable attorneys' fees) arising out of or relating to:
          </P>
          <UL items={[
            'Your use of the Service, including your use of the SMS and email automation features;',
            'Your violation of these Terms or any representation or warranty made herein;',
            'Your violation of any applicable law, regulation, or third-party right, including but not limited to the Telephone Consumer Protection Act (TCPA), the CAN-SPAM Act, the California Consumer Privacy Act (CCPA), or the General Data Protection Regulation (GDPR);',
            'Your failure to obtain required consents from your boutique\'s clients before sending automated messages;',
            'Any claim by your clients or other third parties arising from your use of the Service or your business operations; or',
            'Your infringement of any intellectual property right of any third party.',
          ]} />
          <P>
            Belori reserves the right, at its own expense, to assume the exclusive defense and control
            of any matter otherwise subject to your indemnification, in which case you agree to
            cooperate with Belori's defense of such claim.
          </P>
        </Section>

        {/* 13 */}
        <Section id="termination" title="13. Termination">
          <P>
            <strong>Termination by You.</strong> You may terminate your account at any time by
            providing at least 30 days' written notice to Belori at{' '}
            <a href="mailto:support@belori.app" style={{ color: C.rosa }}>support@belori.app</a> or
            through the account cancellation flow in the Settings panel. Termination does not entitle
            you to a refund of any prepaid fees.
          </P>
          <P>
            <strong>Termination by Belori.</strong> Belori may terminate your subscription with 30
            days' written notice for any reason. Belori may suspend or terminate your access
            immediately and without notice in the event of: (a) a material breach of these Terms that
            you fail to cure within 5 days of written notice; (b) non-payment of fees beyond the
            10-day grace period described in Section 4; (c) use of the Service for illegal purposes;
            or (d) actions that pose a security risk to Belori or other customers.
          </P>
          <P>
            <strong>Effect of Termination.</strong> Upon termination or expiration of your
            subscription, your right to access the Service ceases immediately (or at the end of the
            notice period, as applicable). Belori will retain Your Data for 30 days following the
            effective termination date, during which time you may export your data using the Service's
            data export tools. After 30 days, Belori may delete Your Data from its production systems.
            Backup copies may persist for up to 90 days before deletion.
          </P>
          <P>
            Sections 7, 8, 11, 12, 14, and this sentence will survive termination of these Terms.
          </P>
        </Section>

        {/* 14 */}
        <Section id="governing-law" title="14. Governing Law & Dispute Resolution">
          <P>
            These Terms and any dispute arising out of or related to these Terms or the Service shall
            be governed by and construed in accordance with the laws of the State of Texas, USA,
            without regard to its conflict of law provisions.
          </P>
          <P>
            <strong>Binding Arbitration.</strong> Except as set forth below, any dispute, claim, or
            controversy arising out of or relating to these Terms or the breach, termination,
            enforcement, interpretation, or validity thereof, including the determination of the scope
            or applicability of this agreement to arbitrate, shall be determined by binding
            arbitration administered by the American Arbitration Association ("AAA") under its
            Commercial Arbitration Rules. The arbitration shall take place in Austin, Texas, or
            remotely if both parties agree. Judgment on the award rendered by the arbitrator may be
            entered in any court of competent jurisdiction.
          </P>
          <P>
            <strong>Exceptions.</strong> Either party may seek injunctive or other equitable relief
            in a court of competent jurisdiction for: (a) infringement or misappropriation of
            intellectual property rights; or (b) any breach of confidentiality obligations. Nothing
            in this Section shall prevent either party from seeking emergency relief.
          </P>
          <P>
            <strong>Class Action Waiver.</strong> All disputes must be brought in the party's
            individual capacity and not as a plaintiff or class member in any purported class action,
            collective action, or representative proceeding. The arbitrator may not consolidate more
            than one person's claims.
          </P>
          <P>
            <strong>Time Limit.</strong> Any claim or cause of action arising out of these Terms must
            be filed within one (1) year after the claim arises, or it will be permanently barred.
          </P>
        </Section>

        {/* 15 */}
        <Section id="changes" title="15. Changes to Terms">
          <P>
            Belori reserves the right to modify these Terms at any time. If we make material changes,
            we will notify you at least 30 days before the changes take effect by: (a) sending an
            email to the address associated with your account; (b) displaying a prominent notice
            within the Service; or (c) both.
          </P>
          <P>
            The revised Terms will indicate the updated effective date at the top of this page. If you
            do not agree to the revised Terms, you must stop using the Service before the effective
            date of the changes. Your continued use of the Service after the effective date of any
            changes constitutes your acceptance of the revised Terms.
          </P>
          <P>
            For changes that are required by law or that do not materially affect your rights, Belori
            may update these Terms without prior notice.
          </P>
        </Section>

        {/* 16 */}
        <Section id="contact" title="16. Contact">
          <P>
            If you have any questions, concerns, or requests regarding these Terms, please contact us
            at:
          </P>
          <P>
            <strong>Belori, Inc.</strong><br />
            Legal Department<br />
            Email:{' '}
            <a href="mailto:legal@belori.app" style={{ color: C.rosa }}>legal@belori.app</a>
          </P>
          <P>
            For support inquiries, please contact{' '}
            <a href="mailto:support@belori.app" style={{ color: C.rosa }}>support@belori.app</a>.
            For security concerns, please contact{' '}
            <a href="mailto:security@belori.app" style={{ color: C.rosa }}>security@belori.app</a>.
          </P>
        </Section>

        <hr style={{ ...st.divider, marginTop: 48 }} />

        <p style={{ ...st.p, color: C.gl, fontSize: 13 }}>
          These Terms of Service were last updated on April 17, 2026. Previous versions are
          available upon request.
        </p>
      </article>

      {/* Footer */}
      <footer style={st.footer}>
        <span style={st.footerNote}>© 2026 Belori, Inc. All rights reserved.</span>
        <div style={st.footerLinks}>
          <a href="/privacy" style={st.footerLink}>Privacy Policy</a>
          <a href="/sms-terms" style={st.footerLink}>SMS Terms</a>
          <a href="/dpa" style={st.footerLink}>Data Processing Agreement</a>
        </div>
      </footer>
    </div>
  )
}
