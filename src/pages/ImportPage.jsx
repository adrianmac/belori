import { useState, useRef, useCallback } from 'react'
import { C } from '../lib/colors.js'
import { useAuth } from '../context/AuthContext.jsx'
import { supabase } from '../lib/supabase.js'

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

const VALID_CATEGORIES = [
  'bridal_gown','quince_gown','arch','centerpiece','linen','lighting',
  'chair','veil','headpiece','jewelry','ceremony','consumable','equipment',
]

const VALID_EVENT_TYPES = [
  'quinceañera','wedding','baptism','xv_años','sweet_16','other',
]

const IMPORT_TYPES = {
  clients: {
    label: 'Clients',
    icon: '👤',
    description: 'Import client records with contact info and partner details',
    columns: [
      { name: 'name',         desc: 'Full client name',        required: true  },
      { name: 'phone',        desc: 'Phone number',            required: false },
      { name: 'email',        desc: 'Email address',           required: false },
      { name: 'partner_name', desc: 'Partner / groom name',    required: false },
      { name: 'notes',        desc: 'Any additional notes',    required: false },
    ],
    template: 'name,phone,email,partner_name,notes\nJane Smith,555-100-0001,jane@example.com,John Smith,VIP client\n',
    screen: 'clients',
  },
  inventory: {
    label: 'Inventory',
    icon: '📦',
    description: 'Import gowns, decorations, and other boutique inventory items',
    columns: [
      { name: 'sku',      desc: 'Unique item code',                                               required: true  },
      { name: 'name',     desc: 'Item display name',                                              required: true  },
      { name: 'category', desc: `Item category (${VALID_CATEGORIES.join(', ')})`,                 required: true  },
      { name: 'color',    desc: 'Color description',                                              required: false },
      { name: 'size',     desc: 'Size (e.g. 8, 10, S, M, XL)',                                   required: false },
      { name: 'price',    desc: 'Rental / sale price (number)',                                   required: false },
      { name: 'quantity', desc: 'Stock quantity (number, defaults to 1)',                         required: false },
    ],
    template: 'sku,name,category,color,size,price,quantity\nGOWN-001,Cinderella Ball Gown,bridal_gown,Ivory,10,350,1\n',
    screen: 'inventory',
  },
  events: {
    label: 'Events',
    icon: '📅',
    description: 'Import upcoming events linked to existing or new client records',
    columns: [
      { name: 'client_name', desc: 'Client full name (matched or created)',               required: true  },
      { name: 'type',        desc: `Event type (${VALID_EVENT_TYPES.join(', ')})`,        required: true  },
      { name: 'event_date',  desc: 'Date in YYYY-MM-DD format',                           required: false },
      { name: 'venue',       desc: 'Venue name or address',                               required: false },
      { name: 'guests',      desc: 'Expected guest count (number)',                       required: false },
      { name: 'total',       desc: 'Total contract value (number)',                       required: false },
    ],
    template: 'client_name,type,event_date,venue,guests,total\nJane Smith,wedding,2026-09-15,The Grand Ballroom,150,4500\n',
    screen: 'events',
  },
}

// ─── CSV PARSER ───────────────────────────────────────────────────────────────

function parseCSV(text) {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
  const nonEmpty = lines.filter(l => l.trim() !== '')
  if (nonEmpty.length < 2) return { headers: [], rows: [] }

  const parseRow = (line) => {
    const fields = []
    let cur = ''
    let inQuotes = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          cur += '"'
          i++
        } else {
          inQuotes = !inQuotes
        }
      } else if (ch === ',' && !inQuotes) {
        fields.push(cur.trim())
        cur = ''
      } else {
        cur += ch
      }
    }
    fields.push(cur.trim())
    return fields
  }

  const headers = parseRow(nonEmpty[0]).map(h => h.toLowerCase().trim())
  const rows = nonEmpty.slice(1).map((line, idx) => {
    const vals = parseRow(line)
    const obj = {}
    headers.forEach((h, i) => { obj[h] = vals[i] ?? '' })
    obj._rowIndex = idx + 2 // 1-based, header is row 1
    return obj
  })
  return { headers, rows }
}

// ─── VALIDATION ───────────────────────────────────────────────────────────────

function validateRow(row, type) {
  const errs = []
  const cfg = IMPORT_TYPES[type]

  cfg.columns.forEach(col => {
    if (col.required && !row[col.name]?.trim()) {
      errs.push(`"${col.name}" is required`)
    }
  })

  if (type === 'inventory') {
    const cat = row.category?.trim()
    if (cat && !VALID_CATEGORIES.includes(cat)) {
      errs.push(`"${cat}" is not a valid category`)
    }
    if (row.price && row.price.trim() && isNaN(Number(row.price))) {
      errs.push('price must be a number')
    }
    if (row.quantity && row.quantity.trim() && isNaN(Number(row.quantity))) {
      errs.push('quantity must be a number')
    }
  }

  if (type === 'events') {
    const evtType = row.type?.trim()
    if (evtType && !VALID_EVENT_TYPES.includes(evtType)) {
      errs.push(`"${evtType}" is not a valid event type`)
    }
    const dt = row.event_date?.trim()
    if (dt) {
      const d = new Date(dt)
      if (isNaN(d.getTime()) || !/^\d{4}-\d{2}-\d{2}$/.test(dt)) {
        errs.push('event_date must be in YYYY-MM-DD format')
      }
    }
    if (row.guests && row.guests.trim() && isNaN(Number(row.guests))) {
      errs.push('guests must be a number')
    }
    if (row.total && row.total.trim() && isNaN(Number(row.total))) {
      errs.push('total must be a number')
    }
  }

  return errs
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function insertInBatches(records, tableName, batchSize, onProgress) {
  const errors = []
  let inserted = 0
  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize)
    const { error } = await supabase.from(tableName).insert(batch)
    if (error) {
      batch.forEach((_, idx) => {
        errors.push({ rowIndex: i + idx + 2, message: error.message })
      })
    } else {
      inserted += batch.length
    }
    onProgress && onProgress(Math.min(i + batchSize, records.length), records.length)
    if (i + batchSize < records.length) await sleep(100)
  }
  return { inserted, errors }
}

// ─── STYLES ───────────────────────────────────────────────────────────────────

const S = {
  page: {
    minHeight: '100vh',
    background: C.ivory,
    fontFamily: 'system-ui, -apple-system, sans-serif',
  },
  topbar: {
    background: C.white,
    borderBottom: `1px solid ${C.border}`,
    padding: '0 24px',
    height: 56,
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    flexShrink: 0,
  },
  topbarTitle: {
    fontSize: 18,
    fontWeight: 700,
    color: C.ink,
  },
  body: {
    maxWidth: 880,
    margin: '0 auto',
    padding: '28px 20px 64px',
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: 700,
    color: C.gray,
    textTransform: 'uppercase',
    letterSpacing: '.07em',
    marginBottom: 12,
  },
  // type grid
  typeGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 16,
    marginBottom: 32,
  },
  typeCard: (active) => ({
    background: C.white,
    border: `2px solid ${active ? C.rosa : C.border}`,
    borderRadius: 12,
    padding: '20px 16px',
    cursor: 'pointer',
    textAlign: 'center',
    boxShadow: active
      ? `0 0 0 3px ${C.rosaLight}44`
      : '0 1px 3px rgba(0,0,0,.06)',
    transition: 'border-color .15s, box-shadow .15s',
  }),
  typeIcon: { fontSize: 28, display: 'block', marginBottom: 8 },
  typeName: (active) => ({
    fontSize: 15,
    fontWeight: 700,
    color: active ? C.rosaText : C.ink,
    marginBottom: 4,
  }),
  typeDesc: {
    fontSize: 12,
    color: C.gray,
    lineHeight: 1.45,
  },
  // step bar
  stepBar: {
    display: 'flex',
    alignItems: 'center',
    marginBottom: 28,
  },
  stepCircle: (active, done) => ({
    width: 28,
    height: 28,
    borderRadius: '50%',
    background: done ? C.green : active ? C.rosa : C.border,
    color: (done || active) ? C.white : C.gray,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 12,
    fontWeight: 700,
    flexShrink: 0,
  }),
  stepLabel: (active, done) => ({
    fontSize: 12,
    fontWeight: active ? 600 : 400,
    color: done ? C.green : active ? C.ink : C.gray,
    whiteSpace: 'nowrap',
    marginLeft: 6,
  }),
  stepLine: (done) => ({
    flex: 1,
    height: 2,
    background: done ? C.green : C.border,
    margin: '0 10px',
  }),
  // card
  card: {
    background: C.white,
    border: `1px solid ${C.border}`,
    borderRadius: 12,
    padding: 24,
    marginBottom: 20,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 700,
    color: C.ink,
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 13,
    color: C.gray,
    marginBottom: 20,
  },
  // table
  tableWrap: { overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  th: {
    background: C.grayBg,
    padding: '8px 12px',
    textAlign: 'left',
    fontWeight: 600,
    color: C.inkMid,
    borderBottom: `1px solid ${C.border}`,
    fontSize: 12,
    whiteSpace: 'nowrap',
  },
  td: {
    padding: '8px 12px',
    borderBottom: `1px solid ${C.border}`,
    color: C.ink,
    verticalAlign: 'top',
  },
  tdCode: {
    padding: '8px 12px',
    borderBottom: `1px solid ${C.border}`,
    color: C.rosaText,
    fontFamily: 'monospace',
    fontWeight: 600,
    fontSize: 13,
  },
  // badges
  badge: (variant) => {
    const map = {
      required:  { background: C.redBg,   color: C.red   },
      optional:  { background: C.grayBg,  color: C.gray  },
      ok:        { background: C.greenBg, color: C.green },
      error:     { background: C.redBg,   color: C.red   },
    }
    return {
      display: 'inline-block',
      padding: '2px 8px',
      borderRadius: 99,
      fontSize: 11,
      fontWeight: 600,
      ...(map[variant] || map.optional),
    }
  },
  // buttons
  primaryBtn: (disabled) => ({
    background: disabled ? C.border : C.rosa,
    color: disabled ? C.gray : C.white,
    border: 'none',
    borderRadius: 8,
    padding: '10px 22px',
    fontSize: 14,
    fontWeight: 600,
    cursor: disabled ? 'not-allowed' : 'pointer',
  }),
  ghostBtn: {
    background: 'transparent',
    color: C.rosaText,
    border: `1px solid ${C.rosa}`,
    borderRadius: 8,
    padding: '10px 22px',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
  },
  // drop zone
  dropzone: (dragging) => ({
    border: `2px dashed ${dragging ? C.rosa : C.borderDark}`,
    borderRadius: 12,
    padding: '48px 24px',
    textAlign: 'center',
    cursor: 'pointer',
    background: dragging ? C.rosaPale : C.grayBg,
    transition: 'border-color .15s, background .15s',
    marginBottom: 20,
  }),
  // banners
  banner: (variant) => {
    const map = {
      success: { background: C.greenBg, color: C.green,   border: `1px solid ${C.green}33` },
      error:   { background: C.redBg,   color: C.red,     border: `1px solid ${C.red}33`   },
      warning: { background: C.amberBg, color: C.warningText,   border: `1px solid ${C.amber}33` },
      info:    { background: C.blueBg,  color: C.blue,    border: `1px solid ${C.blue}33`  },
    }
    return {
      borderRadius: 8,
      padding: '10px 16px',
      fontSize: 14,
      fontWeight: 600,
      marginBottom: 16,
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      ...(map[variant] || map.info),
    }
  },
  // summary bar
  summaryBar: {
    display: 'flex',
    alignItems: 'center',
    gap: 20,
    padding: '12px 16px',
    background: C.grayBg,
    borderRadius: 8,
    marginBottom: 16,
    fontSize: 13,
    flexWrap: 'wrap',
  },
  // checkrow
  checkRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    marginBottom: 20,
    cursor: 'pointer',
    userSelect: 'none',
  },
  // progress
  progressTrack: {
    background: C.border,
    borderRadius: 99,
    height: 10,
    overflow: 'hidden',
    marginBottom: 8,
  },
  // error row cells
  tdError: {
    padding: '5px 12px 8px',
    color: C.red,
    fontSize: 12,
    fontStyle: 'italic',
    borderBottom: `1px solid ${C.border}`,
    background: C.redBg,
  },
  // btn row
  btnRow: {
    display: 'flex',
    gap: 12,
    flexWrap: 'wrap',
  },
  // result item
  resultItem: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 10,
    padding: '8px 0',
    borderBottom: `1px solid ${C.border}`,
    fontSize: 13,
  },
}

// ─── STEP BAR ─────────────────────────────────────────────────────────────────

const STEP_LABELS = ['Template', 'Upload', 'Review', 'Done']

function StepBar({ step }) {
  return (
    <div style={S.stepBar}>
      {STEP_LABELS.map((label, i) => {
        const num = i + 1
        const active = step === num
        const done = step > num
        return (
          <div key={label} style={{ display: 'flex', alignItems: 'center', flex: i < STEP_LABELS.length - 1 ? 1 : 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <div style={S.stepCircle(active, done)}>
                {done ? '✓' : num}
              </div>
              <span style={S.stepLabel(active, done)}>{label}</span>
            </div>
            {i < STEP_LABELS.length - 1 && <div style={S.stepLine(done)} />}
          </div>
        )
      })}
    </div>
  )
}

// ─── STEP 1 — TEMPLATE ────────────────────────────────────────────────────────

function Step1Template({ typeKey, onNext }) {
  const cfg = IMPORT_TYPES[typeKey]

  const handleDownload = () => {
    const blob = new Blob([cfg.template], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `belori_${typeKey}_template.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div>
      <div style={S.card}>
        <div style={S.cardTitle}>Step 1 — Download template</div>
        <div style={S.cardSubtitle}>
          Download the CSV template, fill it in with your data, then return here to upload.
        </div>
        <button style={S.primaryBtn(false)} onClick={handleDownload}>
          Download CSV template
        </button>
      </div>

      <div style={S.card}>
        <div style={S.cardTitle}>Expected columns</div>
        <div style={S.tableWrap}>
          <table style={S.table}>
            <thead>
              <tr>
                <th style={S.th}>Column</th>
                <th style={S.th}>Description</th>
                <th style={S.th}>Required?</th>
              </tr>
            </thead>
            <tbody>
              {cfg.columns.map(col => (
                <tr key={col.name}>
                  <td style={S.tdCode}>{col.name}</td>
                  <td style={S.td}>{col.desc}</td>
                  <td style={S.td}>
                    <span style={S.badge(col.required ? 'required' : 'optional')}>
                      {col.required ? 'Required' : 'Optional'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div style={S.btnRow}>
        <button style={S.primaryBtn(false)} onClick={onNext}>
          I have my file ready →
        </button>
      </div>
    </div>
  )
}

// ─── STEP 2 — UPLOAD ─────────────────────────────────────────────────────────

function Step2Upload({ typeKey, onNext }) {
  const [dragging, setDragging] = useState(false)
  const [parsed, setParsed] = useState(null)
  const [parseError, setParseError] = useState(null)
  const fileRef = useRef()

  const processFile = (file) => {
    if (!file) return
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setParseError('Please upload a .csv file.')
      setParsed(null)
      return
    }
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const { headers, rows } = parseCSV(e.target.result)
        if (rows.length === 0) {
          setParseError('No data rows found in the file.')
          setParsed(null)
          return
        }
        setParseError(null)
        setParsed({ headers, rows, fileName: file.name })
      } catch (err) {
        setParseError('Failed to parse CSV: ' + err.message)
        setParsed(null)
      }
    }
    reader.readAsText(file)
  }

  const onDrop = useCallback((e) => {
    e.preventDefault()
    setDragging(false)
    processFile(e.dataTransfer.files[0])
  }, [])

  const onDragOver = (e) => { e.preventDefault(); setDragging(true) }
  const onDragLeave = () => setDragging(false)

  const onFileChange = (e) => {
    processFile(e.target.files[0])
    e.target.value = ''
  }

  const preview = parsed ? parsed.rows.slice(0, 5) : []

  return (
    <div>
      <div style={S.card}>
        <div style={S.cardTitle}>Step 2 — Upload your file</div>
        <div style={S.cardSubtitle}>
          Drag and drop your CSV file, or click to browse. Only .csv files are accepted.
        </div>

        <div
          style={S.dropzone(dragging)}
          onDrop={onDrop}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onClick={() => fileRef.current?.click()}
        >
          <span style={{ fontSize: 36, display: 'block', marginBottom: 12 }}>📂</span>
          <div style={{ fontSize: 15, fontWeight: 600, color: C.ink, marginBottom: 4 }}>
            Drop your CSV here or click to browse
          </div>
          <div style={{ fontSize: 13, color: C.gray }}>Accepts .csv files only</div>
          <input
            ref={fileRef}
            type="file"
            accept=".csv"
            style={{ display: 'none' }}
            onChange={onFileChange}
          />
        </div>

        {parseError && (
          <div style={S.banner('error')}>{parseError}</div>
        )}

        {parsed && (
          <>
            <div style={S.banner('success')}>
              Parsed {parsed.rows.length} row{parsed.rows.length !== 1 ? 's' : ''} from &ldquo;{parsed.fileName}&rdquo;
            </div>
            {preview.length > 0 && (
              <>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.inkMid, marginBottom: 8 }}>
                  Preview — first {Math.min(5, parsed.rows.length)} rows
                </div>
                <div style={S.tableWrap}>
                  <table style={S.table}>
                    <thead>
                      <tr>
                        {parsed.headers.map(h => (
                          <th key={h} style={S.th}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {preview.map((row, i) => (
                        <tr key={i}>
                          {parsed.headers.map(h => (
                            <td key={h} style={S.td}>{row[h] ?? ''}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </>
        )}
      </div>

      <div style={S.btnRow}>
        <button
          style={S.primaryBtn(!parsed)}
          disabled={!parsed}
          onClick={() => parsed && onNext(parsed)}
        >
          Review &amp; Import →
        </button>
      </div>
    </div>
  )
}

// ─── STEP 3 — REVIEW ─────────────────────────────────────────────────────────

function Step3Review({ typeKey, parsed, onImport }) {
  const [skipErrors, setSkipErrors] = useState(false)
  const cfg = IMPORT_TYPES[typeKey]

  const validated = parsed.rows.map(row => ({
    row,
    errors: validateRow(row, typeKey),
  }))

  const validCount = validated.filter(v => v.errors.length === 0).length
  const errorCount = validated.filter(v => v.errors.length > 0).length
  const importCount = skipErrors ? validCount : (errorCount === 0 ? validCount : 0)
  const canImport = importCount > 0

  return (
    <div>
      <div style={S.card}>
        <div style={S.cardTitle}>Step 3 — Review &amp; validate</div>
        <div style={S.cardSubtitle}>
          Rows with validation errors are highlighted in red. Fix them in your CSV and re-upload, or skip them.
        </div>

        <div style={S.summaryBar}>
          <span style={{ color: C.green, fontWeight: 600 }}>
            {validCount} row{validCount !== 1 ? 's' : ''} ready to import
          </span>
          {errorCount > 0 && (
            <span style={{ color: C.red, fontWeight: 600 }}>
              {errorCount} row{errorCount !== 1 ? 's' : ''} have errors
            </span>
          )}
        </div>

        {errorCount > 0 && (
          <label style={S.checkRow}>
            <input
              type="checkbox"
              checked={skipErrors}
              onChange={e => setSkipErrors(e.target.checked)}
              style={{ accentColor: C.rosa, width: 16, height: 16, cursor: 'pointer' }}
            />
            <span style={{ fontSize: 14, color: C.ink }}>
              Skip rows with errors and import valid rows only
            </span>
          </label>
        )}

        <div style={S.tableWrap}>
          <table style={S.table}>
            <thead>
              <tr>
                <th style={S.th}>#</th>
                {cfg.columns.map(col => (
                  <th key={col.name} style={S.th}>{col.name}</th>
                ))}
                <th style={S.th}>Status</th>
              </tr>
            </thead>
            <tbody>
              {validated.map(({ row, errors }, i) => {
                const hasError = errors.length > 0
                const rowBg = hasError ? C.redBg : undefined
                return (
                  <>
                    <tr key={`r-${i}`} style={{ background: rowBg }}>
                      <td style={{ ...S.td, background: rowBg }}>{row._rowIndex}</td>
                      {cfg.columns.map(col => (
                        <td key={col.name} style={{ ...S.td, background: rowBg }}>
                          {row[col.name] ?? ''}
                        </td>
                      ))}
                      <td style={{ ...S.td, background: rowBg }}>
                        {hasError
                          ? <span style={S.badge('error')}>Error</span>
                          : <span style={S.badge('ok')}>OK</span>
                        }
                      </td>
                    </tr>
                    {hasError && (
                      <tr key={`e-${i}`}>
                        <td style={S.tdError} />
                        <td colSpan={cfg.columns.length + 1} style={S.tdError}>
                          {errors.join(' · ')}
                        </td>
                      </tr>
                    )}
                  </>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div style={S.btnRow}>
        <button
          style={S.primaryBtn(!canImport)}
          disabled={!canImport}
          onClick={() => canImport && onImport(validated, skipErrors)}
        >
          Import {importCount} row{importCount !== 1 ? 's' : ''}
        </button>
      </div>
    </div>
  )
}

// ─── IMPORTING VIEW ───────────────────────────────────────────────────────────

function ImportingView({ progress }) {
  return (
    <div style={S.card}>
      <div style={S.cardTitle}>Importing...</div>
      <div style={S.cardSubtitle}>Please wait while records are inserted into the database.</div>
      <div style={S.progressTrack}>
        <div style={{
          height: '100%',
          width: `${progress}%`,
          background: C.rosa,
          borderRadius: 99,
          transition: 'width .3s ease',
        }} />
      </div>
      <div style={{ fontSize: 13, color: C.gray, marginTop: 4 }}>{progress}% complete</div>
    </div>
  )
}

// ─── STEP 4 — RESULTS ─────────────────────────────────────────────────────────

function Step4Results({ typeKey, results, onReset, setScreen }) {
  const cfg = IMPORT_TYPES[typeKey]
  const { inserted, skipped, skippedDetails, dbErrors } = results

  return (
    <div>
      <div style={S.card}>
        <div style={S.cardTitle}>Import complete</div>
        <div style={S.cardSubtitle}>Here is a summary of what happened.</div>

        {inserted > 0 && (
          <div style={S.banner('success')}>
            {inserted} record{inserted !== 1 ? 's' : ''} imported successfully
          </div>
        )}

        {skipped > 0 && (
          <div style={S.banner('warning')}>
            {skipped} row{skipped !== 1 ? 's' : ''} skipped due to validation errors
          </div>
        )}

        {dbErrors && dbErrors.length > 0 && (
          <div style={S.banner('error')}>
            {dbErrors.length} row{dbErrors.length !== 1 ? 's' : ''} failed during database insert
          </div>
        )}

        {skippedDetails && skippedDetails.length > 0 && (
          <div style={{ marginTop: 8 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.inkMid, marginBottom: 8 }}>
              Skipped rows (validation errors)
            </div>
            {skippedDetails.map((item, i) => (
              <div key={i} style={S.resultItem}>
                <span style={{ color: C.red, fontWeight: 600, flexShrink: 0 }}>Row {item.rowIndex}</span>
                <span style={{ color: C.gray }}>{item.message}</span>
              </div>
            ))}
          </div>
        )}

        {dbErrors && dbErrors.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.red, marginBottom: 8 }}>
              Database errors
            </div>
            {dbErrors.map((item, i) => (
              <div key={i} style={S.resultItem}>
                <span style={{ color: C.red, fontWeight: 600, flexShrink: 0 }}>
                  {item.rowIndex > 1 ? `Row ${item.rowIndex}` : 'Error'}
                </span>
                <span style={{ color: C.gray }}>{item.message}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={S.btnRow}>
        <button style={S.ghostBtn} onClick={onReset}>
          Import another file
        </button>
        <button style={S.primaryBtn(false)} onClick={() => setScreen(cfg.screen)}>
          View imported {cfg.label.toLowerCase()}
        </button>
      </div>
    </div>
  )
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────

export default function ImportPage({ setScreen }) {
  const { boutique } = useAuth()
  const [typeKey, setTypeKey] = useState('clients')
  const [step, setStep] = useState(1)
  const [parsedData, setParsedData] = useState(null)
  const [importing, setImporting] = useState(false)
  const [importProgress, setImportProgress] = useState(0)
  const [importResults, setImportResults] = useState(null)

  const reset = () => {
    setStep(1)
    setParsedData(null)
    setImporting(false)
    setImportProgress(0)
    setImportResults(null)
  }

  const handleTypeChange = (key) => {
    setTypeKey(key)
    reset()
  }

  const handleUploadDone = (parsed) => {
    setParsedData(parsed)
    setStep(3)
  }

  const handleImport = async (validated, skipErrors) => {
    const boutiqueId = boutique?.id
    if (!boutiqueId) return

    const rowsToImport = validated.filter(v => skipErrors ? v.errors.length === 0 : v.errors.length === 0)
    const skippedDetails = validated
      .filter(v => v.errors.length > 0)
      .map(v => ({ rowIndex: v.row._rowIndex, message: v.errors.join(', ') }))

    setImporting(true)
    setImportProgress(0)

    const onProgress = (done, total) => {
      setImportProgress(Math.round((done / total) * 100))
    }

    try {
      let dbResult

      if (typeKey === 'clients') {
        const records = rowsToImport.map(({ row }) => ({
          boutique_id: boutiqueId,
          name: row.name?.trim() || '',
          phone: row.phone?.trim() || null,
          email: row.email?.trim() || null,
          partner_name: row.partner_name?.trim() || null,
        }))
        dbResult = await insertInBatches(records, 'clients', 50, onProgress)

      } else if (typeKey === 'inventory') {
        const records = rowsToImport.map(({ row }) => {
          const qty = parseInt(row.quantity, 10) || 1
          return {
            boutique_id: boutiqueId,
            sku: row.sku?.trim() || '',
            name: row.name?.trim() || '',
            category: row.category?.trim() || '',
            color: row.color?.trim() || null,
            size: row.size?.trim() || null,
            price: row.price?.trim() ? parseFloat(row.price) : null,
            status: 'available',
            track: 'item',
            currentStock: qty,
            totalQty: qty,
            availQty: qty,
            reservedQty: 0,
            outQty: 0,
            dmgQty: 0,
          }
        })
        dbResult = await insertInBatches(records, 'inventory', 50, onProgress)

      } else if (typeKey === 'events') {
        // Fetch existing clients once, then resolve/create per row
        const { data: existingClients } = await supabase
          .from('clients')
          .select('id, name')
          .eq('boutique_id', boutiqueId)

        const clientMap = {}
        ;(existingClients || []).forEach(c => {
          clientMap[c.name.trim().toLowerCase()] = c.id
        })

        let inserted = 0
        const errors = []
        const total = rowsToImport.length

        for (let i = 0; i < total; i += 50) {
          const batch = rowsToImport.slice(i, i + 50)
          for (const { row } of batch) {
            const key = (row.client_name || '').trim().toLowerCase()
            let clientId = clientMap[key]

            if (!clientId) {
              const { data: newClient, error: cErr } = await supabase
                .from('clients')
                .insert({ boutique_id: boutiqueId, name: row.client_name.trim() })
                .select('id')
                .single()
              if (cErr) {
                errors.push({ rowIndex: row._rowIndex, message: `Could not create client: ${cErr.message}` })
                continue
              }
              clientId = newClient.id
              clientMap[key] = clientId
            }

            const { error: eErr } = await supabase.from('events').insert({
              boutique_id: boutiqueId,
              client_id: clientId,
              type: row.type?.trim() || 'other',
              event_date: row.event_date?.trim() || null,
              venue: row.venue?.trim() || null,
              guests: row.guests?.trim() ? parseInt(row.guests, 10) : null,
              total: row.total?.trim() ? parseFloat(row.total) : null,
              status: 'active',
              paid: 0,
            })

            if (eErr) {
              errors.push({ rowIndex: row._rowIndex, message: eErr.message })
            } else {
              inserted++
            }
          }
          onProgress(Math.min(i + 50, total), total)
          if (i + 50 < total) await sleep(100)
        }

        dbResult = { inserted, errors }
      }

      setImportResults({
        inserted: dbResult.inserted,
        skipped: skippedDetails.length,
        skippedDetails,
        dbErrors: dbResult.errors,
      })
      setImporting(false)
      setStep(4)

    } catch (err) {
      setImporting(false)
      setImportResults({
        inserted: 0,
        skipped: rowsToImport.length,
        skippedDetails: [],
        dbErrors: [{ rowIndex: 0, message: err.message }],
      })
      setStep(4)
    }
  }

  return (
    <div style={S.page}>
      {/* Topbar */}
      <div style={S.topbar}>
        <span style={{ fontSize: 20 }}>📥</span>
        <span style={S.topbarTitle}>Bulk Import</span>
      </div>

      <div style={S.body}>
        {/* Import type selector */}
        <div style={S.sectionLabel}>Import type</div>
        <div style={S.typeGrid}>
          {Object.entries(IMPORT_TYPES).map(([key, cfg]) => (
            <div
              key={key}
              style={S.typeCard(typeKey === key)}
              onClick={() => handleTypeChange(key)}
            >
              <span style={S.typeIcon}>{cfg.icon}</span>
              <div style={S.typeName(typeKey === key)}>{cfg.label}</div>
              <div style={S.typeDesc}>{cfg.description}</div>
            </div>
          ))}
        </div>

        {/* Step progress bar */}
        <StepBar step={step} />

        {/* Step content */}
        {importing ? (
          <ImportingView progress={importProgress} />
        ) : step === 1 ? (
          <Step1Template typeKey={typeKey} onNext={() => setStep(2)} />
        ) : step === 2 ? (
          <Step2Upload typeKey={typeKey} onNext={handleUploadDone} />
        ) : step === 3 && parsedData ? (
          <Step3Review typeKey={typeKey} parsed={parsedData} onImport={handleImport} />
        ) : step === 4 && importResults ? (
          <Step4Results
            typeKey={typeKey}
            results={importResults}
            onReset={reset}
            setScreen={setScreen}
          />
        ) : null}
      </div>
    </div>
  )
}
