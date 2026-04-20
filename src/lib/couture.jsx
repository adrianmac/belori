// ─── COUTURE ATELIER — Shared design tokens ─────────────────────────────────
// One canonical source of luxury editorial tokens used across Login, Signup,
// Dashboard, Sidebar, and any page that opts into the refined aesthetic.
// Import as:  import { D, injectCoutureFonts } from '../lib/couture'

export const D = {
  // Canvas
  bg:         '#F8F4F0',   // warm ivory — the "page"
  bgDeep:     '#F1EBE4',   // a shade deeper for section bands
  card:       '#FFFFFF',
  cardWarm:   '#FEFBF7',   // warm-white card — off the sterile pure white
  // Champagne gold — primary accent (luxury, warm, editorial)
  gold:       '#B08A4E',
  goldDark:   '#8E6B34',
  goldLight:  '#FBF5E9',
  goldBorder: '#E8D9B8',
  goldFoil:   '#D4AF7A',   // lighter foil tone for ornaments
  // Dusty rose — secondary accent (heritage nod to bridal domain)
  rose:       '#C06070',
  roseDark:   '#A04A58',
  roseLight:  '#FDF0F2',
  roseBorder: '#EDCDD2',
  // Ink hierarchy — never pure black; warm plum-brown for the atelier feel.
  // Contrast checks on #F8F4F0 ivory:
  //   ink      #1C1118 — 15.8:1  AAA
  //   inkMid   #5C4A52 —  7.8:1  AAA
  //   inkLight #7A6670 —  4.7:1  AA   (was #9C8A92 @ 3.1:1 — failed AA)
  //   inkMute  #9C8A92 —  3.1:1  decorative only (never body copy)
  //   inkHair  #C9BFB8 —  2.0:1  rules / dividers only
  ink:        '#1C1118',
  inkMid:     '#5C4A52',
  inkLight:   '#7A6670',
  inkMute:    '#9C8A92',
  inkHair:    '#C9BFB8',
  // Neutral support
  border:     '#EDE7E2',
  borderSoft: '#F2EDE8',
  // Semantics — restrained, never neon
  success:    '#5C8A6E',
  successBg:  '#E8EFE9',
  warning:    '#B07A2E',
  warningBg:  '#FBF2E3',
  danger:     '#A34454',
  dangerBg:   '#F7E6E9',
  // Typography stacks
  display:    "'Italiana', 'Didot', 'Bodoni 72', serif",        // very high contrast
  serif:      "'Cormorant Garamond', 'Didot', Georgia, serif",
  sans:       "'DM Sans', 'Inter', system-ui, sans-serif",
  // Shadow ladder — ink-tinted, never flat black
  shadow:     '0 1px 4px rgba(28,17,24,0.06)',
  shadowMd:   '0 4px 16px rgba(28,17,24,0.09)',
  shadowLg:   '0 12px 40px rgba(28,17,24,0.12)',
  shadowXl:   '0 28px 80px -12px rgba(28,17,24,0.22)',
  // Motion
  ease:       'cubic-bezier(0.22, 0.61, 0.36, 1)',
}

// ─── FORCE LIGHT THEME ON AUTH SURFACES ─────────────────────────────────────
// Login / Signup / Onboarding / JoinInvite are deliberately light-only (the
// couture editorial palette). If a user's OS is dark and they previously
// visited the app (persisting data-theme="dark" to localStorage), we want
// these splash surfaces to still render correctly.
//
// Usage:  useEffect(() => forceLightTheme(), [])
//
// Note: no cleanup — we want the light theme to persist across the auth flow.
// Once the user reaches the app shell, applyTheme(getTheme()) in main.jsx
// reasserts their preference.
export function forceLightTheme() {
  if (typeof document === 'undefined') return
  document.documentElement.setAttribute('data-theme', 'light')
}

// ─── FONT LOADER (idempotent) ────────────────────────────────────────────────
// Injects Google Fonts + utility CSS once, regardless of how many components
// call this. Safe to invoke on every render.
let _fontsInjected = false
export function injectCoutureFonts() {
  if (_fontsInjected || typeof document === 'undefined') return
  _fontsInjected = true
  // Preconnect
  const pc1 = document.createElement('link')
  pc1.rel = 'preconnect'; pc1.href = 'https://fonts.googleapis.com'
  document.head.appendChild(pc1)
  const pc2 = document.createElement('link')
  pc2.rel = 'preconnect'; pc2.href = 'https://fonts.gstatic.com'; pc2.crossOrigin = ''
  document.head.appendChild(pc2)
  // Fonts
  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href =
    'https://fonts.googleapis.com/css2?' +
    'family=Italiana&' +
    'family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;1,300;1,400;1,500&' +
    'family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600;9..40,700&' +
    'display=swap'
  document.head.appendChild(link)
  // Utility CSS — used across all couture surfaces
  const style = document.createElement('style')
  style.id = 'couture-theme-style'
  style.textContent = `
    .couture-display { font-family: ${D.display}; letter-spacing: 0.01em; font-weight: 400; }
    .couture-serif   { font-family: ${D.serif}; }
    .couture-serif-i { font-family: ${D.serif}; font-style: italic; font-weight: 400; }
    .couture-sans    { font-family: ${D.sans}; }
    .couture-smallcaps {
      font-family: ${D.sans}; text-transform: uppercase;
      letter-spacing: 0.18em; font-size: 10px; font-weight: 500;
    }
    .couture-numeral {
      font-family: ${D.display}; letter-spacing: -0.01em;
      font-variant-numeric: lining-nums tabular-nums;
    }
    .couture-input:focus {
      border-color: ${D.ink} !important;
      box-shadow: 0 0 0 3px ${D.goldLight};
    }
    .couture-primary-btn:hover:not(:disabled) {
      background: ${D.goldDark};
      transform: translateY(-1px);
    }
    .couture-primary-btn:active:not(:disabled) { transform: translateY(0); }
    .couture-primary-btn:disabled { opacity: 0.55; cursor: not-allowed; }
    .couture-ghost-btn:hover:not(:disabled) {
      background: ${D.ink};
      color: ${D.cardWarm};
    }
    .couture-link {
      color: ${D.ink};
      text-decoration: none;
      position: relative;
      transition: color 0.2s ${D.ease};
    }
    .couture-link::after {
      content: ''; position: absolute; left: 0; right: 0; bottom: -2px;
      height: 1px; background: ${D.gold};
      transform: scaleX(0.55); transform-origin: left;
      transition: transform 0.3s ${D.ease};
    }
    .couture-link:hover { color: ${D.goldDark}; }
    .couture-link:hover::after { transform: scaleX(1); }
    @keyframes coutureFadeUp {
      from { opacity: 0; transform: translateY(14px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes coutureGoldShimmer {
      0%   { background-position: -200% 0; }
      100% { background-position: 200% 0; }
    }
    .couture-fade-up { animation: coutureFadeUp 0.7s ${D.ease} both; }
    .couture-fade-up-1 { animation-delay: 0.08s; }
    .couture-fade-up-2 { animation-delay: 0.16s; }
    .couture-fade-up-3 { animation-delay: 0.24s; }
    .couture-fade-up-4 { animation-delay: 0.32s; }
    .couture-fade-up-5 { animation-delay: 0.40s; }
    .couture-fade-up-6 { animation-delay: 0.48s; }
    /* Grain texture — applied as ::before on any container */
    .couture-grain { position: relative; isolation: isolate; }
    .couture-grain::before {
      content: ''; position: absolute; inset: 0; pointer-events: none; z-index: 0;
      opacity: 0.35; mix-blend-mode: multiply;
      background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.11 0 0 0 0 0.07 0 0 0 0 0.09 0 0 0 0.08 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>");
    }
    .couture-grain > * { position: relative; z-index: 1; }
  `
  document.head.appendChild(style)
}

// ─── STYLE HELPERS ───────────────────────────────────────────────────────────
export const coutureInput = {
  width: '100%',
  padding: '12px 14px',
  background: D.cardWarm,
  border: `1px solid ${D.border}`,
  borderRadius: 2,          // sharp couture edges, not rounded SaaS
  fontSize: 14,
  fontFamily: D.sans,
  color: D.ink,
  outline: 'none',
  boxSizing: 'border-box',
  transition: `border-color 0.2s ${D.ease}, box-shadow 0.2s ${D.ease}`,
}

export const couturePrimaryBtn = {
  background: D.gold,
  color: D.cardWarm,
  border: 'none',
  borderRadius: 2,
  padding: '14px 22px',
  fontSize: 11,
  fontFamily: D.sans,
  fontWeight: 500,
  letterSpacing: '0.18em',
  textTransform: 'uppercase',
  cursor: 'pointer',
  transition: `background 0.25s ${D.ease}, transform 0.1s ${D.ease}`,
  width: '100%',
}

export const coutureGhostBtn = {
  background: 'transparent',
  color: D.ink,
  border: `1px solid ${D.ink}`,
  borderRadius: 2,
  padding: '13px 22px',
  fontSize: 11,
  fontFamily: D.sans,
  fontWeight: 500,
  letterSpacing: '0.18em',
  textTransform: 'uppercase',
  cursor: 'pointer',
  transition: `all 0.25s ${D.ease}`,
}

export const coutureLabel = {
  fontFamily: D.sans,
  fontSize: 10,
  fontWeight: 500,
  color: D.inkMid,
  textTransform: 'uppercase',
  letterSpacing: '0.18em',
  marginBottom: 8,
  display: 'block',
}

// ─── ORNAMENT — small diamond flanked by gold hairlines ─────────────────────
export function OrnamentRule({ width = 120, color, style }) {
  const c = color || D.gold
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      width: '100%', gap: 10, ...style,
    }} aria-hidden="true">
      <span style={{ height: 1, width, background: `linear-gradient(90deg, transparent, ${c} 40%, ${c})`, opacity: 0.5 }} />
      <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ flexShrink: 0 }}>
        <path d="M5 0l5 5-5 5-5-5 5-5z" fill={c} opacity="0.85" />
      </svg>
      <span style={{ height: 1, width, background: `linear-gradient(270deg, transparent, ${c} 40%, ${c})`, opacity: 0.5 }} />
    </div>
  )
}

// ─── WORDMARK — Italiana "Belori" with optional tagline ─────────────────────
export function Wordmark({ size = 36, tagline, color, inline = false }) {
  const c = color || D.ink
  return (
    <div style={{
      display: 'inline-flex', flexDirection: 'column', alignItems: 'center',
      gap: 6, lineHeight: 1,
    }}>
      <div className="couture-display" style={{
        fontSize: size, color: c, lineHeight: 1,
        fontFamily: D.display,
      }}>
        Belori
      </div>
      {tagline && (
        <div className="couture-smallcaps" style={{
          color: inline ? D.inkLight : D.inkMid,
          fontSize: 9, letterSpacing: '0.3em',
        }}>
          {tagline}
        </div>
      )}
    </div>
  )
}
