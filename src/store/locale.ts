import { create } from 'zustand'
import { useCallback } from 'react'
import { Locale, translations, LOCALE_OPTIONS } from '../i18n/translations'

const STORAGE_KEY = 'nx036-locale'

function autodetect(): Locale {
  // Idiomas ilimitados: se acepta cualquier código almacenado; los que no tengan diccionario de UI
  // hacen fallback a inglés (ver t()/useT()). El contenido de producto se traduce por separado.
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored) return stored
  try {
    return (navigator.language || 'en').split('-')[0] || 'en'
  } catch {}
  return 'en'
}

interface LocaleState {
  locale: Locale
  setLocale: (l: Locale) => void
  t: (key: string) => string
}

export const useLocaleStore = create<LocaleState>((set, get) => ({
  locale: autodetect(),
  setLocale(l) {
    localStorage.setItem(STORAGE_KEY, l)
    set({ locale: l })
  },
  t(key) {
    const cur = get().locale
    return translations[cur]?.[key] ?? translations.en[key] ?? key
  },
}))

/**
 * Reactive translation hook. Subscribes to `locale` so components re-render
 * whenever the user switches language. Use this everywhere instead of
 * `useLocaleStore((s) => s.t)` — the latter returns a stable function reference
 * and won't trigger re-renders when locale changes.
 */
export function useT() {
  const locale = useLocaleStore((s) => s.locale)
  return useCallback(
    (key: string) => translations[locale]?.[key] ?? translations.en[key] ?? key,
    [locale],
  )
}

export { LOCALE_OPTIONS } from '../i18n/translations'
export type { Locale } from '../i18n/translations'
