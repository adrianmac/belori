# QR_CODES.md — Belori Dress QR Code Spec

> **Purpose:** This file defines everything about how QR codes work in Belori — generating them per dress, printing labels, scanning them on the boutique floor, and what happens when a code is scanned. Paste alongside PRD.md, TECH_STACK.md, and DRESS_RENTAL.md when building the QR code feature.

---

## Overview

Every dress in Belori's inventory gets a unique QR code. Staff print the code as a label and attach it to the dress hanger or garment bag. When a code is scanned — from any phone or tablet with a camera — it opens a deep link into the Belori app, showing the dress record instantly. Staff can then take action (log return, update status, view rental details) directly from that scan, without searching the inventory manually.

This makes the boutique floor faster: instead of typing a SKU or searching by client name, staff scan the gown and are immediately on the right screen.

---

## What a QR Code Encodes

Each QR code encodes a URL in this format:

```
https://belori.app/scan/[dressId]
```

The `dressId` is the UUID from the `dresses` table. This is permanent — even if the SKU changes, the QR code URL remains valid because it uses the internal ID, not the SKU.

**Why UUID and not SKU?**
- SKUs can be edited (staff may renumber dresses)
- UUIDs never change after creation
- QR codes are physical labels — they can't be "updated" once printed

---

## Scan Behavior (Deep Link)

### If scanned from a phone browser (not logged in)
→ Redirects to `https://belori.app/sign-in?redirect=/scan/[dressId]`
→ After sign-in, lands on the dress detail

### If scanned from a phone browser (logged in to Belori)
→ Directly opens `https://belori.app/scan/[dressId]`
→ Shows a mobile-optimized dress action page (not the full inventory screen)

### If scanned from within the Belori iPad app (future native app)
→ Opens the dress detail panel in-app immediately

### The `/scan/[dressId]` page

This is a dedicated, mobile-optimized page — not the full inventory screen. It shows:

```
┌─────────────────────────────┐
│  BELORI                     │
│  Bella Bridal & Events      │
├─────────────────────────────┤
│                             │
│  #BB-047                    │
│  Ivory A-line cathedral     │
│  Size 8 · Ivory · Bridal    │
│                             │
│  Status:  ● Reserved        │
│  For:     Sophia Rodriguez  │
│  Event:   Wedding Mar 22    │
│  Return:  Mar 24            │
│                             │
│  Last cleaned: Mar 1, 2026  │
│                             │
├─────────────────────────────┤
│                             │
│  [ Log return          → ]  │
│  [ View rental details → ]  │
│  [ View in inventory   → ]  │
│                             │
└─────────────────────────────┘
```

**Contextual actions based on status:**

| Status | Actions shown |
|--------|--------------|
| Available | Reserve for event · View in inventory |
| Reserved | Mark picked up · View rental details · View in inventory |
| Rented | Log return · View rental details · View event |
| Returned | Send to cleaning · View rental details |
| Cleaning | Mark cleaned · View in inventory |

Tapping any action button opens the appropriate modal (same modals as the inventory screen — the scan page is a shortcut entry point, not a different workflow).

---

## QR Code Generation

### Technology
Use the `qrcode` npm package (or `qr-code-generator`) to generate QR codes as SVG or PNG.

```bash
npm install qrcode @types/qrcode
```

### Generating a single QR code (server-side)
```typescript
// lib/qrcode.ts
import QRCode from 'qrcode'

export async function generateDressQRCode(
  dressId: string,
  options?: QRCodeOptions
): Promise<string> {
  const url = `https://belori.app/scan/${dressId}`

  const svg = await QRCode.toString(url, {
    type: 'svg',
    width: options?.size || 200,
    margin: options?.margin || 2,
    color: {
      dark: options?.darkColor || '#1C1012',  // Ink
      light: options?.lightColor || '#FFFFFF',
    },
    errorCorrectionLevel: 'M', // Medium — good balance of size and error recovery
  })

  return svg
}

export async function generateDressQRCodePNG(
  dressId: string,
  size: number = 400
): Promise<Buffer> {
  const url = `https://belori.app/scan/${dressId}`
  return QRCode.toBuffer(url, {
    width: size,
    margin: 2,
    color: { dark: '#1C1012', light: '#FFFFFF' },
    errorCorrectionLevel: 'M',
  })
}
```

---

## QR Code Label Design

Each printed label contains:
1. The QR code (large, center)
2. The SKU below the QR code
3. The dress name (truncated if long)
4. The Belori logo mark (small, bottom)

### Label sizes (two standard options)

**Small label (2" × 2") — for hanger tags:**
```
┌─────────────────────┐
│                     │
│   ████████████████  │
│   ██          ████  │
│   ██  ██████  ████  │
│   ████████████████  │
│                     │
│      #BB-047        │
│   Ivory A-line      │
│                     │
│    ■ BELORI         │
└─────────────────────┘
```

**Large label (3" × 4") — for garment bags:**
```
┌─────────────────────────────┐
│                             │
│   ██████████████████████    │
│   ██                  ██    │
│   ██  ████████████    ██    │
│   ██  ████████████    ██    │
│   ██  ████████████    ██    │
│   ██                  ██    │
│   ██████████████████████    │
│                             │
│          #BB-047            │
│   Ivory A-line cathedral    │
│     Size 8 · Bridal Gown    │
│                             │
│         ■ BELORI            │
└─────────────────────────────┘
```

### Label HTML template (for printing)
```typescript
// lib/qrcode/labelTemplate.ts

export function generateLabelHTML(dress: Dress, qrSvg: string, size: 'small' | 'large'): string {
  const isLarge = size === 'large'
  return `
    <div style="
      width: ${isLarge ? '3in' : '2in'};
      height: ${isLarge ? '4in' : '2in'};
      border: 1px solid #E5E7EB;
      border-radius: 8px;
      padding: 8px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: space-between;
      font-family: 'Inter', sans-serif;
      background: white;
      page-break-inside: avoid;
    ">
      <div style="flex: 1; display: flex; align-items: center; justify-content: center;">
        ${qrSvg}
      </div>
      <div style="text-align: center; margin-top: 6px;">
        <div style="font-size: ${isLarge ? '14px' : '11px'}; font-weight: 600; color: #1C1012; font-family: 'Courier New', monospace;">
          #${dress.sku}
        </div>
        <div style="font-size: ${isLarge ? '12px' : '9px'}; color: #6B7280; margin-top: 2px;">
          ${dress.name.length > 24 ? dress.name.slice(0, 22) + '…' : dress.name}
        </div>
        ${isLarge ? `
        <div style="font-size: 10px; color: #9CA3AF; margin-top: 2px;">
          Size ${dress.size || '—'} · ${dress.category === 'bridal_gown' ? 'Bridal' : 'Quinceañera'}
        </div>` : ''}
      </div>
      <div style="margin-top: 6px; display: flex; align-items: center; gap: 4px;">
        <svg width="10" height="10" viewBox="0 0 32 32" fill="none">
          <path d="M7 25V7l18 18V7" stroke="#1C1012" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <span style="font-size: 8px; color: #9E7880; font-weight: 500; letter-spacing: 0.05em;">BELORI</span>
      </div>
    </div>
  `
}
```

---

## QR Code Management Screen

### Route
`/inventory/qr-codes` — accessible from the inventory page via "QR codes" tab or top link

### Also accessible from:
- Post-import completion screen: "Generate QR codes for your new dresses →"
- Individual dress card: "Print QR label" button in the dress detail panel

### Layout

**Topbar:**
- Title: "QR code labels"
- Subtitle: "N dresses · Print labels for your entire inventory"
- Action buttons: "Print all labels" · "Download all (PDF)" · "Print selected"

**Filter bar** (same as inventory):
```
[ All ] [ Bridal gown ] [ Quinceañera ]
[ All statuses ] [ Available ] [ Reserved ] [ Rented ]
[ Select all ] [ Clear selection ]
```

**Dress grid** (same 3-col layout as inventory, but each card shows QR code preview):

```
┌────────────────────────┐
│  ████████████████████  │
│  ██                ██  │  ← QR code preview (live, not placeholder)
│  ████████████████████  │
│                        │
│  #BB-047               │
│  Ivory A-line · Size 8 │
│  Status: Available     │
│                        │
│  [☐] Select            │
│  [Print label]         │
└────────────────────────┘
```

Each card has:
- Live QR code preview (rendered as SVG in the card — small version)
- Dress SKU, name, size
- Status badge
- Checkbox for multi-select
- "Print label" single-dress button

### Bulk print flow

1. Staff selects dresses using checkboxes (or "Select all")
2. Taps "Print selected" → opens print configuration modal

**Print configuration modal:**
```
Print QR labels

Selected dresses: 12

Label size:
  ◉ Small (2"×2") — hanger tags
  ○ Large (3"×4") — garment bags
  ○ Custom size

Labels per row:   [3 ▾]   ← affects PDF layout

Paper size:
  ◉ Letter (8.5"×11")
  ○ A4
  ○ Label sheet (Avery 5164 compatible)

[ Download PDF ]   [ Print directly ]
```

"Download PDF" → generates PDF client-side using `jsPDF` or server-side using Puppeteer, with all selected labels laid out on pages.

"Print directly" → opens the browser print dialog with the label sheet pre-formatted.

---

## PDF Generation

### Client-side PDF (jsPDF + canvas)

For smaller batches (<50 labels), generate in the browser:

```typescript
// lib/qrcode/generatePDF.ts
import jsPDF from 'jspdf'
import QRCode from 'qrcode'

export async function generateQRLabelsPDF(
  dresses: Dress[],
  options: PrintOptions
): Promise<Blob> {
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'in',
    format: 'letter',
  })

  const {
    labelWidth,
    labelHeight,
    labelsPerRow,
    marginTop = 0.5,
    marginLeft = 0.5,
    gutterH = 0.1,
    gutterV = 0.1,
  } = options

  let col = 0
  let row = 0

  for (let i = 0; i < dresses.length; i++) {
    const dress = dresses[i]
    const url = `https://belori.app/scan/${dress.id}`

    // Generate QR code as data URL
    const qrDataUrl = await QRCode.toDataURL(url, {
      width: 300,
      margin: 1,
      color: { dark: '#1C1012', light: '#FFFFFF' },
      errorCorrectionLevel: 'M',
    })

    const x = marginLeft + col * (labelWidth + gutterH)
    const y = marginTop + row * (labelHeight + gutterV)

    // Draw border
    pdf.setDrawColor(229, 231, 235) // #E5E7EB
    pdf.setLineWidth(0.01)
    pdf.roundedRect(x, y, labelWidth, labelHeight, 0.08, 0.08, 'S')

    // Place QR code image
    const qrSize = labelWidth - 0.3
    pdf.addImage(qrDataUrl, 'PNG', x + 0.15, y + 0.1, qrSize, qrSize)

    // SKU text
    pdf.setFont('Courier', 'bold')
    pdf.setFontSize(9)
    pdf.setTextColor(28, 16, 18) // Ink
    pdf.text(`#${dress.sku}`, x + labelWidth / 2, y + qrSize + 0.22, { align: 'center' })

    // Dress name (truncated)
    pdf.setFont('Helvetica', 'normal')
    pdf.setFontSize(7)
    pdf.setTextColor(107, 114, 128) // Gray
    const shortName = dress.name.length > 26 ? dress.name.slice(0, 24) + '…' : dress.name
    pdf.text(shortName, x + labelWidth / 2, y + qrSize + 0.35, { align: 'center' })

    // BELORI mark
    pdf.setFontSize(6)
    pdf.setTextColor(158, 120, 128) // Ink-light
    pdf.text('■ BELORI', x + labelWidth / 2, y + labelHeight - 0.07, { align: 'center' })

    // Advance position
    col++
    if (col >= labelsPerRow) {
      col = 0
      row++
      // New page if needed
      const pageHeight = 11 // letter
      if (marginTop + (row + 1) * (labelHeight + gutterV) > pageHeight - 0.5) {
        pdf.addPage()
        row = 0
      }
    }
  }

  return pdf.output('blob')
}
```

### Server-side PDF (for batches >50 labels)

Large batches are generated server-side via a Server Action to avoid browser memory issues:

```typescript
// app/actions/inventory/generateQRPDF.ts
export async function generateQRLabelsPDFServer(
  dressIds: string[],
  options: PrintOptions
): Promise<{ downloadUrl: string }> {
  const { orgId } = auth()
  const boutique = await getBoutiqueByOrgId(orgId)

  const dresses = await db.query.dresses.findMany({
    where: and(
      eq(dresses.boutiqueId, boutique.id),
      inArray(dresses.id, dressIds)
    )
  })

  // Generate PDF using puppeteer (runs in Vercel Edge Function)
  const pdfBuffer = await generatePDFWithPuppeteer(dresses, options)

  // Upload to Supabase Storage with 1-hour expiry
  const { data } = await supabase.storage
    .from('temp-exports')
    .upload(`qr-labels-${Date.now()}.pdf`, pdfBuffer, {
      contentType: 'application/pdf',
      upsert: true,
    })

  const { data: { signedUrl } } = await supabase.storage
    .from('temp-exports')
    .createSignedUrl(data.path, 3600) // 1 hour

  return { downloadUrl: signedUrl }
}
```

---

## Single Dress QR Code (from dress card/detail)

From any dress card in the inventory, a "Print QR label" button:

1. Opens a mini modal:
```
Print label for #BB-047

  [QR code preview — large]

  #BB-047
  Ivory A-line cathedral
  Size 8 · Bridal Gown

  Label size:
    ◉ Small (2"×2" — hanger tag)
    ○ Large (3"×4" — garment bag)

  [ Download PNG ]  [ Download PDF ]  [ Print now ]
```

"Download PNG" → returns the QR code as a standalone PNG (no label text, just the QR), useful for custom label printing.

"Download PDF" → returns a single-page PDF with one label, formatted for the selected size.

"Print now" → opens print dialog with the label pre-formatted.

---

## Scan Page Implementation

### Route
`/scan/[dressId]` — public route, but auth-gated for actions

```typescript
// app/scan/[dressId]/page.tsx

export default async function ScanPage({ params }: { params: { dressId: string } }) {
  const dress = await db.query.dresses.findFirst({
    where: eq(dresses.id, params.dressId),
    with: {
      currentEvent: { with: { client: true } },
    }
  })

  if (!dress) {
    return <DressNotFoundPage />
  }

  return <DressScanPage dress={dress} />
}
```

```typescript
// components/scan/DressScanPage.tsx — mobile-optimized

export function DressScanPage({ dress }: { dress: DressWithEvent }) {
  const { isSignedIn } = useAuth()

  return (
    <div style={{ maxWidth: 400, margin: '0 auto', padding: 16, minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <BeloriLogoMark size={24} />
        <div>
          <div style={{ fontSize: 14, fontWeight: 500 }}>Belori</div>
          <div style={{ fontSize: 11, color: '#6B7280' }}>{dress.boutiqueName}</div>
        </div>
      </div>

      {/* Dress info */}
      <div style={{ background: 'white', borderRadius: 12, border: '1px solid #E5E7EB', padding: 16, marginBottom: 16 }}>
        <div style={{ fontSize: 12, color: '#6B7280', fontFamily: 'monospace' }}>#{dress.sku}</div>
        <div style={{ fontSize: 18, fontWeight: 500, color: '#1C1012', marginTop: 4 }}>{dress.name}</div>
        <div style={{ fontSize: 13, color: '#6B7280', marginTop: 2 }}>
          Size {dress.size} · {dress.color} · {dress.category === 'bridal_gown' ? 'Bridal' : 'Quinceañera'}
        </div>

        <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #E5E7EB' }}>
          <DressStatusBadge status={dress.status} />

          {dress.currentEvent && (
            <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: 13, color: '#1C1012' }}>
                {dress.status === 'reserved' ? 'Reserved for' : 'Rented to'}:{' '}
                <strong>{dress.currentEvent.client.name}</strong>
              </div>
              <div style={{ fontSize: 12, color: '#6B7280' }}>
                {dress.currentEvent.type === 'wedding' ? 'Wedding' : 'Quinceañera'} ·{' '}
                {formatDate(dress.currentEvent.eventDate)}
              </div>
              {dress.returnDueDate && (
                <div style={{ fontSize: 12, color: isReturnOverdue(dress) ? '#B91C1C' : '#6B7280' }}>
                  Return due: {formatDate(dress.returnDueDate)}
                  {isReturnOverdue(dress) && ' — OVERDUE'}
                </div>
              )}
            </div>
          )}

          {dress.lastCleanedAt && (
            <div style={{ fontSize: 12, color: '#6B7280', marginTop: 6 }}>
              Last cleaned: {formatDate(dress.lastCleanedAt)}
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      {isSignedIn ? (
        <DressScanActions dress={dress} />
      ) : (
        <SignInPrompt redirectTo={`/scan/${dress.id}`} />
      )}
    </div>
  )
}
```

```typescript
// components/scan/DressScanActions.tsx

export function DressScanActions({ dress }: { dress: Dress }) {
  const actions = getScanActions(dress.status)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {actions.map(action => (
        <button
          key={action.id}
          onClick={() => action.onClick()}
          style={{
            width: '100%',
            padding: '14px 16px',
            borderRadius: 10,
            border: `1px solid ${action.isPrimary ? '#C9697A' : '#E5E7EB'}`,
            background: action.isPrimary ? '#FDF5F6' : 'white',
            color: action.isPrimary ? '#C9697A' : '#374151',
            fontSize: 14,
            fontWeight: action.isPrimary ? 500 : 400,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          {action.label}
          <span>→</span>
        </button>
      ))}
    </div>
  )
}

function getScanActions(status: DressStatus): ScanAction[] {
  switch (status) {
    case 'available':
      return [
        { id: 'reserve', label: 'Reserve for event', isPrimary: true, onClick: () => {} },
        { id: 'view', label: 'View in inventory', isPrimary: false, onClick: () => {} },
      ]
    case 'reserved':
      return [
        { id: 'pickup', label: 'Mark picked up', isPrimary: true, onClick: () => {} },
        { id: 'rental', label: 'View rental details', isPrimary: false, onClick: () => {} },
        { id: 'view', label: 'View in inventory', isPrimary: false, onClick: () => {} },
      ]
    case 'rented':
      return [
        { id: 'return', label: 'Log return', isPrimary: true, onClick: () => {} },
        { id: 'rental', label: 'View rental details', isPrimary: false, onClick: () => {} },
        { id: 'event', label: 'View event', isPrimary: false, onClick: () => {} },
      ]
    case 'returned':
      return [
        { id: 'clean', label: 'Send to cleaning', isPrimary: true, onClick: () => {} },
        { id: 'rental', label: 'View rental details', isPrimary: false, onClick: () => {} },
      ]
    case 'cleaning':
      return [
        { id: 'cleaned', label: 'Mark cleaned & available', isPrimary: true, onClick: () => {} },
        { id: 'view', label: 'View in inventory', isPrimary: false, onClick: () => {} },
      ]
    default:
      return [{ id: 'view', label: 'View in inventory', isPrimary: true, onClick: () => {} }]
  }
}
```

---

## QR Code Scan Logging

Every scan is logged for analytics and security:

```typescript
export const qrScanLog = pgTable('qr_scan_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  dressId: uuid('dress_id').references(() => dresses.id).notNull(),
  boutiqueId: uuid('boutique_id').references(() => boutiques.id).notNull(),
  scannedByUserId: text('scanned_by_user_id'),  // null if not authenticated
  scannedAt: timestamp('scanned_at').defaultNow(),
  userAgent: text('user_agent'),                 // mobile/tablet detection
  actionTaken: text('action_taken'),             // 'log_return' | 'mark_pickup' | null
})
```

Scan logs are used in the future analytics dashboard to show:
- Most scanned dresses (may indicate high-traffic items)
- Scan-to-action conversion (how often scans lead to an action)
- Unauthenticated scans (may indicate client or vendor scanning)

---

## QR Code on Dress Detail Panel

In the dress detail slide-over panel (right side of inventory screen), a new "QR Code" section:

```
QR CODE
  [QR code preview — 120×120px]

  belori.app/scan/[id]

  [ Print small label ]  [ Print large label ]
  [ Download PNG ]
```

---

## Package Dependencies

```bash
# QR code generation
npm install qrcode @types/qrcode

# PDF generation (client-side)
npm install jspdf @types/jspdf

# Excel parsing (for import feature — shared dependency)
npm install xlsx

# CSV parsing (for import feature — shared dependency)
npm install papaparse @types/papaparse
```

---

## Error States

| Scenario | What the user sees |
|----------|-------------------|
| QR code URL is invalid (UUID not found) | "This dress could not be found. It may have been removed from inventory." |
| QR code is from a different boutique | "This dress belongs to a different boutique. You're signed in to [Boutique Name]." |
| Not signed in | Sign-in prompt with redirect back to scan URL after auth |
| Dress found but action fails | Toast error with specific message + "Try again" |
| PDF generation fails | "Label generation failed. Try downloading fewer labels at once." |

---

## Component Structure

```
components/qrcodes/
├── QRCodePage.tsx                # /inventory/qr-codes main screen
├── QRCodeGrid.tsx                # Grid of dress cards with QR previews
├── QRCodeCard.tsx                # Single dress card with QR preview
├── QRCodePreview.tsx             # Inline SVG QR code component
├── PrintConfigModal.tsx          # Label size + paper size + layout
├── SingleDressQRModal.tsx        # Per-dress print/download modal
└── LabelPreview.tsx              # Visual label preview before printing

components/scan/
├── DressScanPage.tsx             # /scan/[dressId] mobile page
├── DressScanActions.tsx          # Contextual action buttons
├── DressNotFoundPage.tsx         # 404 for invalid QR
└── SignInPrompt.tsx              # Auth gate for scan actions

app/scan/
└── [dressId]/
    └── page.tsx                  # Server component — fetches dress
```

---

## Validation Rules

| Check | Behavior |
|-------|----------|
| Dress UUID not found | Show "Dress not found" page |
| Dress belongs to different boutique | Show "Wrong boutique" error |
| User not authenticated | Show sign-in prompt, redirect after auth |
| Action not valid for current status | Action button hidden/disabled |
| PDF with 0 dresses selected | Print button disabled |
| PDF batch > 200 labels | Route to server-side generation automatically |
| QR code image fails to render | Show placeholder with SKU text only |
