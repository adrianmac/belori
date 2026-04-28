// BoutiqueProfilePage — public-facing maison digital storefront.
//
// This is the page boutiques link from their Instagram bio, business cards,
// and email signatures. It's the FACE of the boutique in the Belori
// ecosystem — has to read like a luxury bridal house, not a SaaS profile.
//
// Aesthetic direction (committed): editorial bridal magazine.
// Italiana display typography at architectural scale, Cormorant italic for
// pull quotes, DM Sans for utility copy. Generous negative space, narrow
// content column, hairline rules with diamond ornaments separating bands,
// asymmetric masthead. The boutique's own primary_color is used sparingly
// as a single accent against the warm-cream couture palette.
//
// Data flow: hits the public booking-page-data Edge Function with
// `?include=profile` so it gets reviews + packages + offered_services.
// Direct Supabase queries from this page would fail under the post-RLS
// schema (anon SELECT on `boutiques` is locked down), so the Edge
// Function is the only way an unauthenticated visitor can see anything.

import React, { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { D, OrnamentRule, injectCoutureFonts, forceLightTheme } from '../lib/couture.jsx'

const FN_BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`

// Service catalog — the labels here are intentionally more aspirational
// than the wizard versions. The wizard says "Dress Rental"; the storefront
// says "Bridal & quinceañera couture."
const SERVICE_COPY = {
  dress_rental:   { label: 'Atelier couture',     line: 'Bridal and quinceañera gowns, fitted by hand.' },
  alterations:    { label: 'Bespoke alterations', line: 'Hand-finished tailoring for the perfect line.' },
  decoration:     { label: 'Florals & decor',     line: 'Florals, linens, lighting, and tablescapes.' },
  event_planning: { label: 'Event direction',     line: 'Full-service planning, day-of orchestration.' },
  photography:    { label: 'Photography',         line: 'Editorial coverage from first fitting to last dance.' },
  hair_makeup:    { label: 'Hair & makeup',       line: 'On-location styling for the bride and her party.' },
}

function fmtMonth(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

function fmtPrice(cents) {
  if (cents == null) return null
  // base_price is stored in DOLLARS in the schema, not cents. Numeric(10,2).
  const n = Number(cents)
  if (!Number.isFinite(n) || n === 0) return null
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
}

// ─── LOADING ─────────────────────────────────────────────────────────────────
function LoadingScreen() {
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: D.bg, fontFamily: D.sans,
    }}>
      <div style={{ textAlign: 'center', opacity: 0.7 }}>
        <div className="couture-display" style={{ fontSize: 32, color: D.ink, letterSpacing: '0.02em' }}>
          Belori
        </div>
        <OrnamentRule width={40} style={{ marginTop: 14, marginBottom: 14 }} />
        <div className="couture-smallcaps" style={{ color: D.inkLight, letterSpacing: '0.28em' }}>
          Loading the maison
        </div>
      </div>
    </div>
  )
}

// ─── NOT FOUND ───────────────────────────────────────────────────────────────
function NotFoundScreen() {
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: D.bg, padding: 24, textAlign: 'center',
    }}>
      <div style={{ maxWidth: 420 }}>
        <div className="couture-display" style={{ fontSize: 96, color: D.gold, letterSpacing: '0.02em', lineHeight: 1 }}>
          —
        </div>
        <OrnamentRule width={48} style={{ marginTop: 12, marginBottom: 24 }} />
        <h1 className="couture-serif-i" style={{
          fontSize: 28, color: D.ink, fontWeight: 400, fontStyle: 'italic',
          margin: 0,
        }}>
          This atelier has stepped out.
        </h1>
        <p style={{
          fontFamily: D.sans, fontSize: 13, color: D.inkMid,
          marginTop: 18, lineHeight: 1.7,
        }}>
          The boutique you're looking for couldn't be found. Double-check the link, or visit{' '}
          <Link to="/" className="couture-link" style={{ color: D.ink }}>belori.app</Link>.
        </p>
      </div>
    </div>
  )
}

// ─── MAIN PAGE ───────────────────────────────────────────────────────────────
export default function BoutiqueProfilePage() {
  const { slug } = useParams()
  const [boutique, setBoutique] = useState(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => { injectCoutureFonts(); forceLightTheme() }, [])

  // Fetch boutique data via the same Edge Function the booking page uses,
  // with the ?include=profile flag for the richer payload (reviews,
  // packages, offered_services).
  useEffect(() => {
    if (!slug) { setNotFound(true); setLoading(false); return }
    fetch(`${FN_BASE}/booking-page-data?slug=${encodeURIComponent(slug)}&include=profile`)
      .then(r => r.json())
      .then(d => {
        if (d.error) setNotFound(true)
        else setBoutique(d)
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false))
  }, [slug])

  // Update meta tags + title once the boutique loads — so iMessage /
  // WhatsApp / FB previews look professional when the URL is shared.
  useEffect(() => {
    if (!boutique?.name) return
    const title = `${boutique.name} · Atelier`
    const desc = `Bridal, quinceañera & event services at ${boutique.name}. Book a consultation today.`
    document.title = title
    setMeta('og:title',       title, 'property')
    setMeta('og:description', desc,  'property')
    setMeta('og:type',        'website', 'property')
    setMeta('twitter:card',   'summary')
    setMeta('description',    desc)
  }, [boutique?.name])

  if (loading)  return <LoadingScreen/>
  if (notFound) return <NotFoundScreen/>

  // Boutique's own primary color = a single accent threaded into ornament
  // hairlines + the CTA. Keeps the palette warm-cream-and-gold-dominant.
  const accent = boutique.primary_color || D.gold
  const services = (boutique.offered_services || []).map(id => ({
    id, ...(SERVICE_COPY[id] || { label: id, line: '' })
  }))
  const reviews  = boutique.reviews || []
  const packages = boutique.packages || []

  return (
    <div style={{
      minHeight: '100vh',
      background: D.bg,
      color: D.ink,
      fontFamily: D.sans,
    }} className="couture-grain">

      {/* ───────── MASTHEAD — folio bar ───────── */}
      <header style={{
        padding: '24px clamp(20px, 4vw, 56px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: `1px solid ${D.inkHair}`,
        position: 'sticky', top: 0, zIndex: 10,
        background: 'rgba(248,244,240,0.92)',
        backdropFilter: 'blur(8px)',
      }}>
        <div className="couture-smallcaps" style={{ color: D.inkLight, letterSpacing: '0.32em' }}>
          The Belori Folio
        </div>
        <Link to={boutique.slug ? `/book/${boutique.slug}` : '#'} className="couture-link" style={{
          fontFamily: D.sans, fontSize: 11, color: D.ink,
          textTransform: 'uppercase', letterSpacing: '0.18em', fontWeight: 500,
        }}>
          Book a consultation
        </Link>
      </header>

      {/* ───────── HERO — editorial title ───────── */}
      <section style={{
        padding: 'clamp(64px, 10vw, 140px) clamp(24px, 6vw, 96px) clamp(48px, 6vw, 80px)',
        maxWidth: 1280, margin: '0 auto',
      }}>
        <div className="couture-fade-up couture-fade-up-1">
          <div className="couture-smallcaps" style={{ color: accent, letterSpacing: '0.4em', marginBottom: 22 }}>
            Volume I &nbsp;·&nbsp; Issue No. 01
          </div>
        </div>

        <h1 className="couture-display couture-fade-up couture-fade-up-2" style={{
          fontSize: 'clamp(64px, 12vw, 200px)',
          lineHeight: 0.92,
          color: D.ink,
          margin: 0,
          fontWeight: 400,
          letterSpacing: '-0.005em',
        }}>
          {boutique.name}
        </h1>

        <div className="couture-fade-up couture-fade-up-3" style={{
          marginTop: 36,
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))',
          gap: 'clamp(32px, 4vw, 56px)',
          paddingTop: 32,
          borderTop: `1px solid ${D.inkHair}`,
        }}>
          {/* Tagline */}
          <p className="couture-serif-i" style={{
            fontSize: 'clamp(18px, 1.6vw, 22px)',
            lineHeight: 1.55,
            color: D.inkMid,
            margin: 0,
            fontStyle: 'italic',
            fontWeight: 300,
            maxWidth: 480,
          }}>
            A studio for the boutique that measures its days in fittings, flowers, and the
            grace of every bride who walks out the door.
          </p>

          {/* Contact masthead */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr',
            gap: 14,
            alignSelf: 'end',
          }}>
            {boutique.address && (
              <MastheadField label="In residence" value={boutique.address}/>
            )}
            {boutique.phone && (
              <MastheadField label="By appointment" value={boutique.phone} href={`tel:${boutique.phone}`}/>
            )}
            {boutique.email && (
              <MastheadField label="Correspondence" value={boutique.email} href={`mailto:${boutique.email}`}/>
            )}
            {boutique.instagram && (
              <MastheadField label="Instagram" value={`@${boutique.instagram.replace(/^@/, '')}`}
                href={`https://instagram.com/${boutique.instagram.replace(/^@/, '')}`} external/>
            )}
          </div>
        </div>
      </section>

      {/* ───────── SERVICES — numbered editorial list ───────── */}
      {services.length > 0 && (
        <section style={{
          padding: 'clamp(48px, 6vw, 96px) clamp(24px, 6vw, 96px)',
          maxWidth: 1280, margin: '0 auto',
        }}>
          <SectionHeader eyebrow="The atelier offers" title="A complete service" />

          <ol style={{
            listStyle: 'none', padding: 0, margin: '48px 0 0',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))',
            gap: '40px clamp(32px, 4vw, 64px)',
          }}>
            {services.map((s, i) => (
              <li key={s.id} style={{
                paddingTop: 18,
                borderTop: `1px solid ${D.inkHair}`,
                display: 'flex', flexDirection: 'column', gap: 8,
                position: 'relative',
              }}>
                <div className="couture-display" style={{
                  fontSize: 13,
                  color: accent,
                  letterSpacing: '0.04em',
                }}>
                  <span>{String(i + 1).padStart(2, '0')}</span>
                  <span aria-hidden="true" style={{ display: 'inline-block', width: 18, height: 1, background: accent, verticalAlign: 'middle', margin: '0 10px', opacity: 0.5 }}/>
                </div>
                <h3 className="couture-serif" style={{
                  fontSize: 22, color: D.ink, margin: 0, fontWeight: 400,
                  letterSpacing: '0.005em',
                }}>
                  {s.label}
                </h3>
                <p style={{
                  fontFamily: D.sans, fontSize: 13, color: D.inkMid,
                  margin: 0, lineHeight: 1.7, maxWidth: 360,
                }}>
                  {s.line}
                </p>
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* ───────── PACKAGES — pricing cards (only if boutique published any) ───────── */}
      {packages.length > 0 && (
        <section style={{
          padding: 'clamp(48px, 6vw, 96px) clamp(24px, 6vw, 96px)',
          maxWidth: 1280, margin: '0 auto',
          background: D.bgDeep,
        }}>
          <SectionHeader eyebrow="Standing offers" title="Packages" />
          <div style={{
            marginTop: 48,
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))',
            gap: 24,
          }}>
            {packages.map(p => (
              <article key={p.id} style={{
                background: D.cardWarm,
                border: `1px solid ${D.border}`,
                padding: '32px 28px 28px',
                position: 'relative',
              }}>
                <div className="couture-smallcaps" style={{ color: accent, letterSpacing: '0.28em' }}>
                  {(p.event_type || 'wedding').replace(/_/g, ' ')}
                </div>
                <h3 className="couture-serif" style={{
                  fontSize: 26, color: D.ink, margin: '14px 0 10px',
                  fontWeight: 400, letterSpacing: '0.005em',
                }}>
                  {p.name}
                </h3>
                {p.description && (
                  <p style={{
                    fontFamily: D.sans, fontSize: 13, color: D.inkMid,
                    lineHeight: 1.65, margin: 0, marginBottom: 18,
                  }}>
                    {p.description}
                  </p>
                )}
                {fmtPrice(p.base_price) && (
                  <>
                    <OrnamentRule width={32} style={{ marginBottom: 14 }} />
                    <div className="couture-display" style={{ fontSize: 36, color: D.ink, lineHeight: 1 }}>
                      {fmtPrice(p.base_price)}
                    </div>
                    <div className="couture-smallcaps" style={{ color: D.inkLight, marginTop: 6 }}>
                      Starting from
                    </div>
                  </>
                )}
              </article>
            ))}
          </div>
        </section>
      )}

      {/* ───────── PULL QUOTES — NPS-derived testimonials ───────── */}
      {reviews.length > 0 && (
        <section style={{
          padding: 'clamp(64px, 8vw, 120px) clamp(24px, 6vw, 96px)',
          maxWidth: 1100, margin: '0 auto',
        }}>
          <SectionHeader eyebrow="Letters from our brides" title="Said of the atelier" />

          <div style={{
            marginTop: 64,
            display: 'flex', flexDirection: 'column', gap: 56,
          }}>
            {reviews.slice(0, 4).map((r, i) => (
              <figure key={i} style={{
                margin: 0, paddingLeft: i % 2 === 0 ? 0 : 'clamp(0px, 4vw, 80px)',
                paddingRight: i % 2 === 0 ? 'clamp(0px, 4vw, 80px)' : 0,
              }}>
                <div className="couture-display" aria-hidden="true" style={{
                  fontSize: 96, color: accent, lineHeight: 0.6,
                  marginBottom: -18, opacity: 0.4,
                }}>
                  “
                </div>
                <blockquote className="couture-serif-i" style={{
                  margin: 0, fontStyle: 'italic', fontWeight: 300,
                  fontSize: 'clamp(20px, 2.4vw, 30px)',
                  lineHeight: 1.4,
                  color: D.ink,
                  letterSpacing: '0.005em',
                }}>
                  {r.comment}
                </blockquote>
                <figcaption style={{
                  marginTop: 24,
                  display: 'flex', alignItems: 'center', gap: 14,
                  fontFamily: D.sans, fontSize: 12, color: D.inkLight,
                  letterSpacing: '0.18em', textTransform: 'uppercase',
                }}>
                  <span aria-hidden="true" style={{ width: 32, height: 1, background: accent, opacity: 0.5 }}/>
                  <span>{r.client_first_name}</span>
                  {r.submitted_at && (
                    <>
                      <span aria-hidden="true" style={{ color: D.inkHair }}>·</span>
                      <span>{fmtMonth(r.submitted_at)}</span>
                    </>
                  )}
                </figcaption>
              </figure>
            ))}
          </div>
        </section>
      )}

      {/* ───────── CTA — book a consultation ───────── */}
      <section style={{
        padding: 'clamp(80px, 10vw, 140px) clamp(24px, 6vw, 96px)',
        maxWidth: 760, margin: '0 auto',
        textAlign: 'center',
      }}>
        <OrnamentRule width={56} color={accent}/>
        <h2 className="couture-display" style={{
          fontSize: 'clamp(40px, 5.5vw, 64px)',
          color: D.ink, margin: '28px 0 0',
          fontWeight: 400, lineHeight: 1.05,
          letterSpacing: '-0.005em',
        }}>
          When you are<br/>
          <span className="couture-serif-i" style={{ color: accent, fontStyle: 'italic' }}>
            ready,
          </span>{' '}
          we are.
        </h2>
        <p style={{
          fontFamily: D.serif, fontStyle: 'italic',
          fontSize: 'clamp(15px, 1.4vw, 18px)',
          color: D.inkMid, lineHeight: 1.7,
          maxWidth: 460, margin: '24px auto 36px', fontWeight: 300,
        }}>
          Tell us about your event and we'll be in touch within twenty-four hours.
          No commitment, no pressure — just a conversation.
        </p>
        <Link to={`/book/${boutique.slug}`} style={{
          display: 'inline-block',
          background: D.ink, color: D.cardWarm,
          padding: '18px 44px',
          fontFamily: D.sans, fontSize: 11,
          textTransform: 'uppercase', letterSpacing: '0.24em', fontWeight: 500,
          textDecoration: 'none',
          transition: `background 0.25s ${D.ease}, transform 0.1s ${D.ease}`,
        }}
          onMouseEnter={e => { e.currentTarget.style.background = accent }}
          onMouseLeave={e => { e.currentTarget.style.background = D.ink }}
        >
          Schedule a fitting
        </Link>
      </section>

      {/* ───────── FOOTER — colophon ───────── */}
      <footer style={{
        padding: '48px clamp(24px, 6vw, 96px)',
        borderTop: `1px solid ${D.inkHair}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap', gap: 16,
        background: D.cardWarm,
      }}>
        <div className="couture-smallcaps" style={{ color: D.inkLight, letterSpacing: '0.32em' }}>
          {boutique.name}
        </div>
        <div className="couture-smallcaps" style={{ color: D.inkMute, letterSpacing: '0.3em' }}>
          Powered by{' '}
          <Link to="/" className="couture-link" style={{ color: D.inkLight }}>
            Belori
          </Link>
        </div>
      </footer>
    </div>
  )
}

// ─── Small components ───────────────────────────────────────────────────────
function MastheadField({ label, value, href, external }) {
  const inner = (
    <>
      <div className="couture-smallcaps" style={{ color: D.inkLight, marginBottom: 4 }}>
        {label}
      </div>
      <div style={{
        fontFamily: D.serif, fontSize: 15, color: D.ink,
        lineHeight: 1.5,
        wordBreak: 'break-word',
      }}>
        {value}
      </div>
    </>
  )
  if (href) {
    return (
      <a href={href}
        target={external ? '_blank' : undefined}
        rel={external ? 'noopener noreferrer' : undefined}
        style={{ textDecoration: 'none', color: 'inherit' }}
        onMouseEnter={e => { e.currentTarget.querySelector('div:nth-child(2)').style.color = D.goldDark }}
        onMouseLeave={e => { e.currentTarget.querySelector('div:nth-child(2)').style.color = D.ink }}
      >
        {inner}
      </a>
    )
  }
  return <div>{inner}</div>
}

function SectionHeader({ eyebrow, title }) {
  return (
    <div>
      <div className="couture-smallcaps" style={{ color: D.gold, letterSpacing: '0.32em' }}>
        {eyebrow}
      </div>
      <h2 className="couture-display" style={{
        fontSize: 'clamp(40px, 5vw, 60px)',
        color: D.ink, margin: '14px 0 0',
        fontWeight: 400, lineHeight: 1, letterSpacing: '-0.005em',
      }}>
        {title}
      </h2>
      <OrnamentRule width={36} style={{ marginTop: 18, marginLeft: 0, justifyContent: 'flex-start' }} />
    </div>
  )
}

function setMeta(key, value, attr = 'name') {
  if (typeof document === 'undefined') return
  let tag = document.querySelector(`meta[${attr}="${key}"]`)
  if (!tag) {
    tag = document.createElement('meta')
    tag.setAttribute(attr, key)
    document.head.appendChild(tag)
  }
  tag.setAttribute('content', value)
}
