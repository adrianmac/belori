import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useParams } from 'react-router-dom'

const FONT = '-apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", sans-serif'
const SERIF = '"Playfair Display", Georgia, serif'

const C = {
  rosa:     '#C9697A',
  rosaPale: '#FDF2F4',
  rosaText: '#8B3A4A',
  ink:      '#1C1012',
  gray:     '#6B7280',
  white:    '#FFFFFF',
  border:   '#E5E7EB',
}

const SERVICES = [
  { icon: '👗', label: 'Bridal Gowns',       desc: 'Curated selection of designer bridal gowns for every style and budget.' },
  { icon: '👑', label: 'Quinceañera Gowns',  desc: 'Stunning gowns for your quinceañera celebration.' },
  { icon: '✂️', label: 'Alterations',         desc: 'Expert tailoring and alterations for a perfect fit.' },
  { icon: '💐', label: 'Event Planning',      desc: 'Full-service planning to make your special day unforgettable.' },
  { icon: '🎀', label: 'Accessories',         desc: 'Veils, tiaras, jewelry, and everything to complete your look.' },
  { icon: '📸', label: 'Photo Packages',      desc: 'Professional photography to capture every precious moment.' },
]

function starsFromScore(score) {
  // NPS is 0-10; map to 1-5 stars
  return Math.round((score / 10) * 4 + 1)
}

function StarDisplay({ stars, size = 16 }) {
  return (
    <span style={{ display: 'inline-flex', gap: 2 }}>
      {[1, 2, 3, 4, 5].map(i => (
        <span key={i} style={{ fontSize: size, color: i <= stars ? '#F59E0B' : '#E5E7EB', lineHeight: 1 }}>★</span>
      ))}
    </span>
  )
}

function fmtDate(d) {
  if (!d) return ''
  return new Date(d).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

export default function BoutiqueProfilePage() {
  const { slug } = useParams()
  const [boutique, setBoutique]   = useState(null)
  const [loading, setLoading]     = useState(true)
  const [npsData, setNpsData]     = useState([])
  const [activeTab, setActiveTab] = useState('about')

  useEffect(() => {
    if (!slug) { setLoading(false); return }
    supabase
      .from('boutiques')
      .select('id,name,email,phone,address,instagram,booking_url,plan,subscription_status,slug')
      .or(`slug.eq.${slug},id.eq.${slug}`)
      .single()
      .then(({ data }) => {
        setBoutique(data)
        if (data) {
          supabase
            .from('nps_responses')
            .select('score,comment,submitted_at')
            .eq('boutique_id', data.id)
            .gte('score', 8)
            .order('submitted_at', { ascending: false })
            .limit(10)
            .then(({ data: reviews }) => setNpsData(reviews || []))
        }
        setLoading(false)
      })
  }, [slug])

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', fontFamily: FONT, background: C.rosaPale }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>✿</div>
          <div style={{ fontSize: 14, color: C.gray }}>Loading…</div>
        </div>
      </div>
    )
  }

  if (!boutique) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', fontFamily: FONT, flexDirection: 'column', gap: 16, background: C.rosaPale }}>
        <div style={{ fontSize: 48, fontFamily: SERIF, color: C.rosa, fontWeight: 400 }}>404</div>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: C.ink }}>Boutique not found</h2>
        <p style={{ margin: 0, fontSize: 14, color: C.gray }}>This boutique page doesn't exist or has been removed.</p>
        <a href="/" style={{ fontSize: 14, color: C.rosaText, textDecoration: 'none', fontWeight: 500 }}>← Back to home</a>
      </div>
    )
  }

  const bookingHref = boutique.booking_url || (boutique.slug ? `/book/${boutique.slug}` : null)

  const avgStars = npsData.length > 0
    ? (npsData.reduce((sum, r) => sum + starsFromScore(r.score), 0) / npsData.length).toFixed(1)
    : null

  const TABS = [
    { id: 'about',    label: 'About' },
    { id: 'services', label: 'Services' },
    ...(npsData.length > 0 ? [{ id: 'reviews', label: `Reviews (${npsData.length})` }] : []),
    { id: 'contact',  label: 'Contact' },
  ]

  return (
    <div style={{ minHeight: '100vh', background: '#F8F4F0', fontFamily: FONT }}>

      {/* ── Hero ───────────────────────────────────────────────────── */}
      <div style={{
        background: `linear-gradient(135deg, ${C.rosa} 0%, #B05570 60%, #8B3A55 100%)`,
        padding: '60px 24px 48px',
        textAlign: 'center',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Decorative circles */}
        <div style={{ position: 'absolute', top: -40, right: -40, width: 180, height: 180, borderRadius: '50%', background: 'rgba(255,255,255,0.06)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: -30, left: -30, width: 130, height: 130, borderRadius: '50%', background: 'rgba(255,255,255,0.05)', pointerEvents: 'none' }} />

        <div style={{ maxWidth: 700, margin: '0 auto', position: 'relative' }}>
          {/* Logo circle */}
          <div style={{
            width: 80, height: 80, borderRadius: '50%', background: 'rgba(255,255,255,0.18)',
            border: '2px solid rgba(255,255,255,0.4)', display: 'flex', alignItems: 'center',
            justifyContent: 'center', margin: '0 auto 20px', fontSize: 32,
          }}>
            💍
          </div>

          <h1 style={{ margin: '0 0 8px', fontSize: 36, fontFamily: SERIF, fontWeight: 700, color: C.white, lineHeight: 1.2 }}>
            {boutique.name}
          </h1>
          <p style={{ margin: '0 0 24px', fontSize: 16, color: 'rgba(255,255,255,0.85)', fontStyle: 'italic' }}>
            Making your special day perfect
          </p>

          {/* Contact quick links */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center', marginBottom: 28 }}>
            {boutique.phone && (
              <a href={`tel:${boutique.phone}`} style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '7px 16px', borderRadius: 20, background: 'rgba(255,255,255,0.18)',
                color: C.white, textDecoration: 'none', fontSize: 13, fontWeight: 500,
                border: '1px solid rgba(255,255,255,0.3)',
              }}>
                📞 {boutique.phone}
              </a>
            )}
            {boutique.email && (
              <a href={`mailto:${boutique.email}`} style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '7px 16px', borderRadius: 20, background: 'rgba(255,255,255,0.18)',
                color: C.white, textDecoration: 'none', fontSize: 13, fontWeight: 500,
                border: '1px solid rgba(255,255,255,0.3)',
              }}>
                ✉️ {boutique.email}
              </a>
            )}
            {boutique.instagram && (
              <a href={`https://instagram.com/${boutique.instagram.replace('@', '')}`} target="_blank" rel="noopener noreferrer" style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '7px 16px', borderRadius: 20, background: 'rgba(255,255,255,0.18)',
                color: C.white, textDecoration: 'none', fontSize: 13, fontWeight: 500,
                border: '1px solid rgba(255,255,255,0.3)',
              }}>
                📷 {boutique.instagram.startsWith('@') ? boutique.instagram : `@${boutique.instagram}`}
              </a>
            )}
          </div>

          {bookingHref && (
            <a href={bookingHref} style={{
              display: 'inline-block', padding: '13px 32px',
              background: C.white, color: C.rosaText,
              borderRadius: 10, fontSize: 15, fontWeight: 700,
              textDecoration: 'none', letterSpacing: 0.3,
              boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
            }}>
              Book a consultation →
            </a>
          )}

          {avgStars && (
            <div style={{ marginTop: 20, display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
              <StarDisplay stars={Math.round(Number(avgStars))} size={18} />
              <span style={{ color: 'rgba(255,255,255,0.9)', fontSize: 14, fontWeight: 600 }}>{avgStars} / 5</span>
              <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13 }}>· {npsData.length} happy client{npsData.length !== 1 ? 's' : ''}</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Tab nav ─────────────────────────────────────────────────── */}
      <div style={{ background: C.white, borderBottom: `1px solid ${C.border}`, position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ maxWidth: 900, margin: '0 auto', display: 'flex', gap: 0, overflowX: 'auto' }}>
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '14px 20px', border: 'none', background: 'none',
                fontSize: 14, fontWeight: activeTab === tab.id ? 600 : 400,
                color: activeTab === tab.id ? C.rosaText : C.gray,
                borderBottom: activeTab === tab.id ? `2px solid ${C.rosa}` : '2px solid transparent',
                cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: FONT,
                transition: 'color 0.15s',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Content ─────────────────────────────────────────────────── */}
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '32px 20px 64px' }}>

        {/* About tab */}
        {activeTab === 'about' && (
          <div>
            <div style={{
              background: C.white, borderRadius: 16, padding: '28px 32px',
              boxShadow: '0 2px 16px rgba(0,0,0,0.06)', marginBottom: 20,
            }}>
              <h2 style={{ margin: '0 0 12px', fontSize: 20, fontFamily: SERIF, fontWeight: 700, color: C.ink }}>
                Welcome to {boutique.name}
              </h2>
              <p style={{ margin: '0 0 20px', fontSize: 14, color: C.gray, lineHeight: 1.7 }}>
                We are a full-service bridal boutique dedicated to making every bride and quinceañera feel
                extraordinary. From gorgeous gowns to flawless alterations and complete event planning,
                our experienced team is here to guide you through every step of your journey.
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                {[
                  'Personalized consultations',
                  'Expert alterations team',
                  'Curated gown collection',
                  'Event planning support',
                ].map(item => (
                  <div key={item} style={{
                    padding: '6px 14px', borderRadius: 20,
                    background: C.rosaPale, color: C.rosaText,
                    fontSize: 12, fontWeight: 500,
                  }}>
                    ✓ {item}
                  </div>
                ))}
              </div>
            </div>

            {/* Mini services preview */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 14 }}>
              {SERVICES.slice(0, 3).map(svc => (
                <div key={svc.label} style={{
                  background: C.white, borderRadius: 12, padding: '20px 20px',
                  boxShadow: '0 2px 10px rgba(0,0,0,0.05)',
                  display: 'flex', alignItems: 'flex-start', gap: 14,
                }}>
                  <div style={{ fontSize: 28, flexShrink: 0, lineHeight: 1 }}>{svc.icon}</div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: C.ink, marginBottom: 4 }}>{svc.label}</div>
                    <div style={{ fontSize: 12, color: C.gray, lineHeight: 1.5 }}>{svc.desc}</div>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ marginTop: 16, textAlign: 'center' }}>
              <button onClick={() => setActiveTab('services')} style={{
                background: 'none', border: 'none', color: C.rosaText, fontSize: 13,
                fontWeight: 600, cursor: 'pointer', fontFamily: FONT,
              }}>
                View all services →
              </button>
            </div>
          </div>
        )}

        {/* Services tab */}
        {activeTab === 'services' && (
          <div>
            <h2 style={{ margin: '0 0 20px', fontSize: 22, fontFamily: SERIF, fontWeight: 700, color: C.ink }}>
              Our Services
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
              {SERVICES.map(svc => (
                <div key={svc.label} style={{
                  background: C.white, borderRadius: 14, padding: '24px 22px',
                  boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
                  border: `1px solid ${C.border}`,
                  transition: 'box-shadow 0.15s, transform 0.15s',
                }}>
                  <div style={{ fontSize: 36, marginBottom: 14, lineHeight: 1 }}>{svc.icon}</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: C.ink, marginBottom: 8 }}>{svc.label}</div>
                  <div style={{ fontSize: 13, color: C.gray, lineHeight: 1.6 }}>{svc.desc}</div>
                </div>
              ))}
            </div>
            {bookingHref && (
              <div style={{ marginTop: 32, textAlign: 'center' }}>
                <a href={bookingHref} style={{
                  display: 'inline-block', padding: '13px 32px',
                  background: C.rosa, color: C.white,
                  borderRadius: 10, fontSize: 15, fontWeight: 700,
                  textDecoration: 'none', letterSpacing: 0.3,
                }}>
                  Book a consultation →
                </a>
              </div>
            )}
          </div>
        )}

        {/* Reviews tab */}
        {activeTab === 'reviews' && npsData.length > 0 && (
          <div>
            {/* Summary */}
            <div style={{
              background: C.white, borderRadius: 14, padding: '24px 28px',
              boxShadow: '0 2px 12px rgba(0,0,0,0.06)', marginBottom: 24,
              display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap',
            }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 48, fontWeight: 700, color: C.ink, lineHeight: 1, fontFamily: SERIF }}>{avgStars}</div>
                <div style={{ marginTop: 6 }}><StarDisplay stars={Math.round(Number(avgStars))} size={20} /></div>
                <div style={{ fontSize: 12, color: C.gray, marginTop: 4 }}>out of 5 stars</div>
              </div>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontSize: 16, fontWeight: 600, color: C.ink, marginBottom: 4 }}>
                  {npsData.length} happy client{npsData.length !== 1 ? 's' : ''}
                </div>
                <div style={{ fontSize: 13, color: C.gray, lineHeight: 1.5 }}>
                  Based on verified reviews from our clients. We're proud of every smile we create.
                </div>
              </div>
            </div>

            {/* Individual reviews */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {npsData.map((r, i) => (
                <div key={i} style={{
                  background: C.white, borderRadius: 12, padding: '20px 22px',
                  boxShadow: '0 2px 10px rgba(0,0,0,0.05)', border: `1px solid ${C.border}`,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                    <StarDisplay stars={starsFromScore(r.score)} size={16} />
                    <span style={{ fontSize: 12, color: C.gray }}>{fmtDate(r.submitted_at)}</span>
                  </div>
                  {r.comment && (
                    <p style={{ margin: 0, fontSize: 14, color: C.ink, lineHeight: 1.65, fontStyle: 'italic' }}>
                      "{r.comment}"
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Contact tab */}
        {activeTab === 'contact' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>

            {/* Contact info card */}
            <div style={{
              background: C.white, borderRadius: 14, padding: '24px 22px',
              boxShadow: '0 2px 12px rgba(0,0,0,0.06)', border: `1px solid ${C.border}`,
            }}>
              <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700, color: C.ink }}>Contact Information</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {boutique.phone && (
                  <a href={`tel:${boutique.phone}`} style={{ display: 'flex', alignItems: 'center', gap: 10, color: C.ink, textDecoration: 'none', fontSize: 14 }}>
                    <span style={{ fontSize: 18 }}>📞</span>
                    <span>{boutique.phone}</span>
                  </a>
                )}
                {boutique.email && (
                  <a href={`mailto:${boutique.email}`} style={{ display: 'flex', alignItems: 'center', gap: 10, color: C.ink, textDecoration: 'none', fontSize: 14 }}>
                    <span style={{ fontSize: 18 }}>✉️</span>
                    <span>{boutique.email}</span>
                  </a>
                )}
                {boutique.instagram && (
                  <a href={`https://instagram.com/${boutique.instagram.replace('@', '')}`} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 10, color: C.ink, textDecoration: 'none', fontSize: 14 }}>
                    <span style={{ fontSize: 18 }}>📷</span>
                    <span>{boutique.instagram.startsWith('@') ? boutique.instagram : `@${boutique.instagram}`}</span>
                  </a>
                )}
                {boutique.address && (
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 14, color: C.ink }}>
                    <span style={{ fontSize: 18, flexShrink: 0 }}>📍</span>
                    <span style={{ lineHeight: 1.5 }}>{boutique.address}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Map / booking card */}
            <div style={{
              background: C.white, borderRadius: 14, padding: '24px 22px',
              boxShadow: '0 2px 12px rgba(0,0,0,0.06)', border: `1px solid ${C.border}`,
            }}>
              <h3 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 700, color: C.ink }}>Visit Us</h3>
              {boutique.address ? (
                <>
                  <div style={{ fontSize: 13, color: C.gray, marginBottom: 14, lineHeight: 1.5 }}>{boutique.address}</div>
                  <a
                    href={`https://maps.google.com/?q=${encodeURIComponent(boutique.address)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                      padding: '9px 18px', borderRadius: 8, background: C.rosaPale,
                      color: C.rosaText, textDecoration: 'none', fontSize: 13, fontWeight: 600,
                    }}
                  >
                    🗺️ Open in Google Maps
                  </a>
                </>
              ) : (
                <div style={{ fontSize: 13, color: C.gray }}>Contact us for our address and directions.</div>
              )}
              {bookingHref && (
                <div style={{ marginTop: 20 }}>
                  <a href={bookingHref} style={{
                    display: 'inline-block', padding: '10px 22px',
                    background: C.rosa, color: C.white,
                    borderRadius: 8, fontSize: 13, fontWeight: 700,
                    textDecoration: 'none',
                  }}>
                    Book a consultation →
                  </a>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Footer ─────────────────────────────────────────────────── */}
      <div style={{
        borderTop: `1px solid ${C.border}`, background: C.white,
        padding: '20px 24px', textAlign: 'center',
      }}>
        <div style={{ fontSize: 12, color: C.gray }}>
          Powered by{' '}
          <a href="https://belori.app" target="_blank" rel="noopener noreferrer" style={{ color: C.rosaText, textDecoration: 'none', fontWeight: 600 }}>
            Belori
          </a>
          {' '}· Bridal boutique management platform
        </div>
      </div>
    </div>
  )
}
