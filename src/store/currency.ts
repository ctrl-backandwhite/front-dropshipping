import { create } from 'zustand'
import { api } from '../api/client'

export interface Currency {
  code: string
  name: string
  symbol: string
  countryCode?: string
  flagEmoji?: string
  locale?: string
  rateVsUsd: number
  active: boolean
}

interface CurrencyState {
  currencies: Currency[]
  current: string
  loading: boolean
  initialized: boolean
  init: () => Promise<void>
  setCurrency: (code: string) => void
  format: (amount: number | null | undefined, fromCcy?: string | null) => string
  convert: (amount: number, fromCcy?: string | null) => number
}

const STORAGE_KEY = 'nx036-currency'

// Country → preferred currency (subset, easy to extend)
const COUNTRY_CCY: Record<string, string> = {
  US: 'USD', CA: 'CAD', MX: 'MXN', GT: 'USD', HN: 'USD',
  CO: 'COP', VE: 'USD', BR: 'BRL', AR: 'ARS', CL: 'CLP', PE: 'PEN', UY: 'USD',
  ES: 'EUR', FR: 'EUR', DE: 'EUR', IT: 'EUR', PT: 'EUR', NL: 'EUR', BE: 'EUR',
  IE: 'EUR', AT: 'EUR', FI: 'EUR', GR: 'EUR',
  GB: 'GBP', JP: 'JPY', CN: 'CNY', HK: 'HKD', SG: 'SGD', KR: 'KRW',
  AU: 'AUD', NZ: 'AUD', IN: 'INR', CH: 'CHF',
  SE: 'SEK', NO: 'NOK', DK: 'DKK', PL: 'PLN', TR: 'TRY', ZA: 'ZAR', AE: 'AED',
}

function autodetect(): string {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored) return stored
  let ccy = 'USD'
  try {
    const lang = navigator.language || 'en-US'
    const cc = (lang.split('-')[1] || 'US').toUpperCase()
    ccy = COUNTRY_CCY[cc] || 'USD'
  } catch {
    ccy = 'USD'
  }
  // IMPORTANTE: persistimos la moneda detectada para que el cliente API (que lee esta MISMA clave
  // de localStorage para la cabecera X-Currency) formatee los precios en la moneda correcta. Sin
  // esto, un visitante nuevo veía el selector en su moneda pero los precios del backend en USD.
  try { localStorage.setItem(STORAGE_KEY, ccy) } catch { /* ignore */ }
  return ccy
}

export const useCurrencyStore = create<CurrencyState>((set, get) => ({
  currencies: [],
  current: autodetect(),
  loading: false,
  initialized: false,

  async init() {
    if (get().initialized) return
    set({ loading: true })
    try {
      const { data } = await api.get<Currency[]>('/storefront/currency/rates')
      set({ currencies: data, initialized: true })
      // Make sure 'current' is valid
      const cur = get().current
      if (!data.some((c) => c.code === cur)) {
        set({ current: 'USD' })
      }
    } catch {
      set({ initialized: true })
    } finally {
      set({ loading: false })
    }
  },

  setCurrency(code: string) {
    localStorage.setItem(STORAGE_KEY, code)
    set({ current: code })
  },

  convert(amount, fromCcy) {
    if (amount == null || !isFinite(amount)) return 0
    const list = get().currencies
    const target = get().current
    if (!fromCcy || fromCcy === target) return amount
    const from = list.find((c) => c.code === fromCcy)
    const to = list.find((c) => c.code === target)
    // rateVsUsd = unidades de la divisa por 1 USD (USD=1, EUR=0.92, CNY=7.24), igual que el backend.
    // Por tanto: amountUsd = amount / rateVsUsd(from); targetAmount = amountUsd * rateVsUsd(to).
    const rFrom = from?.rateVsUsd ?? 1
    const rTo = to?.rateVsUsd ?? 1
    if (!rFrom || !rTo) return amount
    return (amount / rFrom) * rTo
  },

  format(amount, fromCcy) {
    if (amount == null) return '—'
    const converted = get().convert(amount, fromCcy)
    const cur = get().currencies.find((c) => c.code === get().current)
    const code = cur?.code ?? get().current
    // DROP-636: locale coherente SIEMPRE. Si el registro de moneda no trae
    // `locale` (la causa de que EUR se formatease "EUR14.90" a la anglosajona),
    // derivamos uno sensato por código de divisa en vez de caer a en-US.
    const locale = cur?.locale ?? localeForCurrency(code)
    try {
      return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: code,
        maximumFractionDigits: code === 'JPY' || code === 'KRW' ? 0 : 2,
      }).format(converted)
    } catch {
      // Fallback localizado: número en el locale derivado + código de moneda
      // detrás (formato europeo "14,90 EUR"), nunca el símbolo pegado a la izda.
      const digits = code === 'JPY' || code === 'KRW' ? 0 : 2
      const num = new Intl.NumberFormat(locale, {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      }).format(converted)
      return `${num} ${code}`
    }
  },
}))

// DROP-636: mapa mínimo código→locale para formatear de forma localizada cuando
// el backend no provee `locale` en el registro de moneda.
const CCY_LOCALE: Record<string, string> = {
  USD: 'en-US', CAD: 'en-CA', MXN: 'es-MX', COP: 'es-CO', BRL: 'pt-BR',
  ARS: 'es-AR', CLP: 'es-CL', PEN: 'es-PE',
  EUR: 'es-ES', GBP: 'en-GB', JPY: 'ja-JP', CNY: 'zh-CN', HKD: 'zh-HK',
  SGD: 'en-SG', KRW: 'ko-KR', AUD: 'en-AU', INR: 'en-IN', CHF: 'de-CH',
  SEK: 'sv-SE', NOK: 'nb-NO', DKK: 'da-DK', PLN: 'pl-PL', TRY: 'tr-TR',
  ZAR: 'en-ZA', AED: 'ar-AE',
}
function localeForCurrency(code: string): string {
  return CCY_LOCALE[code] ?? 'en-US'
}
