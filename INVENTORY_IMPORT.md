# INVENTORY_IMPORT.md — Belori Inventory Import Spec

> **Purpose:** This file defines everything about how boutiques bulk-import dress inventory into Belori — the CSV/Excel format, column mapping, validation, error handling, duplicate detection, and the import UI flow. Paste alongside PRD.md, TECH_STACK.md, and DRESS_RENTAL.md when building the inventory import feature.

---

## Overview

Most boutiques adopting Belori already have an existing inventory — tracked in spreadsheets, notebooks, or another POS system. Making them manually re-enter 24–100+ dresses one at a time is a friction barrier to adoption. The import feature lets them upload a spreadsheet and have their full catalog ready in under 5 minutes.

The import is **one-directional** (spreadsheet → Belori, not the other way). Export is a separate feature (out of scope for this spec). The import is **additive** — it never overwrites or deletes existing dresses, only adds new ones. Existing dresses with matching SKUs are flagged for review, not silently overwritten.

---

## Supported File Formats

| Format | Extension | Notes |
|--------|-----------|-------|
| CSV (comma-separated) | `.csv` | UTF-8 encoding required |
| Excel | `.xlsx`, `.xls` | First sheet only is imported |
| Tab-separated | `.tsv` | Treated same as CSV |

Max file size: **5MB**. Max rows: **500 dresses per import**.

---

## Required and Optional Columns

### Required columns (import fails without these):

| Column name(s) | Field | Notes |
|----------------|-------|-------|
| `sku`, `SKU`, `Item #`, `Item Number` | `sku` | Must be unique within the boutique |
| `name`, `Name`, `Dress Name`, `Description` | `name` | Display name |
| `category`, `Category`, `Type` | `category` | See category mapping below |
| `rental_price`, `Rental Price`, `Price`, `Rate` | `rentalPriceCents` | Dollar amount, no $ sign needed |
| `deposit`, `Deposit`, `Security Deposit` | `depositCents` | Dollar amount |

### Optional columns (imported if present, skipped if absent):

| Column name(s) | Field | Default if missing |
|----------------|-------|--------------------|
| `size`, `Size`, `Dress Size` | `size` | `null` |
| `color`, `Color`, `Colour` | `color` | `null` |
| `status`, `Status` | `status` | `available` |
| `last_cleaned`, `Last Cleaned`, `Clean Date` | `lastCleanedAt` | `null` |
| `notes`, `Notes`, `Comments` | `notes` | `null` |
| `purchase_date`, `Purchase Date` | `purchaseDate` | `null` |
| `purchase_price`, `Purchase Price`, `Cost` | `purchasePriceCents` | `null` |

### Category mapping

The import is flexible — it accepts many ways to say the same thing:

| Accepted values | Maps to |
|-----------------|---------|
| `bridal`, `bridal gown`, `wedding gown`, `wedding dress`, `bride`, `bridal_gown`, `B` | `bridal_gown` |
| `quinceanera`, `quinceañera`, `quince`, `quince gown`, `quinceanera_gown`, `Q` | `quinceanera_gown` |

Case-insensitive. Leading/trailing spaces stripped.

### Status mapping

| Accepted values | Maps to |
|-----------------|---------|
| `available`, `in stock`, `in-stock`, `ready`, `yes`, `Y`, `1` | `available` |
| `reserved`, `booked`, `held` | `reserved` |
| `rented`, `out`, `rented out`, `loaned` | `rented` |
| `cleaning`, `at cleaner`, `at cleaners`, `dry cleaning` | `cleaning` |

If status is `reserved` or `rented`, the dress is imported with that status but no event link (since the event may not exist in Belori yet). A post-import task is created: "Review imported dresses with 'reserved' or 'rented' status — link to events manually."

---

## Template File

A downloadable template CSV is provided in the UI. It includes:
- All column headers (required + optional)
- 3 example rows (one bridal, one quince, one BYOG example)
- A second sheet ("Instructions") with column definitions and accepted values

Template download: available from the import modal header as "Download template →"

### Template CSV content:
```csv
sku,name,category,size,color,rental_price,deposit,status,last_cleaned,notes
BB-001,Ivory A-line cathedral,bridal gown,8,Ivory,450,300,available,2026-03-01,Beautiful cathedral train
BB-002,Rose quartz ball gown,bridal gown,4,Rose quartz,420,280,available,2026-03-05,
QG-001,Magenta ball gown,quinceanera,2,Magenta,380,250,available,2026-03-10,
```

---

## Import UI Flow

### Trigger
"Import inventory" button — located in the inventory page topbar alongside "+ Add dress"

### Step 1 — Upload file

```
┌─────────────────────────────────────────────────────────┐
│           Import dress inventory                     [×] │
├─────────────────────────────────────────────────────────┤
│                                                         │
│   ┌─────────────────────────────────────────────────┐  │
│   │                                                 │  │
│   │          Drag & drop your file here             │  │
│   │                                                 │  │
│   │    CSV, Excel (.xlsx), or TSV · Max 5MB         │  │
│   │                                                 │  │
│   │         [Choose file]                           │  │
│   └─────────────────────────────────────────────────┘  │
│                                                         │
│   Don't have a file ready?                              │
│   [Download template →]  to get the right format       │
│                                                         │
│   Need help? Your spreadsheet doesn't need to match     │
│   exactly — we'll help you map columns in the next step │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

On file selection:
- Parse the file client-side (using `papaparse` for CSV, `SheetJS/xlsx` for Excel)
- Extract headers + first 5 rows for preview
- Advance to Step 2 automatically

### Step 2 — Column mapping

If the uploaded file's headers don't match the expected column names exactly, show a mapping screen:

```
Map your columns to Belori fields:

Your column          →  Belori field
─────────────────────────────────────
"Item #"             →  [SKU ▾]           ← dropdown of Belori fields
"Dress Name"         →  [Name ▾]
"Type"               →  [Category ▾]
"Size"               →  [Size ▾]
"Color"              →  [Color ▾]
"Rental Rate"        →  [Rental price ▾]
"Deposit Amount"     →  [Deposit ▾]
"Condition"          →  [Skip this column ▾]
"Date In"            →  [Last cleaned ▾]
"Comments"           →  [Notes ▾]

  Preview (first 3 rows with your mapping):
  ┌──────────┬──────────────────────┬──────────┬──────┬────────┐
  │ SKU      │ Name                 │ Category │ Size │ Color  │
  ├──────────┼──────────────────────┼──────────┼──────┼────────┤
  │ BB-001   │ Ivory A-line         │ Bridal   │ 8    │ Ivory  │
  │ BB-002   │ Rose quartz ball gown│ Bridal   │ 4    │ Rose   │
  │ QG-001   │ Magenta ball gown    │ Quince   │ 2    │ Magenta│
  └──────────┴──────────────────────┴──────────┴──────┴────────┘

[ Back ]                              [ Validate →  ]
```

**Auto-mapping logic:** Before showing the mapping screen, Belori attempts to auto-map columns using fuzzy matching. If confidence is high (>90% match), the column is auto-mapped and shown with a ✓ checkmark. Only ambiguous columns require manual selection.

If the file headers perfectly match the template, Step 2 is skipped entirely.

### Step 3 — Validation results

After mapping, validate all rows and show results:

```
Validation results:

  ✓  42 dresses ready to import
  ⚠   3 rows have warnings (will still import)
  ✗   2 rows have errors (will be skipped)

─────────────────────────────────────────────────────

ERRORS (will be skipped — fix and re-import):
  Row 14:  SKU "BB-047" already exists in your inventory
  Row 31:  Rental price is missing

WARNINGS (will import, review after):
  Row 8:   Category "gown" mapped to "Bridal gown" — verify
  Row 19:  Status "loaned" mapped to "Rented" — link to event after import
  Row 22:  Size "XS" is non-standard — saved as-is

DUPLICATES DETECTED:
  2 SKUs match existing dresses:
  • BB-047 (already in Belori) — will be SKIPPED
  • QG-014 (already in Belori) — will be SKIPPED
  
  [  ] Overwrite existing dresses with import data
       (check this only if your spreadsheet has
        newer/corrected information)

─────────────────────────────────────────────────────

[ Back ]          [ Download error report ]    [ Import 42 dresses → ]
```

**Error types (row skipped):**
- Missing required field (SKU, name, category, rental price, deposit)
- SKU already exists (unless overwrite is checked)
- Rental price is 0 or negative
- Deposit > rental price

**Warning types (row imports with flag):**
- Category value required fuzzy mapping
- Status is reserved/rented (no event link)
- Non-standard size value
- Price seems unusually high (>$2,000) or low (<$50) — soft check

"Download error report" → generates a CSV of only the errored/skipped rows with an added "Error reason" column, so the user can fix and re-import just those rows.

### Step 4 — Import confirmation

```
Import 42 dresses?

This will add 42 new dresses to your Bella Bridal & Events
inventory. This cannot be undone in bulk — individual dresses
can be deleted after import if needed.

  42 bridal gowns and quinceañera gowns
  2 dresses skipped (duplicate SKUs)
  3 dresses imported with warnings

[ Cancel ]                    [ Confirm import ]
```

### Step 5 — Import progress & complete

```
Importing your inventory...

  ████████████████████░░░  38 / 42

  ✓ BB-001 Ivory A-line cathedral
  ✓ BB-002 Rose quartz ball gown
  ✓ QG-001 Magenta ball gown
  ...

```

On completion:

```
Import complete!

  ✓  42 dresses added to inventory
  ⚠   3 dresses need review (warnings)
  ✗   2 dresses were skipped (duplicate SKUs)

  [ View inventory ]       [ Import another file ]

  Next steps:
  • 2 dresses have status "Reserved" or "Rented" — link them to events
  • Generate QR codes for your new dresses →
    [Go to QR codes]
```

"Go to QR codes" navigates to the QR code bulk generation screen — this links the import flow directly to the QR code feature.

---

## Server Action — Process Import

```typescript
export async function importDresses(rows: ImportRow[]) {
  const { orgId } = auth()
  const boutique = await getBoutiqueByOrgId(orgId)

  const results = {
    imported: 0,
    skipped: 0,
    warnings: [] as string[],
    errors: [] as string[],
  }

  for (const row of rows) {
    try {
      // Check for duplicate SKU
      const existing = await db.query.dresses.findFirst({
        where: and(
          eq(dresses.boutiqueId, boutique.id),
          eq(dresses.sku, row.sku)
        )
      })

      if (existing && !row.overwrite) {
        results.skipped++
        results.errors.push(`SKU ${row.sku} already exists — skipped`)
        continue
      }

      const dressData = {
        boutiqueId: boutique.id,
        sku: row.sku,
        name: row.name,
        category: mapCategory(row.category),
        size: row.size || null,
        color: row.color || null,
        rentalPriceCents: parseCents(row.rentalPrice),
        depositCents: parseCents(row.deposit),
        status: mapStatus(row.status) || 'available',
        lastCleanedAt: parseDate(row.lastCleaned) || null,
        purchaseDate: parseDate(row.purchaseDate) || null,
        purchasePriceCents: row.purchasePrice ? parseCents(row.purchasePrice) : null,
        notes: row.notes || null,
        photoUrls: [],
        isActive: true,
      }

      if (existing && row.overwrite) {
        await db.update(dresses).set(dressData).where(eq(dresses.id, existing.id))
      } else {
        await db.insert(dresses).values(dressData)
      }

      results.imported++

    } catch (err) {
      results.errors.push(`Row ${row._rowNumber}: ${err.message}`)
      results.skipped++
    }
  }

  // Post-import task if any dresses have reserved/rented status
  const reservedCount = rows.filter(r =>
    ['reserved','rented'].includes(mapStatus(r.status) || '')
  ).length
  if (reservedCount > 0) {
    // Note is added to boutique-level tasks (not event tasks)
    await db.insert(boutiqueTasks).values({
      boutiqueId: boutique.id,
      text: `Review ${reservedCount} imported dresses with Reserved/Rented status — link to events`,
      category: 'Import',
      isAlert: true,
      done: false,
    })
  }

  revalidatePath('/inventory')
  return results
}
```

---

## Parsing Helpers

```typescript
// lib/utils/importParsers.ts

export function parseCents(value: string | number): number {
  if (typeof value === 'number') return Math.round(value * 100)
  // Remove $, commas, spaces
  const cleaned = String(value).replace(/[$,\s]/g, '')
  const num = parseFloat(cleaned)
  if (isNaN(num)) throw new Error(`Cannot parse price: "${value}"`)
  return Math.round(num * 100)
}

export function mapCategory(value: string): DressCategory {
  const v = value.toLowerCase().trim()
  const bridal = ['bridal','bridal gown','wedding gown','wedding dress','bride','bridal_gown','b']
  const quince = ['quinceanera','quinceañera','quince','quince gown','quinceanera_gown','q']
  if (bridal.some(b => v.includes(b) || v === b)) return 'bridal_gown'
  if (quince.some(q => v.includes(q) || v === q)) return 'quinceanera_gown'
  throw new Error(`Unknown category: "${value}". Use "Bridal gown" or "Quinceañera"`)
}

export function mapStatus(value?: string): DressStatus | null {
  if (!value) return null
  const v = value.toLowerCase().trim()
  if (['available','in stock','in-stock','ready','yes','y','1'].includes(v)) return 'available'
  if (['reserved','booked','held'].includes(v)) return 'reserved'
  if (['rented','out','rented out','loaned'].includes(v)) return 'rented'
  if (['cleaning','at cleaner','at cleaners','dry cleaning'].includes(v)) return 'cleaning'
  return null // maps to 'available' with a warning
}

export function parseDate(value?: string): string | null {
  if (!value) return null
  // Accept: YYYY-MM-DD, MM/DD/YYYY, MM-DD-YYYY, DD/MM/YYYY
  const formats = [
    /^(\d{4})-(\d{2})-(\d{2})$/, // 2026-03-01
    /^(\d{2})\/(\d{2})\/(\d{4})$/, // 03/01/2026
    /^(\d{2})-(\d{2})-(\d{4})$/, // 03-01-2026
  ]
  for (const fmt of formats) {
    if (fmt.test(value.trim())) {
      const d = new Date(value.trim())
      if (!isNaN(d.getTime())) return format(d, 'yyyy-MM-dd')
    }
  }
  return null // invalid date — imported as null with warning
}
```

---

## Client-Side Parsing (before server)

Parsing happens client-side first to give instant feedback before any server calls:

```typescript
// Using papaparse for CSV, SheetJS for Excel
import Papa from 'papaparse'
import * as XLSX from 'xlsx'

export function parseFile(file: File): Promise<ParsedRow[]> {
  return new Promise((resolve, reject) => {
    const ext = file.name.split('.').pop()?.toLowerCase()

    if (ext === 'csv' || ext === 'tsv') {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (result) => resolve(result.data as ParsedRow[]),
        error: reject,
      })
    } else if (ext === 'xlsx' || ext === 'xls') {
      const reader = new FileReader()
      reader.onload = (e) => {
        const wb = XLSX.read(e.target?.result, { type: 'array' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const data = XLSX.utils.sheet_to_json(ws, { defval: '' })
        resolve(data as ParsedRow[])
      }
      reader.readAsArrayBuffer(file)
    } else {
      reject(new Error('Unsupported file type. Please use CSV or Excel.'))
    }
  })
}
```

---

## Validation Rules Summary

| Check | Level | Behavior |
|-------|-------|----------|
| Missing SKU | Error | Row skipped |
| Missing name | Error | Row skipped |
| Missing category | Error | Row skipped |
| Missing rental price | Error | Row skipped |
| Missing deposit | Error | Row skipped |
| Duplicate SKU (no overwrite) | Error | Row skipped |
| Rental price = 0 | Error | Row skipped |
| Deposit > rental price | Error | Row skipped |
| Ambiguous category | Warning | Mapped, flagged |
| Status = reserved/rented | Warning | Imported, task created |
| Non-standard size | Warning | Imported as-is |
| Very high price (>$2,000) | Warning | Imported, flagged |
| Very low price (<$50) | Warning | Imported, flagged |
| Invalid date format | Warning | Date imported as null |
| File >5MB | Hard block | Upload rejected immediately |
| File >500 rows | Hard block | Upload rejected with message |
| Unsupported file type | Hard block | Upload rejected immediately |

---

## Component Structure

```
components/inventory/import/
├── ImportModal.tsx               # Multi-step modal container
├── steps/
│   ├── FileUploadStep.tsx        # Drag & drop + template download
│   ├── ColumnMappingStep.tsx     # Map columns to Belori fields
│   ├── ValidationResultsStep.tsx # Errors, warnings, duplicate handling
│   ├── ConfirmationStep.tsx      # Final review before import
│   └── ProgressStep.tsx         # Import progress + completion screen
├── ColumnMapper.tsx              # Individual column mapping row
├── ValidationRow.tsx             # Error/warning display row
└── ImportResultsSummary.tsx      # Post-import stats + next steps
```
