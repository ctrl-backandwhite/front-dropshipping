import { useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useCurrencyStore } from '../store/currency'
import { useLocaleStore } from '../store/locale'
import { useT } from '../store/locale'
import { REGIONS, findRegion, Region } from '../i18n/regions'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faChevronDown, faMagnifyingGlass } from '@fortawesome/free-solid-svg-icons'

/**
 * Unified region picker: choosing a region sets BOTH the storefront currency and the UI
 * locale at once. Replaces the previous split language + currency dropdowns.
 *
 * Currency change forces a soft reload so server-rendered prices refresh via the
 * X-Currency header. Locale change is fully reactive (see useT()) — no reload needed.
 */
export function CurrencyLanguagePicker({ placement = 'down', fullWidth = false }: {
  /** Hacia dónde abre el panel. 'up' para el cajón móvil (el botón está abajo del todo). */
  placement?: 'down' | 'up'
  /** El botón ocupa todo el ancho (útil en el cajón móvil). */
  fullWidth?: boolean
} = {}) {
  const { current: currency, init, initialized, setCurrency } = useCurrencyStore()
  const { locale, setLocale } = useLocaleStore()
  const t = useT()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => { if (!initialized) init() }, [initialized, init])

  // Click-outside to close
  useEffect(() => {
    if (!open) return
    function onDocClick(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [open])

  const active = findRegion(currency, locale) ?? REGIONS[0]
  const filtered = query
    ? REGIONS.filter((r) =>
        r.countryLabel.toLowerCase().includes(query.toLowerCase()) ||
        r.currency.toLowerCase().includes(query.toLowerCase()) ||
        r.locale.toLowerCase().includes(query.toLowerCase()))
    : REGIONS

  function pick(r: Region) {
    const localeChanged = r.locale !== locale
    setLocale(r.locale)
    setOpen(false)
    setQuery('')
    if (r.currency !== currency) {
      setCurrency(r.currency)
      window.location.reload()
    } else if (localeChanged) {
      // DROP-462/398: si solo cambió el idioma, invalidamos toda la caché de
      // React Query para que los textos backend (categorías, productos, etc.)
      // se re-traigan con el nuevo Accept-Language.
      queryClient.invalidateQueries()
    }
  }

  return (
    <div ref={ref} className={`relative ${fullWidth ? 'w-full' : ''}`}>
      <button
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-ink-200 hover:border-ink-300 text-[13px] transition-colors ${fullWidth ? 'w-full' : ''}`}
        title={`${active.countryLabel} · ${active.currency} · ${active.locale.toUpperCase()}`}
      >
        {/* DROP-568: contraste — antes el código de idioma estaba en ink-500
            (~3.5:1) que falla WCAG AA en light mode. Subimos a ink-700 (>7:1).
            En dark mode el theme overlay hereda el contraste correcto. */}
        <span className="text-base leading-none">{active.flag}</span>
        {/* En modo fullWidth (cajón móvil) mostramos país + moneda para que se entienda qué es. */}
        {fullWidth && <span className="text-[12px] text-ink-700 dark:text-ink-200">{active.countryLabel}</span>}
        <span className={`${fullWidth ? 'inline' : 'hidden sm:inline'} font-mono text-[11px] text-ink-700 dark:text-ink-200 font-medium`}>{active.currency}</span>
        <span className="hidden md:inline text-[11px] text-ink-400 dark:text-ink-500">·</span>
        <span className="hidden md:inline font-mono text-[11px] text-ink-700 dark:text-ink-200 font-medium">{active.locale.toUpperCase()}</span>
        <FontAwesomeIcon icon={faChevronDown} className={`text-[9px] text-ink-500 dark:text-ink-400 ${fullWidth ? 'ml-auto' : ''}`} />
      </button>
      {open && (
        <div className={`absolute right-0 ${placement === 'up' ? 'bottom-full mb-1' : 'top-full mt-1'} w-[90vw] max-w-xs bg-white border border-ink-200 rounded-md shadow-md z-50 overflow-hidden`}>
          <div className="px-2 py-2 border-b border-ink-100">
            <div className="flex items-center gap-1.5 bg-ink-50 rounded px-2 py-1">
              <FontAwesomeIcon icon={faMagnifyingGlass} className="text-[10px] text-ink-400" />
              <input autoFocus
                     value={query}
                     onChange={(e) => setQuery(e.target.value)}
                     placeholder={t('picker.search')}
                     className="bg-transparent outline-none text-[12px] flex-1" />
            </div>
          </div>
          {/* Un único contenedor con scroll: región/moneda + idiomas (evita scrolls anidados). */}
          <div className="max-h-[60vh] overflow-y-auto py-1">
            <div className="px-3 py-1 text-[10px] uppercase tracking-wide text-ink-400">{t('picker.country_currency')}</div>
            {filtered.length === 0 && (
              <div className="px-3 py-4 text-center text-[11px] text-ink-400">{t('picker.no_results')}</div>
            )}
            {filtered.map((r) => {
              const isActive = r.countryCode === active.countryCode &&
                               r.currency === active.currency &&
                               r.locale === active.locale
              return (
                <button key={r.countryCode + r.locale}
                        onClick={() => pick(r)}
                        className={`w-full px-3 py-1.5 text-left text-[12px] flex items-center gap-2 hover:bg-ink-50 ${
                          isActive ? 'bg-brand-50 text-brand-700' : 'text-ink-700'
                        }`}>
                  <span className="text-base leading-none">{r.flag}</span>
                  <span className="flex-1 truncate">{r.countryLabel}</span>
                  <span className="font-mono text-[11px] text-ink-700 dark:text-ink-200 font-medium">{r.currency}</span>
                  <span className="font-mono text-[11px] text-ink-600 dark:text-ink-300 font-medium">{r.locale.toUpperCase()}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
