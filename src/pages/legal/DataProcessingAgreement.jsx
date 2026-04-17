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
    marginBottom: 40,
  },
  h2: {
    fontSize: 17,
    fontWeight: 700,
    color: C.ink,
    marginBottom: 10,
    marginTop: 0,
    paddingBottom: 6,
    borderBottom: `1px solid ${C.border}`,
  },
  h3: {
    fontSize: 14,
    fontWeight: 700,
    color: C.gray,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    margin: '16px 0 6px',
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
  tableWrap: {
    overflowX: 'auto',
    marginTop: 12,
    marginBottom: 12,
    borderRadius: 8,
    border: `1px solid ${C.border}`,
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: 14,
    background: C.white,
  },
  th: {
    background: '#F5ECED',
    color: C.ink,
    fontWeight: 700,
    padding: '10px 14px',
    textAlign: 'left',
    borderBottom: `1px solid ${C.border}`,
    whiteSpace: 'nowrap',
  },
  td: {
    padding: '10px 14px',
    borderBottom: `1px solid ${C.border}`,
    color: '#2E1A1E',
    verticalAlign: 'top',
  },
  tdLast: {
    padding: '10px 14px',
    color: '#2E1A1E',
    verticalAlign: 'top',
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

const subProcessors = [
  { name: 'Supabase Inc.',  purpose: 'Database, Authentication, File Storage', location: 'US (AWS us-east-1)' },
  { name: 'Stripe Inc.',    purpose: 'Payment processing and billing',          location: 'US' },
  { name: 'Twilio Inc.',    purpose: 'SMS delivery and messaging',              location: 'US' },
  { name: 'Resend Inc.',    purpose: 'Transactional email delivery',            location: 'US' },
  { name: 'Inngest Inc.',   purpose: 'Workflow and job automation',             location: 'US' },
  { name: 'Vercel Inc.',    purpose: 'Web hosting and CDN',                     location: 'US / Global' },
]

export default function DataProcessingAgreement() {
  return (
    <div style={styles.page}>
      {/* Nav */}
      <nav style={styles.nav}>
        <a href="/" style={styles.navBrand}>■ BELORI</a>
      </nav>

      {/* Main content */}
      <main style={styles.main}>
        <div style={styles.eyebrow}>Legal</div>
        <h1 style={styles.h1}>Data Processing Agreement</h1>
        <p style={styles.effectiveDate}>Effective Date: April 17, 2026</p>

        {/* 1. Introduction */}
        <section style={styles.section}>
          <h2 style={styles.h2}>1. Introduction</h2>
          <p style={styles.p}>
            This Data Processing Agreement ("DPA") is entered into between the bridal boutique or business
            entity that has registered for and uses the Belori platform ("Controller" or "Boutique") and
            Belori Inc., a company organized under the laws of the State of Texas ("Processor" or "Belori").
            This DPA forms part of, and is incorporated by reference into, the Belori Terms of Service
            available at <a href="/terms" style={{ color: C.rosa }}>/terms</a> (the "Terms").
          </p>
          <p style={styles.p}>
            This DPA governs Belori's processing of personal data on behalf of the Boutique in connection
            with the provision of the Belori boutique management platform (the "Service"). In the event of
            any conflict between this DPA and the Terms with respect to the subject matter of data
            processing, this DPA shall control.
          </p>
          <p style={styles.p}>
            By accessing or using the Service, the Boutique agrees to be bound by this DPA. If you are
            entering into this DPA on behalf of a company or other legal entity, you represent that you have
            the authority to bind that entity to this DPA.
          </p>
        </section>

        {/* 2. Definitions */}
        <section style={styles.section}>
          <h2 style={styles.h2}>2. Definitions</h2>
          <p style={styles.p}>
            The following terms, as used in this DPA, have the meanings set forth below. Capitalized terms
            not defined herein shall have the meanings given in the Terms or, where applicable, in the
            General Data Protection Regulation (EU) 2016/679 ("GDPR").
          </p>
          <ul style={styles.ul}>
            <li style={styles.li}>
              <strong>"Personal Data"</strong> means any information relating to an identified or
              identifiable natural person ("data subject"), as defined in GDPR Article 4(1). For the
              purposes of this DPA, Personal Data refers specifically to data about the Boutique's clients
              and prospective clients that is processed through the Service.
            </li>
            <li style={styles.li}>
              <strong>"Processing"</strong> means any operation or set of operations performed on Personal
              Data, whether or not by automated means, including collection, recording, organization,
              structuring, storage, adaptation, retrieval, consultation, use, disclosure, dissemination,
              restriction, erasure, or destruction (GDPR Art. 4(2)).
            </li>
            <li style={styles.li}>
              <strong>"Data Subject"</strong> means an identified or identifiable natural person to whom
              Personal Data relates — in the context of this DPA, primarily the Boutique's clients and
              prospective clients (GDPR Art. 4(1)).
            </li>
            <li style={styles.li}>
              <strong>"Controller"</strong> means the natural or legal person, public authority, agency,
              or other body that determines the purposes and means of Processing Personal Data — in this
              DPA, the Boutique (GDPR Art. 4(7)).
            </li>
            <li style={styles.li}>
              <strong>"Processor"</strong> means the natural or legal person, public authority, agency, or
              other body that processes Personal Data on behalf of the Controller — in this DPA, Belori
              Inc. (GDPR Art. 4(8)).
            </li>
            <li style={styles.li}>
              <strong>"Sub-processor"</strong> means any third party engaged by the Processor (Belori) to
              carry out specific processing activities on Personal Data on behalf of the Controller.
            </li>
            <li style={styles.li}>
              <strong>"Supervisory Authority"</strong> means an independent public authority established
              by an EU Member State pursuant to GDPR Article 51, or an equivalent authority under
              applicable data protection law (e.g., the UK Information Commissioner's Office).
            </li>
          </ul>
        </section>

        {/* 3. Scope of Processing */}
        <section style={styles.section}>
          <h2 style={styles.h2}>3. Scope of Processing</h2>
          <p style={styles.p}>
            The following describes the subject matter and details of the processing covered by this DPA:
          </p>

          <h3 style={styles.h3}>Subject Matter</h3>
          <p style={styles.p}>
            Provision of the Belori boutique management platform, including event management, client
            relationship management, appointment scheduling, payment tracking, SMS and email communications,
            and related administrative features.
          </p>

          <h3 style={styles.h3}>Duration</h3>
          <p style={styles.p}>
            The term of the Boutique's subscription agreement with Belori, plus any additional period
            required for data retention as described in Section 12 of this DPA.
          </p>

          <h3 style={styles.h3}>Nature and Purpose of Processing</h3>
          <p style={styles.p}>
            Storage, retrieval, automated processing, and transmission of client Personal Data, solely for
            the purpose of providing the Service as described in the Terms. Belori does not process Personal
            Data for its own commercial purposes, and does not sell Personal Data to third parties.
          </p>

          <h3 style={styles.h3}>Types of Personal Data Processed</h3>
          <ul style={styles.ul}>
            <li style={styles.li}>Client and prospective client names</li>
            <li style={styles.li}>Contact information (phone number, email address)</li>
            <li style={styles.li}>Body measurements relevant to dress fittings and alterations</li>
            <li style={styles.li}>Event details (event date, venue, guest count, event type)</li>
            <li style={styles.li}>Payment history and financial milestones</li>
            <li style={styles.li}>Communications preferences and opt-in/opt-out status</li>
            <li style={styles.li}>Appointment history and notes</li>
            <li style={styles.li}>Style preferences, inspiration details, and other event planning information</li>
          </ul>

          <h3 style={styles.h3}>Categories of Data Subjects</h3>
          <p style={styles.p}>
            The Boutique's existing clients, prospective clients (leads), and in limited cases, emergency
            contacts or partner information provided by clients in connection with event planning.
          </p>
        </section>

        {/* 4. Controller's Obligations */}
        <section style={styles.section}>
          <h2 style={styles.h2}>4. Controller's Obligations</h2>
          <p style={styles.p}>
            As the Controller, the Boutique is responsible for the following:
          </p>
          <ul style={styles.ul}>
            <li style={styles.li}>
              <strong>Lawful basis for processing:</strong> Ensuring that all processing of Personal Data
              through the Service rests on a valid legal basis under applicable data protection law (e.g.,
              consent, contract performance, legitimate interests).
            </li>
            <li style={styles.li}>
              <strong>Consent for SMS communications:</strong> Obtaining, documenting, and maintaining
              valid prior express written consent from each client before sending any marketing or
              transactional SMS messages through the Belori platform, in accordance with the Belori SMS
              Messaging Terms at <a href="/sms-terms" style={{ color: C.rosa }}>/sms-terms</a>.
            </li>
            <li style={styles.li}>
              <strong>Data subject requests:</strong> Handling and responding to data subject rights
              requests (access, rectification, erasure, portability, objection, restriction) received
              directly by the Boutique from its clients, with Belori's assistance as described in
              Section 9.
            </li>
            <li style={styles.li}>
              <strong>Accuracy of data:</strong> Ensuring that Personal Data entered into the Service
              is accurate, up to date, and limited to what is necessary for the purposes for which it
              is processed.
            </li>
            <li style={styles.li}>
              <strong>Special category data:</strong> Not inputting or storing special categories of
              personal data (as defined in GDPR Art. 9) — including health data, biometric data, or
              genetic data — beyond body measurements that are strictly necessary for dress fittings
              and alterations in the ordinary course of boutique operations. Any such measurements
              should be treated with appropriate care and not used for any other purpose.
            </li>
            <li style={styles.li}>
              <strong>Privacy notices:</strong> Providing appropriate privacy notices to data subjects
              that accurately describe the Controller's data processing activities, including use of
              Belori as a platform provider.
            </li>
          </ul>
        </section>

        {/* 5. Processor's Obligations */}
        <section style={styles.section}>
          <h2 style={styles.h2}>5. Processor's Obligations</h2>
          <p style={styles.p}>
            Belori, as Processor, shall:
          </p>
          <ul style={styles.ul}>
            <li style={styles.li}>
              <strong>(a) Process only on documented instructions:</strong> Process Personal Data only on
              documented instructions from the Controller (i.e., as configured through the Service and as
              set out in the Terms and this DPA), unless required to do so by applicable law. Belori will
              inform the Controller if it believes an instruction infringes applicable data protection law,
              to the extent permitted by that law.
            </li>
            <li style={styles.li}>
              <strong>(b) Confidentiality:</strong> Ensure that all persons authorized to process Personal
              Data on behalf of Belori are bound by enforceable obligations of confidentiality with respect
              to that Personal Data.
            </li>
            <li style={styles.li}>
              <strong>(c) Technical and organizational security measures:</strong> Implement appropriate
              technical and organizational measures to ensure a level of security appropriate to the risk,
              as required by GDPR Article 32 and as further described in Section 7 of this DPA.
            </li>
            <li style={styles.li}>
              <strong>(d) Assist with data subject rights:</strong> Taking into account the nature of the
              processing, assist the Controller by appropriate technical and organizational measures, insofar
              as possible, for the fulfilment of the Controller's obligation to respond to data subject
              rights requests under applicable data protection law.
            </li>
            <li style={styles.li}>
              <strong>(e) Delete or return data upon termination:</strong> At the Controller's choice,
              delete or return all Personal Data to the Controller after the end of the provision of the
              Service, and delete existing copies unless retention is required by applicable law. See
              Section 12 for details.
            </li>
            <li style={styles.li}>
              <strong>(f) Demonstrate compliance:</strong> Make available to the Controller all information
              necessary to demonstrate compliance with the obligations laid down in GDPR Article 28, and
              allow for and contribute to audits and inspections conducted by the Controller or a mandated
              auditor, subject to the conditions in Section 11.
            </li>
            <li style={styles.li}>
              <strong>(g) Sub-processor management:</strong> Ensure that any sub-processors engaged by
              Belori are bound by data processing agreements that impose obligations no less protective than
              those in this DPA. Belori remains fully liable to the Controller for the performance of
              sub-processors' obligations.
            </li>
          </ul>
        </section>

        {/* 6. Sub-processors */}
        <section style={styles.section}>
          <h2 style={styles.h2}>6. Sub-processors</h2>
          <p style={styles.p}>
            The Controller hereby grants Belori general written authorization to engage the following
            sub-processors in connection with the provision of the Service:
          </p>

          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Sub-processor</th>
                  <th style={styles.th}>Purpose</th>
                  <th style={styles.th}>Location</th>
                </tr>
              </thead>
              <tbody>
                {subProcessors.map((sp, i) => (
                  <tr key={sp.name}>
                    <td style={i < subProcessors.length - 1 ? styles.td : styles.tdLast}>
                      <strong>{sp.name}</strong>
                    </td>
                    <td style={i < subProcessors.length - 1 ? styles.td : styles.tdLast}>
                      {sp.purpose}
                    </td>
                    <td style={i < subProcessors.length - 1 ? styles.td : styles.tdLast}>
                      {sp.location}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p style={styles.p}>
            Belori will notify the Controller of any intended changes to the above list of sub-processors —
            including additions or replacements — with at least <strong>30 days' prior written notice</strong>,
            giving the Controller the opportunity to object to such changes. If the Controller objects on
            legitimate data protection grounds, the parties will work in good faith to resolve the objection.
            If no resolution is reached, the Controller may terminate the relevant portion of the Service
            without penalty.
          </p>
        </section>

        {/* 7. Security Measures */}
        <section style={styles.section}>
          <h2 style={styles.h2}>7. Security Measures (GDPR Art. 32)</h2>
          <p style={styles.p}>
            Belori implements appropriate technical and organizational measures to protect Personal Data
            against accidental or unlawful destruction, loss, alteration, unauthorized disclosure, or
            access. Current security measures include, but are not limited to:
          </p>
          <ul style={styles.ul}>
            <li style={styles.li}>
              <strong>Encryption in transit:</strong> TLS 1.2 or higher for all data transmitted between
              clients, the Service, and Belori's infrastructure.
            </li>
            <li style={styles.li}>
              <strong>Encryption at rest:</strong> AES-256 encryption for Personal Data stored in
              Belori's database and file storage systems.
            </li>
            <li style={styles.li}>
              <strong>Tenant isolation:</strong> Row-level security (RLS) policies in the database ensure
              that each Boutique's data is strictly isolated from other Boutiques' data, enforced at the
              database layer independently of application-level controls.
            </li>
            <li style={styles.li}>
              <strong>Access controls and least privilege:</strong> Internal access to production systems
              and Personal Data is limited to employees and contractors with a documented need for access,
              using role-based access controls and least privilege principles.
            </li>
            <li style={styles.li}>
              <strong>Regular security testing:</strong> Periodic vulnerability assessments and security
              reviews of the platform and its dependencies.
            </li>
            <li style={styles.li}>
              <strong>Incident response plan:</strong> A documented process for detecting, responding to,
              and recovering from security incidents, including the notification procedures described in
              Section 8.
            </li>
            <li style={styles.li}>
              <strong>Employee security training:</strong> Regular data protection and security awareness
              training for all Belori personnel with access to production systems.
            </li>
          </ul>
          <p style={styles.p}>
            Belori reviews and updates its security measures on an ongoing basis in response to new risks,
            technological developments, and industry standards.
          </p>
        </section>

        {/* 8. Data Breach Notification */}
        <section style={styles.section}>
          <h2 style={styles.h2}>8. Data Breach Notification</h2>
          <p style={styles.p}>
            Belori will notify the Controller without undue delay, and in any event within{' '}
            <strong>72 hours</strong> of becoming aware of a personal data breach that affects Personal
            Data processed on behalf of the Controller, to the extent such notification is reasonably
            possible. In cases where a full notification cannot be provided within 72 hours, Belori will
            provide an initial notification followed by supplementary information as it becomes available.
          </p>
          <p style={styles.p}>
            Breach notifications will include, to the extent known at the time of notification:
          </p>
          <ul style={styles.ul}>
            <li style={styles.li}>
              A description of the nature of the personal data breach, including the categories and
              approximate number of data subjects concerned and the categories and approximate number
              of personal data records concerned.
            </li>
            <li style={styles.li}>
              The name and contact details of Belori's data protection contact (privacy@belori.app).
            </li>
            <li style={styles.li}>
              A description of the likely consequences of the personal data breach.
            </li>
            <li style={styles.li}>
              A description of the measures taken or proposed to be taken by Belori to address the breach,
              including, where appropriate, measures to mitigate its possible adverse effects.
            </li>
          </ul>
          <p style={styles.p}>
            Notifications will be sent to the email address associated with the Boutique's account. It is
            the Controller's responsibility to ensure that account contact information is kept current.
            The Controller is responsible for assessing whether the breach requires notification to a
            Supervisory Authority or to affected data subjects under applicable law.
          </p>
        </section>

        {/* 9. Data Subject Rights */}
        <section style={styles.section}>
          <h2 style={styles.h2}>9. Data Subject Rights</h2>
          <p style={styles.p}>
            Belori will assist the Controller in fulfilling its obligations to respond to data subject
            rights requests under applicable data protection law, including:
          </p>
          <ul style={styles.ul}>
            <li style={styles.li}>
              <strong>Right of access (GDPR Art. 15):</strong> Providing the Controller with the
              ability to export or view all Personal Data held for a specific client within the Service.
            </li>
            <li style={styles.li}>
              <strong>Right to rectification (GDPR Art. 16):</strong> Enabling the Controller to update
              or correct inaccurate Personal Data through the Service interface.
            </li>
            <li style={styles.li}>
              <strong>Right to erasure (GDPR Art. 17):</strong> Enabling the Controller to delete a
              client's Personal Data from the Service. Belori will process such deletions within 30 days,
              subject to any legal retention obligations.
            </li>
            <li style={styles.li}>
              <strong>Right to data portability (GDPR Art. 20):</strong> Supporting export of Personal
              Data in a structured, commonly used, machine-readable format.
            </li>
            <li style={styles.li}>
              <strong>Right to object / restriction (GDPR Arts. 18, 21):</strong> Where technically
              feasible, assisting the Controller in restricting the processing of specific data subjects'
              Personal Data on request.
            </li>
          </ul>
          <p style={styles.p}>
            The Controller is the primary point of contact for data subjects and is responsible for
            assessing the validity of data subject requests and responding within the timelines required
            by applicable law (generally 30 days under GDPR, with possible extensions).
          </p>
        </section>

        {/* 10. International Transfers */}
        <section style={styles.section}>
          <h2 style={styles.h2}>10. International Transfers</h2>
          <p style={styles.p}>
            Personal Data processed under this DPA is stored and processed in the United States. Belori's
            primary infrastructure is hosted on Amazon Web Services in the us-east-1 (Northern Virginia)
            region, with CDN edge nodes potentially located in other countries.
          </p>
          <p style={styles.p}>
            <strong>EEA and UK transfers:</strong> To the extent that the Boutique transfers Personal
            Data of individuals in the European Economic Area (EEA) or the United Kingdom (UK) to Belori,
            the parties agree to incorporate and be bound by the EU Standard Contractual Clauses (SCCs)
            as published by the European Commission on June 4, 2021, specifically Module 2 (Controller to
            Processor), which are hereby incorporated by reference into this DPA.
          </p>
          <p style={styles.p}>
            For UK data transfers, the UK Addendum to the EU SCCs (as issued by the UK Information
            Commissioner's Office) applies, and the parties agree to execute such addendum upon request.
          </p>
          <p style={styles.p}>
            In the event that any transfer mechanism relied upon by Belori is invalidated by a court or
            regulatory authority, the parties will cooperate in good faith to implement an alternative
            lawful transfer mechanism without undue delay.
          </p>
        </section>

        {/* 11. Audit Rights */}
        <section style={styles.section}>
          <h2 style={styles.h2}>11. Audit Rights</h2>
          <p style={styles.p}>
            The Controller may audit Belori's compliance with this DPA no more than once per calendar
            year, subject to at least <strong>30 days' prior written notice</strong> to privacy@belori.app.
            Any audit must be conducted during normal business hours, at the Controller's expense, and
            must not unreasonably interfere with Belori's business operations. The Controller must treat
            all information obtained during an audit as confidential.
          </p>
          <p style={styles.p}>
            Belori may satisfy the Controller's audit request, in whole or in part, by making available
            third-party audit reports and certifications (e.g., SOC 2 Type II, ISO 27001) where such
            reports are reasonably current and cover the subject matter of the audit request. The parties
            will cooperate in good faith to agree on the scope and format of any audit.
          </p>
          <p style={styles.p}>
            In the event of a suspected or confirmed personal data breach, the Controller may request an
            additional audit relating to the breach outside the annual limit.
          </p>
        </section>

        {/* 12. Termination & Data Deletion */}
        <section style={styles.section}>
          <h2 style={styles.h2}>12. Termination &amp; Data Deletion</h2>
          <p style={styles.p}>
            Upon expiration or termination of the Boutique's subscription or the Terms, the following
            applies:
          </p>
          <ul style={styles.ul}>
            <li style={styles.li}>
              <strong>Data export window:</strong> Belori will make the Controller's Personal Data
              available for export for a period of <strong>30 days</strong> following the effective date
              of termination ("Export Period"). The Controller should use this period to download any
              data it requires for ongoing operations.
            </li>
            <li style={styles.li}>
              <strong>Secure deletion:</strong> Within <strong>90 days</strong> following the end of the
              Export Period, Belori will securely delete all Personal Data processed on behalf of the
              Controller from its systems and those of its sub-processors, except to the extent that
              retention is required by applicable law or regulation.
            </li>
            <li style={styles.li}>
              <strong>Confirmation of deletion:</strong> Upon written request submitted prior to or within
              the 90-day deletion period, Belori will provide the Controller with written confirmation
              that all Personal Data has been deleted.
            </li>
            <li style={styles.li}>
              <strong>Legal retention exceptions:</strong> Notwithstanding the above, Belori may retain
              Personal Data where required by applicable law (e.g., financial records required for tax
              compliance), in which case Belori will notify the Controller of the nature and duration of
              such retention and will restrict processing of retained data to only the purposes required
              by law.
            </li>
          </ul>
        </section>

        {/* 13. Liability */}
        <section style={styles.section}>
          <h2 style={styles.h2}>13. Liability</h2>
          <p style={styles.p}>
            Each party's liability under this DPA, whether in contract, tort (including negligence), or
            otherwise, is subject to the limitations and exclusions of liability set out in the Belori
            Terms of Service available at <a href="/terms" style={{ color: C.rosa }}>/terms</a>. Nothing
            in this DPA is intended to expand the scope of either party's liability beyond what is
            provided for in the Terms, except to the extent required by mandatory applicable data
            protection law.
          </p>
          <p style={styles.p}>
            Where both the Controller and Processor are responsible for a breach of applicable data
            protection law, each party shall be held liable for the part of the damage caused by that
            party, in accordance with GDPR Article 82 or equivalent applicable law.
          </p>
        </section>

        {/* 14. Governing Law */}
        <section style={styles.section}>
          <h2 style={styles.h2}>14. Governing Law</h2>
          <p style={styles.p}>
            This DPA is governed by and construed in accordance with the laws of the State of Texas,
            United States, without regard to its conflict of law principles, unless a different governing
            law is required by the mandatory provisions of applicable data protection law (including, where
            applicable, GDPR or UK GDPR). Any disputes arising under this DPA shall be resolved in
            accordance with the dispute resolution provisions of the Terms.
          </p>
        </section>

        {/* 15. Contact */}
        <section style={styles.section}>
          <h2 style={styles.h2}>15. Contact</h2>
          <p style={styles.p}>
            For data protection inquiries, to exercise rights under this DPA, or to report a suspected
            data breach, please contact:
          </p>
          <div style={styles.highlight}>
            <strong>Belori Inc. — Data Privacy</strong><br />
            Email: <strong>privacy@belori.app</strong><br />
            Address: Austin, TX 78701, USA
          </div>
          <p style={styles.p}>
            Belori aims to respond to all data protection inquiries within 5 business days.
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
            <a href="/sms-terms" style={styles.footerLink}>SMS Messaging Terms</a>
          </div>
        </div>
      </footer>
    </div>
  )
}
