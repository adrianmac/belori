import { createContext, useContext, useState } from 'react'
import en from './en.js'
import es from './es.js'

const translations = { en, es }

const I18nContext = createContext({ t: (k) => k, lang: 'en', setLang: () => {} })

export function I18nProvider({ children, initialLang = 'en' }) {
  const [lang, setLang] = useState(initialLang)

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
