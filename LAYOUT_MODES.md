# LAYOUT_MODES.md — Belori Desktop & Tablet Layout Modes

> **Purpose:** This file defines the two layout modes in Belori — Desktop and Tablet/Touch — including how they differ, how to implement the mode switcher, all per-mode component variants, CSS token overrides, and the persistence mechanism. Paste alongside UI_UX.md and TECH_STACK.md when building the layout system.

---

## Overview

Belori operates in two distinct layout modes:

**Desktop mode** — optimized for mouse and keyboard. Compact sidebar with text labels, dense information layout, hover states, small precise buttons. Staff at a desktop or laptop use this.

**Tablet / Touch mode** — optimized for touchscreens. Icon-only sidebar rail, large 48px minimum tap targets, no hover states (replaced by press/active states), bigger typography, expanded card rows, simplified quick-action grid. Staff on the boutique floor using an iPad, Surface, or touchscreen monitor use this.

The user switches between modes via a persistent toggle in the Settings page or via a floating mode button. The selected mode is saved per-user and remembered across sessions.

---

## What Changes Between Modes

### Sidebar

| Element | Desktop | Tablet |
|---------|---------|--------|
| Width | 210px | 72px |
| Nav labels | Visible (12px text) | Hidden (icon only) |
| Nav item height | 36px | 64px |
| Nav icon size | 14×14px | 22×22px |
| Section dividers | Visible text labels | Hidden |
| Boutique name | Visible | Hidden |
| User avatar | 28px + name + role | 40px avatar only |
| Badge position | Right of label | Top-right corner of icon |

### Topbar

| Element | Desktop | Tablet |
|---------|---------|--------|
| Height | 48px | 60px |
| Page title size | 14px | 17px |
| Page subtitle | Same line | Below title |
| Primary button height | 36px | 48px |
| Primary button font | 11px | 13px |
| Icon buttons | Not shown | 48×48px icon buttons |
| Search | Inline (desktop) | Icon button → expands |

### Alert bar

| Element | Desktop | Tablet |
|---------|---------|--------|
| Height | ~32px (auto) | ~48px (auto) |
| Text size | 10px | 12px |
| Action | Text link ("Act now →") | Full button (48px height) |
| Max message length | Full sentence | Shortened to key info |

### Stat strip

| Element | Desktop | Tablet |
|---------|---------|--------|
| Columns | 4 equal | 2 columns, 2 rows |
| Stat number size | 18px | 22px |
| Icon | None | Category icon (44px bg) |
| Padding | 10px 16px | 14px 16px |
| Card style | Flat number + label | Icon + number + label |

### Buttons

| Type | Desktop height | Tablet height | Font |
|------|--------------|--------------|------|
| Primary | 36px | 48px | 11px → 13px |
| Ghost / secondary | 32px | 44px | 11px → 13px |
| Icon button | 32×32px | 48×48px | — |
| Inline row action | 28px | 40px | 10px → 12px |
| Card header action | 28px | 40px | 10px → 12px |
| Full-width CTA | 44px | 56px | 14px → 16px |

### Table rows / list items

| Element | Desktop | Tablet |
|---------|---------|--------|
| Row height | 44px min | 64px min |
| Avatar size | 22px | 36px |
| Primary text | 12px | 13px |
| Secondary text | 10px | 11px |
| Action button | Right-aligned text link | Right-aligned button (40px) |
| Tap area | Row only | Entire row (full width, full height) |

### Typography

| Element | Desktop | Tablet |
|---------|---------|--------|
| Body text | 12–13px | 13–14px |
| Card title | 11–12px | 13–14px |
| Form labels | 11px | 12px |
| Form inputs | 14px | 16px (iOS zoom prevention) |
| Subtitles / meta | 10px | 11px |
| Badge text | 9–10px | 10–11px |

### Cards

| Element | Desktop | Tablet |
|---------|---------|--------|
| Border radius | 9px | 12px |
| Card padding | 10px 12px | 13px 16px |
| Card head padding | 9px 12px | 13px 16px |
| Section gap | 10px | 12px |
| Inner row padding | 7px 12px | 13px 16px |

### Quick actions

| Desktop | Tablet |
|---------|--------|
| Ghost buttons stacked in a card | 3-column icon grid with labels |
| Small text labels, no icons | Large icon (44px) + 2-line label |
| Click precise target | Large tap card |

### Layout structure

| Element | Desktop | Tablet |
|---------|---------|--------|
| Dashboard | 2-column (main + right sidebar) | Single column |
| Event detail | 2-column (left 1fr + right 300px) | Single column |
| Inventory grid | 3–4 columns | 2 columns |
| Alterations kanban | 4 columns visible | 2 visible, horizontal scroll |
| Client detail | Sidebar + tabbed content | Stacked (sidebar above, tabs below) |

### Interactions

| Element | Desktop | Tablet |
|---------|---------|--------|
| Hover states | Yes | No |
| Active/press states | Light | Prominent (scale 0.97 + bg shift) |
| Tooltips | Hover tooltips | Long-press or no tooltip |
| Modals | Centered overlay | Bottom sheet |
| Dropdown menus | Click to open | Tap to open, same behavior |
| Drag and drop (kanban) | Mouse drag | Tap → "Move to…" action sheet |

---

## CSS Implementation

### CSS custom properties — mode tokens

Define these at `:root` and override in `[data-mode="tablet"]`:

```css
:root {
  /* Sidebar */
  --sidebar-width: 210px;
  --sidebar-icon-size: 14px;
  --nav-item-height: 36px;
  --nav-label-display: block;
  --nav-badge-position: right; /* conceptual */

  /* Topbar */
  --topbar-height: 48px;
  --topbar-title-size: 14px;
  --topbar-sub-display: inline;

  /* Buttons */
  --btn-height-primary: 36px;
  --btn-height-ghost: 32px;
  --btn-height-icon: 32px;
  --btn-height-row: 28px;
  --btn-font-primary: 11px;
  --btn-font-ghost: 11px;
  --btn-border-radius: 7px;

  /* Typography */
  --text-body: 12px;
  --text-card-title: 11px;
  --text-row-primary: 12px;
  --text-row-secondary: 10px;
  --text-form-label: 11px;
  --text-input: 14px;
  --text-badge: 9px;

  /* Spacing */
  --card-padding: 10px 12px;
  --card-head-padding: 9px 12px;
  --row-padding: 7px 12px;
  --row-min-height: 44px;
  --section-gap: 10px;
  --card-radius: 9px;
  --avatar-size-row: 22px;
  --avatar-font-row: 7px;
  --stat-num-size: 18px;
}

[data-mode="tablet"] {
  /* Sidebar */
  --sidebar-width: 72px;
  --sidebar-icon-size: 22px;
  --nav-item-height: 64px;
  --nav-label-display: block; /* shown below icon */

  /* Topbar */
  --topbar-height: 60px;
  --topbar-title-size: 17px;

  /* Buttons */
  --btn-height-primary: 48px;
  --btn-height-ghost: 44px;
  --btn-height-icon: 48px;
  --btn-height-row: 40px;
  --btn-font-primary: 13px;
  --btn-font-ghost: 13px;
  --btn-border-radius: 10px;

  /* Typography */
  --text-body: 13px;
  --text-card-title: 14px;
  --text-row-primary: 13px;
  --text-row-secondary: 11px;
  --text-form-label: 12px;
  --text-input: 16px; /* CRITICAL: prevents iOS auto-zoom */
  --text-badge: 10px;

  /* Spacing */
  --card-padding: 13px 16px;
  --card-head-padding: 13px 16px;
  --row-padding: 13px 16px;
  --row-min-height: 64px;
  --section-gap: 12px;
  --card-radius: 12px;
  --avatar-size-row: 36px;
  --avatar-font-row: 11px;
  --stat-num-size: 22px;
}
```

### Tailwind class approach (alternative)

If using Tailwind, apply mode via a class on `<body>` or the root layout:

```typescript
// lib/hooks/useLayoutMode.ts
export function useLayoutMode() {
  const [mode, setMode] = useState<'desktop' | 'tablet'>(() => {
    if (typeof window === 'undefined') return 'desktop'
    return (localStorage.getItem('belori_layout_mode') as 'desktop' | 'tablet') || 'desktop'
  })

  const toggle = () => {
    const next = mode === 'desktop' ? 'tablet' : 'desktop'
    setMode(next)
    localStorage.setItem('belori_layout_mode', next)
    document.documentElement.setAttribute('data-mode', next)
  }

  useEffect(() => {
    document.documentElement.setAttribute('data-mode', mode)
  }, [mode])

  return { mode, toggle, isTablet: mode === 'tablet' }
}
```

```typescript
// app/layout.tsx
import { cookies } from 'next/headers'

export default function RootLayout({ children }) {
  const cookieStore = cookies()
  const layoutMode = cookieStore.get('belori_layout_mode')?.value || 'desktop'

  return (
    <html lang="en" data-mode={layoutMode}>
      <body>
        {children}
      </body>
    </html>
  )
}
```

---

## Mode Switcher Component

### Location

The mode switcher appears in two places:
1. **Settings page** — under "Display preferences" as a prominent toggle card
2. **Topbar** (optional, on tablet mode) — as a small icon button that shows the current mode

### Settings page toggle

```tsx
// components/settings/LayoutModeSetting.tsx

export function LayoutModeSetting() {
  const { mode, toggle } = useLayoutMode()

  return (
    <div className="setting-card">
      <div className="setting-head">
        <div className="setting-title">Display mode</div>
        <div className="setting-sub">Choose how Belori looks on your device</div>
      </div>
      <div className="mode-toggle-grid">
        <button
          className={`mode-option ${mode === 'desktop' ? 'active' : ''}`}
          onClick={() => mode !== 'desktop' && toggle()}
        >
          <div className="mode-icon">
            <DesktopIcon />
          </div>
          <div className="mode-label">Desktop</div>
          <div className="mode-desc">
            Compact layout · Mouse & keyboard optimized · Hover states · 
            Dense information · Full sidebar with labels
          </div>
        </button>
        <button
          className={`mode-option ${mode === 'tablet' ? 'active' : ''}`}
          onClick={() => mode !== 'tablet' && toggle()}
        >
          <div className="mode-icon">
            <TabletIcon />
          </div>
          <div className="mode-label">Tablet / Touch</div>
          <div className="mode-desc">
            Large tap targets · 48px buttons · Icon sidebar · 
            Press states · Touch-friendly list rows
          </div>
        </button>
      </div>
      <p className="setting-hint">
        Your preference is saved to this browser. Staff on different devices each set their own.
      </p>
    </div>
  )
}
```

### Mode toggle styles (settings page)

```css
.mode-toggle-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin: 12px 0;
}

.mode-option {
  border: 2px solid var(--border);
  border-radius: 12px;
  padding: 16px;
  cursor: pointer;
  background: #fff;
  text-align: left;
  transition: all 0.15s;
}

.mode-option:hover {
  border-color: var(--rosa-light);
  background: var(--rosa-pale);
}

.mode-option.active {
  border-color: var(--rosa);
  background: var(--rosa-pale);
}

.mode-option .mode-icon {
  width: 48px;
  height: 48px;
  border-radius: 10px;
  background: var(--ivory);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 10px;
}

.mode-option.active .mode-icon {
  background: var(--rosa);
  color: white;
}

.mode-option .mode-label {
  font-size: 14px;
  font-weight: 500;
  color: var(--ink);
  margin-bottom: 4px;
}

.mode-option .mode-desc {
  font-size: 11px;
  color: var(--gray-l);
  line-height: 1.5;
}
```

### Floating mode button (tablet topbar)

In tablet mode, the topbar includes a small mode indicator button that lets staff quickly switch back to desktop:

```tsx
// components/layout/ModeIndicatorButton.tsx
export function ModeIndicatorButton() {
  const { mode, toggle } = useLayoutMode()

  return (
    <button
      onClick={toggle}
      className="mode-indicator-btn"
      title={mode === 'tablet' ? 'Switch to desktop mode' : 'Switch to tablet mode'}
    >
      {mode === 'tablet' ? <DesktopIcon size={18} /> : <TabletIcon size={18} />}
    </button>
  )
}
```

---

## Persistence Mechanism

Mode is saved in three layers (priority order):

1. **Cookie** (server-side) — set on toggle, read in layout.tsx for SSR. Ensures the correct mode is applied before hydration, preventing flash.
2. **localStorage** (client-side) — backup for non-cookie environments.
3. **User database record** — optional for multi-device sync. If user is logged in, their mode preference is saved to `staff.layoutMode` and synced across devices they use.

```typescript
// Server action — save mode preference
export async function saveLayoutModePreference(mode: 'desktop' | 'tablet') {
  const { userId } = auth()
  const cookieStore = cookies()

  // Save to cookie (30-day expiry)
  cookieStore.set('belori_layout_mode', mode, {
    maxAge: 60 * 60 * 24 * 30,
    path: '/',
    sameSite: 'lax',
  })

  // Save to database for this staff member
  if (userId) {
    const staff = await getStaffByClerkUserId(userId)
    if (staff) {
      await db.update(staffMembers)
        .set({ layoutMode: mode })
        .where(eq(staffMembers.id, staff.id))
    }
  }
}
```

```typescript
// Staff table addition
layoutMode: text('layout_mode').default('desktop'),
// 'desktop' | 'tablet'
```

---

## Sidebar Component

The sidebar adapts to mode by reading `data-mode` from the document root:

```tsx
// components/layout/Sidebar.tsx

export function Sidebar() {
  const { mode } = useLayoutMode()
  const pathname = usePathname()

  if (mode === 'tablet') {
    return <TabletSidebar activeRoute={pathname} />
  }
  return <DesktopSidebar activeRoute={pathname} />
}
```

### Desktop sidebar

```tsx
// components/layout/DesktopSidebar.tsx
// Width: 210px
// Shows: logo mark + boutique name, labeled nav items, section headers, user footer

export function DesktopSidebar({ activeRoute }: { activeRoute: string }) {
  return (
    <aside style={{ width: '210px' }} className="sidebar">
      <div className="sb-header">
        <LogoMark size={28} />
        <div>
          <div className="sb-brand">Belori</div>
          <div className="sb-boutique">{boutiqueName}</div>
        </div>
      </div>
      <nav className="sb-nav">
        {NAV_SECTIONS.map(section => (
          <Fragment key={section.label || 'main'}>
            {section.label && <div className="sb-section">{section.label}</div>}
            {section.items.map(item => (
              <NavItem
                key={item.href}
                item={item}
                isActive={activeRoute === item.href}
                mode="desktop"
              />
            ))}
          </Fragment>
        ))}
      </nav>
      <div className="sb-footer">
        <UserAvatar size={28} />
        <div>
          <div className="user-name">{staff.name}</div>
          <div className="user-role">{staff.role}</div>
        </div>
      </div>
    </aside>
  )
}
```

### Tablet sidebar

```tsx
// components/layout/TabletSidebar.tsx
// Width: 72px
// Shows: logo mark only, icon nav (no labels), avatar only

export function TabletSidebar({ activeRoute }: { activeRoute: string }) {
  return (
    <aside style={{ width: '72px' }} className="sidebar tablet-sidebar">
      <div className="sb-header">
        <LogoMark size={28} />
        {/* No boutique name */}
      </div>
      <nav className="sb-nav">
        {ALL_NAV_ITEMS.map(item => (
          <TabletNavItem
            key={item.href}
            item={item}
            isActive={activeRoute === item.href}
          />
        ))}
      </nav>
      <div className="sb-footer">
        <UserAvatar size={40} showTooltip /> {/* Shows name on long press */}
      </div>
    </aside>
  )
}
```

### NavItem component (mode-aware)

```tsx
// components/layout/NavItem.tsx

interface NavItemProps {
  item: NavItemConfig
  isActive: boolean
  mode: 'desktop' | 'tablet'
}

export function NavItem({ item, isActive, mode }: NavItemProps) {
  if (mode === 'tablet') {
    return (
      <Link
        href={item.href}
        className={`t-nav-item ${isActive ? 'active' : ''}`}
        title={item.label} // tooltip on long press
      >
        <item.Icon size={22} />
        <span className="t-nav-label">{item.label}</span>
        {item.badge && (
          <span className={`t-nav-badge t-nb-${item.badge.color}`}>
            {item.badge.value}
          </span>
        )}
      </Link>
    )
  }

  return (
    <Link
      href={item.href}
      className={`d-nav-item ${isActive ? 'active' : ''}`}
    >
      <item.Icon size={14} />
      {item.label}
      {item.badge && (
        <span className={`d-nav-badge d-nb-${item.badge.color}`}>
          {item.badge.value}
        </span>
      )}
    </Link>
  )
}
```

---

## Topbar Component

```tsx
// components/layout/Topbar.tsx

export function Topbar({ title, subtitle, actions }: TopbarProps) {
  const { mode } = useLayoutMode()

  if (mode === 'tablet') {
    return (
      <header className="topbar tablet-topbar">
        <div>
          <h1 className="t-page-title">{title}</h1>
          {subtitle && <p className="t-page-sub">{subtitle}</p>}
        </div>
        <div className="t-tb-right">
          <IconButton icon={SearchIcon} size={48} />
          <IconButton icon={BellIcon} size={48} />
          {actions.map(action =>
            action.isPrimary ? (
              <button key={action.label} className="t-btn t-btn-primary" onClick={action.onClick}>
                <PlusIcon size={18} />
                {action.label}
              </button>
            ) : (
              <button key={action.label} className="t-btn t-btn-ghost" onClick={action.onClick}>
                {action.label}
              </button>
            )
          )}
          <ModeIndicatorButton />
        </div>
      </header>
    )
  }

  return (
    <header className="topbar desktop-topbar">
      <h1 className="d-page-title">{title}</h1>
      {subtitle && <span className="d-page-sub">{subtitle}</span>}
      <div className="d-tb-right">
        {actions.map(action =>
          action.isPrimary ? (
            <button key={action.label} className="d-btn d-btn-primary" onClick={action.onClick}>
              {action.label}
            </button>
          ) : (
            <button key={action.label} className="d-btn d-btn-ghost" onClick={action.onClick}>
              {action.label}
            </button>
          )
        )}
      </div>
    </header>
  )
}
```

---

## Button Component (Mode-Aware)

```tsx
// components/ui/Button.tsx

interface ButtonProps {
  variant: 'primary' | 'ghost' | 'danger' | 'icon'
  size?: 'default' | 'sm' | 'lg'
  children: React.ReactNode
  onClick?: () => void
  icon?: React.ComponentType<{ size: number }>
  fullWidth?: boolean
}

export function Button({ variant, size = 'default', children, onClick, icon: Icon, fullWidth }: ButtonProps) {
  const { mode } = useLayoutMode()
  const isTablet = mode === 'tablet'

  const heights = {
    default: isTablet ? 'h-12' : 'h-9',    // 48px vs 36px
    sm:      isTablet ? 'h-10' : 'h-8',    // 40px vs 32px
    lg:      isTablet ? 'h-14' : 'h-11',   // 56px vs 44px
  }

  const fonts = {
    default: isTablet ? 'text-[13px]' : 'text-[11px]',
    sm:      isTablet ? 'text-[12px]' : 'text-[11px]',
    lg:      isTablet ? 'text-[15px]' : 'text-[13px]',
  }

  const radii = isTablet ? 'rounded-[10px]' : 'rounded-[7px]'
  const padding = isTablet ? 'px-5' : 'px-3'
  const width = fullWidth ? 'w-full' : ''

  const variantClasses = {
    primary: 'bg-[#C9697A] text-white hover:bg-[#B85868]',
    ghost: 'bg-white text-gray-500 border border-[#E5E7EB] hover:bg-[#F8F4F0]',
    danger: 'bg-[#FEE2E2] text-[#B91C1C] border border-[#FCA5A5]',
    icon: `${isTablet ? 'w-12 h-12' : 'w-8 h-8'} border border-[#E5E7EB] bg-white`,
  }

  return (
    <button
      onClick={onClick}
      className={`
        inline-flex items-center justify-center gap-2
        font-medium cursor-pointer transition-all
        active:scale-[0.97]
        touch-action-manipulation
        ${heights[size]} ${fonts[size]} ${radii} ${padding} ${width}
        ${variantClasses[variant]}
      `}
    >
      {Icon && <Icon size={isTablet ? 18 : 14} />}
      {children}
    </button>
  )
}
```

---

## Modal / Bottom Sheet (Mode-Aware)

```tsx
// components/ui/Modal.tsx

export function Modal({ title, children, footer, onClose }: ModalProps) {
  const { mode } = useLayoutMode()

  if (mode === 'tablet') {
    // Bottom sheet on tablet
    return (
      <div className="modal-backdrop" onClick={onClose}>
        <div
          className="bottom-sheet"
          onClick={e => e.stopPropagation()}
        >
          <div className="drag-handle" />
          <div className="bottom-sheet-header">
            <h3 className="sheet-title">{title}</h3>
            <button className="sheet-close" onClick={onClose}>×</button>
          </div>
          <div className="sheet-body">{children}</div>
          {footer && <div className="sheet-footer">{footer}</div>}
        </div>
      </div>
    )
  }

  // Centered overlay on desktop
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">{title}</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  )
}
```

```css
/* Bottom sheet styles (tablet mode) */
.bottom-sheet {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: white;
  border-radius: 16px 16px 0 0;
  max-height: 90vh;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  animation: slideUp 0.2s ease;
}

@keyframes slideUp {
  from { transform: translateY(100%); }
  to   { transform: translateY(0); }
}

.drag-handle {
  width: 36px;
  height: 4px;
  background: #D1D5DB;
  border-radius: 2px;
  margin: 10px auto 6px;
}

.bottom-sheet-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 18px 14px;
  border-bottom: 1px solid #E5E7EB;
}

.sheet-title {
  font-size: 16px;
  font-weight: 500;
  color: #1C1012;
}

.sheet-body {
  padding: 16px 18px;
}

.sheet-footer {
  padding: 12px 18px;
  border-top: 1px solid #E5E7EB;
  display: flex;
  flex-direction: column;
  gap: 8px; /* Stack buttons vertically on tablet */
}

/* Desktop modal (unchanged) */
.modal-box {
  background: white;
  border-radius: 14px;
  max-width: 440px;
  width: 90vw;
  max-height: 85vh;
  overflow-y: auto;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
```

---

## Quick Actions Grid (Tablet Only)

A 3-column grid of large tap-friendly action cards replaces the small stacked ghost buttons used in desktop mode.

```tsx
// components/dashboard/QuickActionsGrid.tsx

const QUICK_ACTIONS = [
  { label: 'New rental',    icon: DressIcon,    color: 'var(--rosa-pale)',   href: '/inventory/rentals/new' },
  { label: 'Log return',    icon: CheckIcon,    color: 'var(--green-bg)',    action: 'log_return' },
  { label: 'Create invoice',icon: DocumentIcon, color: 'var(--blue-bg)',     action: 'create_invoice' },
  { label: 'New client',    icon: PersonIcon,   color: 'var(--purple-bg)',   href: '/clients/new' },
  { label: 'Scan QR',       icon: QrIcon,       color: 'var(--amber-bg)',    action: 'scan_qr' },
  { label: 'Add task',      icon: PlusCircleIcon,color: '#F3F4F6',           action: 'add_task' },
]

export function QuickActionsGrid() {
  const { mode } = useLayoutMode()

  if (mode === 'desktop') {
    // Small stacked buttons in a card
    return (
      <div className="d-quick-actions">
        {QUICK_ACTIONS.slice(0, 3).map(action => (
          <button key={action.label} className="d-btn d-btn-ghost d-quick-btn">
            + {action.label}
          </button>
        ))}
      </div>
    )
  }

  // Tablet: 3-column icon grid
  return (
    <div className="t-quick-grid">
      {QUICK_ACTIONS.map(action => (
        <button
          key={action.label}
          className="t-quick-btn"
          onClick={() => action.href ? router.push(action.href) : handleAction(action.action)}
        >
          <div className="t-quick-icon" style={{ background: action.color }}>
            <action.icon size={22} />
          </div>
          <div className="t-quick-label">{action.label}</div>
        </button>
      ))}
    </div>
  )
}
```

---

## Kanban Drag vs Tap (Tablet Mode)

In desktop mode, the alterations kanban cards are draggable with mouse. In tablet mode, dragging is replaced with a tap → action sheet pattern:

```tsx
// components/alterations/AlterationCard.tsx

export function AlterationCard({ job }: { job: AlterationJob }) {
  const { mode } = useLayoutMode()
  const [showMoveSheet, setShowMoveSheet] = useState(false)

  if (mode === 'tablet') {
    return (
      <>
        <div
          className="km-card"
          onClick={() => setShowMoveSheet(true)} // Tap opens the job detail
          onLongPress={() => setShowMoveSheet(true)}
        >
          <CardContent job={job} />
          <button
            className="move-btn" // "Move →" button visible on tablet cards
            onClick={e => { e.stopPropagation(); setShowMoveSheet(true) }}
          >
            Move →
          </button>
        </div>
        {showMoveSheet && (
          <MoveJobSheet
            job={job}
            onClose={() => setShowMoveSheet(false)}
            onMove={newStatus => moveJob(job.id, newStatus)}
          />
        )}
      </>
    )
  }

  // Desktop: draggable card (via @dnd-kit)
  return (
    <DraggableCard job={job}>
      <CardContent job={job} />
    </DraggableCard>
  )
}
```

```tsx
// components/alterations/MoveJobSheet.tsx

export function MoveJobSheet({ job, onClose, onMove }: MoveJobSheetProps) {
  const VALID_MOVES = getValidTransitions(job.status)

  return (
    <Modal title="Move job to..." onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {VALID_MOVES.map(status => (
          <button
            key={status}
            className="t-btn t-btn-ghost"
            style={{ width: '100%', justifyContent: 'flex-start', height: 52 }}
            onClick={() => { onMove(status); onClose() }}
          >
            {STATUS_LABELS[status]}
          </button>
        ))}
      </div>
    </Modal>
  )
}
```

---

## Conditional Rendering Pattern

Use the `useLayoutMode` hook consistently throughout the codebase. Never duplicate entire pages — only swap the specific components that differ.

```tsx
// Pattern: swap subcomponents, not whole pages
export function EventsListPage({ events }: { events: Event[] }) {
  const { mode } = useLayoutMode()

  return (
    <Page>
      <Topbar title="Events" subtitle={`${events.length} active`} actions={[...]} />
      <FilterBar />
      {mode === 'tablet' ? (
        <EventCardList events={events} />    // Full-width cards, 64px rows
      ) : (
        <EventTable events={events} />      // Dense table layout
      )}
    </Page>
  )
}
```

---

## Navigation Item Config

```typescript
// lib/navigation.ts

export const NAV_SECTIONS: NavSection[] = [
  {
    label: null,
    items: [
      { href: '/dashboard',  label: 'Overview',     icon: GridIcon,     badge: null },
      { href: '/events',     label: 'Events',       icon: CalendarIcon, badge: { value: 14, color: 'purple' } },
      { href: '/clients',    label: 'Clients',      icon: PersonIcon,   badge: null },
    ]
  },
  {
    label: 'SERVICES',
    items: [
      { href: '/alterations', label: 'Alterations',  icon: ScissorsIcon, badge: { value: 4, color: 'red' } },
      { href: '/inventory/rentals', label: 'Dress rentals', icon: DressIcon, badge: null },
      { href: '/planning',   label: 'Planning',     icon: ClipboardIcon,badge: null },
    ]
  },
  {
    label: 'OPERATIONS',
    items: [
      { href: '/inventory',  label: 'Inventory',    icon: BoxIcon,      badge: null },
      { href: '/payments',   label: 'Payments',     icon: CardIcon,     badge: { value: 3, color: 'red' } },
      { href: '/settings',   label: 'Settings',     icon: GearIcon,     badge: null },
    ]
  },
]
```

---

## Touch Optimization Rules (Tablet Mode Only)

These rules are enforced in tablet mode and not required in desktop mode.

### Mandatory in tablet mode

```css
/* Applied to all interactive elements when data-mode="tablet" */
[data-mode="tablet"] button,
[data-mode="tablet"] a,
[data-mode="tablet"] [role="button"] {
  touch-action: manipulation;  /* Eliminates 300ms tap delay */
  -webkit-tap-highlight-color: rgba(201, 105, 122, 0.1);
  min-height: 44px;
  min-width: 44px;
}

/* All form inputs must be 16px to prevent iOS auto-zoom */
[data-mode="tablet"] input,
[data-mode="tablet"] textarea,
[data-mode="tablet"] select {
  font-size: 16px !important;
}

/* Press state (replaces hover in tablet) */
[data-mode="tablet"] .pressable:active {
  transform: scale(0.97);
  background-color: var(--rosa-pale);
  transition: transform 0.08s ease, background-color 0.08s ease;
}

/* No hover states in tablet mode */
[data-mode="tablet"] *:hover {
  /* Reset — hover doesn't apply on touch */
}
```

### Spacing between touch targets

Minimum 8px gap between any two tappable elements. In practice this means:
- Button groups: `gap: 8px` minimum
- List items: `border-bottom: 1px solid #F3F4F6` (visible separator, no margin collapse)
- Nav items: `margin-bottom: 3px`
- Chips/badges that are tappable: `margin: 3px`

---

## Viewport Meta Tag

Required in `app/layout.tsx` to prevent iOS pinch-zoom and ensure the layout fills the screen correctly:

```html
<meta
  name="viewport"
  content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no"
/>
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="default" />
<meta name="theme-color" content="#C9697A" />
```

---

## Recommended Default by Device

Belori attempts to detect the device type and suggest a default mode:

```typescript
// lib/utils/detectDefaultMode.ts

export function getRecommendedMode(): 'desktop' | 'tablet' {
  if (typeof window === 'undefined') return 'desktop'

  const userAgent = navigator.userAgent.toLowerCase()
  const isIPad = /ipad/.test(userAgent) || (navigator.maxTouchPoints > 1 && /macintosh/.test(userAgent))
  const isAndroidTablet = /android/.test(userAgent) && !/mobile/.test(userAgent)
  const isSurface = navigator.maxTouchPoints > 1 && window.innerWidth >= 768
  const isTouchScreen = navigator.maxTouchPoints > 0 && window.innerWidth < 1200

  return (isIPad || isAndroidTablet || isSurface || isTouchScreen) ? 'tablet' : 'desktop'
}
```

This runs on first visit only. If the user has a saved preference, that always wins. The recommendation is shown as a banner: "We detected a touchscreen — switch to Tablet mode for a better experience?" with a one-tap "Switch" button and a "Keep desktop" dismiss.

---

## Component Structure

```
components/layout/
├── Sidebar.tsx                    # Mode-aware wrapper (renders Desktop or Tablet sidebar)
├── DesktopSidebar.tsx             # 210px labeled sidebar
├── TabletSidebar.tsx              # 72px icon rail
├── NavItem.tsx                    # Mode-aware nav item (labeled vs icon)
├── Topbar.tsx                     # Mode-aware topbar
├── ModeIndicatorButton.tsx        # Small topbar button to switch mode
└── AppShell.tsx                   # Root shell: sidebar + main area

components/ui/
├── Button.tsx                     # Mode-aware button (size + radius adapts)
├── Modal.tsx                      # Mode-aware: centered overlay vs bottom sheet
├── QuickActionsGrid.tsx           # Tablet icon grid vs desktop stacked buttons
└── TableRow.tsx / ListRow.tsx     # Mode-aware row height and avatar size

components/settings/
└── LayoutModeSetting.tsx          # Settings page toggle card

lib/
├── hooks/
│   └── useLayoutMode.ts           # Mode state + toggle + persist
└── utils/
    └── detectDefaultMode.ts       # First-visit device detection
```

---

## TypeScript Types

```typescript
export type LayoutMode = 'desktop' | 'tablet'

export interface NavItemConfig {
  href: string
  label: string
  icon: React.ComponentType<{ size: number; className?: string }>
  badge?: { value: number | string; color: 'red' | 'purple' | 'amber' | 'blue' }
}

export interface NavSection {
  label: string | null
  items: NavItemConfig[]
}

export interface LayoutModeContextValue {
  mode: LayoutMode
  isTablet: boolean
  isDesktop: boolean
  toggle: () => void
  setMode: (mode: LayoutMode) => void
}
```

---

## Summary — Key Differences at a Glance

| | Desktop | Tablet |
|--|---------|--------|
| Sidebar | 210px labeled | 72px icon rail |
| Nav items | 36px, hover states | 64px, press states |
| Topbar | 48px compact | 60px tall |
| Buttons | 36–44px | 48–56px |
| Row height | 44px | 64px |
| Modals | Centered overlay | Bottom sheet |
| Kanban | Mouse drag | Tap → action sheet |
| Typography | 11–13px | 13–16px |
| Layout | 2-column | Single column |
| Hover | Yes | No (press states only) |
| Quick actions | Small ghost buttons | Icon grid cards |
| Saved via | Cookie + localStorage + DB | Same |
