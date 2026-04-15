import React from 'react'
import { bilabel, isBilingual } from '../../lib/i18n'
import { C } from '../../lib/colors'

/**
 * Renders a bilingual label: English primary, Spanish secondary.
 * When lang pref is 'en', only English is shown.
 *
 * Props:
 *   labelKey   — key from LABELS map (e.g. 'consultation')
 *   en         — override English text (if not using labelKey)
 *   es         — override Spanish text
 *   enStyle    — extra style for English div
 *   esStyle    — extra style for Spanish div
 *   inline     — if true, renders as a single <span> with " / " separator
 */
export function BiLabel({ labelKey, en, es, enStyle, esStyle, inline }) {
  const labels = labelKey ? bilabel(labelKey) : { en: en || '', es: es || '' }
  const showEs = isBilingual() && labels.es

  if (inline) {
    return (
      <span>
        <span style={{ fontWeight: 500, ...enStyle }}>{labels.en}</span>
        {showEs && (
          <span style={{ fontSize: '0.85em', color: C.gray, marginLeft: 4, ...esStyle }}>
            / {labels.es}
          </span>
        )}
      </span>
    )
  }

  return (
    <div>
      <div style={{ fontWeight: 500, color: C.ink, ...enStyle }}>{labels.en}</div>
      {showEs && (
        <div style={{ fontSize: 11, color: C.gray, marginTop: 2, ...esStyle }}>{labels.es}</div>
      )}
    </div>
  )
}
