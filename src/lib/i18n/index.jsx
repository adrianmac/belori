import { createContext, useContext, useEffect, useState } from 'react'
import en from './en.js'
import es from './es.js'

const translations = { en, es }

const I18nContext = createContext({ t: (k) => k, lang: 'en', setLang: () => {} })

export function I18nProvider({ children, initialLang = 'en' }) {
  const [lang, setLang] = useState(initialLang)

  // Sync <html lang> with the active UI language — important for screen readers,
  // browser translate prompts, and hyphenation dictionaries.
  useEffect(() => {
    if (typeof document !== 'undefined' && lang) {
      document.documentElement.lang = lang
    }
  }, [lang])

  function t(key, vars = {}) {
    const dict = translations[lang] || translations.en
    let str = dict[key] || translations.en[key] || key
    // Replace {{var}} placeholders
    for (const [k, v] of Object.entries(vars)) {
      str = str.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), v)
    }
    return str
  }

  return (
    <I18nContext.Provider value={{ t, lang, setLang }}>
      {children}
    </I18nContext.Provider>
  )
}

export function useI18n() {
  return useContext(I18nContext)
}

export { en, es }
