import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faChartLine, faTriangleExclamation } from '@fortawesome/free-solid-svg-icons'
import { getMarginEstimate } from '../api/catalog'
import { useT, useLocaleStore } from '../store/locale'
import { useCurrencyStore } from '../store/currency'

const COUNTRIES = ['ES', 'US', 'MX', 'BR', 'GB', 'DE', 'FR', 'IT']
const COUNTRY_NAMES: Record<string, Record<string, string>> = {
  es: { ES: 'España', US: 'Estados Unidos', MX: 'México', BR: 'Brasil', GB: 'Reino Unido', DE: 'Alemania', FR: 'Francia', IT: 'Italia' },
  en: { ES: 'Spain',  US: 'United States',  MX: 'Mexico', BR: 'Brazil', GB: 'United Kingdom', DE: 'Germany', FR: 'France', IT: 'Italy' },
  pt: { ES: 'Espanha', US: 'Estados Unidos', MX: 'México', BR: 'Brasil', GB: 'Reino Unido', DE: 'Alemanha', FR: 'França', IT: 'Itália' },
  zh: { ES: '西班牙', US: '美国', MX: '墨西哥', BR: '巴西', GB: '英国', DE: '德国', FR: '法国', IT: '意大利' },
}

export function MarginEstimate({ productId }: { productId: string }) {
  const t = useT()
  const lang = useLocaleStore((s) => s.locale)
  const format = useCurrencyStore((s) => s.format)
  const [country, setCountry] = useState('ES')
  const [qty, setQty] = useState(1)
  const { data, isLoading } = useQuery({
    queryKey: ['margin', productId, country, qty],
    queryFn: () => getMarginEstimate(productId, country, qty),
  })

  // DROP-678: el backend ya devuelve los importes en la moneda activa (data.currency) usando el
  // tramo de precio real y la regla de margen configurada. Solo se formatea, no se reconvierte.
  const ccy = (data as any)?.currency || 'USD'
  const fmt = (v: any) => format(Number(v), ccy)
  const marginPct = data ? Number(data.marginPct) : 0
  const appliedMarginPct = data && (data as any).appliedMarginPct != null ? Number((data as any).appliedMarginPct) : null
  const appliedTierMinQty = data ? (data as any).appliedTierMinQty : null
  const isLow = data && marginPct < 5
  const isNegative = data && marginPct < 0

  return (
    <div className="card p-5">
      <h3 className="!m-0 flex items-center gap-2">
        <FontAwesomeIcon icon={faChartLine} className="text-brand-500" />
        {t('catalog.detail.margin.title')}
      </h3>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-[12px]">
        <label>
          <span className="text-ink-500 mr-1">{t('catalog.detail.margin.country')}:</span>
          <select value={country} onChange={(e) => setCountry(e.target.value)}
            className="border border-ink-200 rounded px-2 py-1">
            {COUNTRIES.map((c) => (
              <option key={c} value={c}>{COUNTRY_NAMES[lang]?.[c] ?? COUNTRY_NAMES.en[c] ?? c}</option>
            ))}
          </select>
        </label>
        <label>
          <span className="text-ink-500 mr-1">{t('product.qty')}:</span>
          <input type="number" min={1} value={qty}
            onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))}
            className="border border-ink-200 rounded px-2 py-1 w-16" />
        </label>
      </div>
      {isLoading || !data ? (
        <div className="mt-3 h-24 bg-ink-50 rounded animate-pulse" />
      ) : (
        <>
          {isNegative && (
            <div className="mt-3 px-3 py-2 rounded-md bg-red-50 border border-red-200 text-[12px] text-red-700 flex items-start gap-2">
              <FontAwesomeIcon icon={faTriangleExclamation} className="mt-0.5" />
              <span>{t('catalog.detail.margin.warning_negative')}</span>
            </div>
          )}
          {!isNegative && isLow && (
            <div className="mt-3 px-3 py-2 rounded-md bg-amber-50 border border-amber-200 text-[12px] text-amber-800 flex items-start gap-2">
              <FontAwesomeIcon icon={faTriangleExclamation} className="mt-0.5" />
              <span>{t('catalog.detail.margin.warning_low')}</span>
            </div>
          )}
          <dl className="grid grid-cols-2 gap-y-1.5 mt-4 text-[13px]">
            <dt className="text-ink-500">{t('catalog.detail.margin.suggested_retail')}</dt>
            <dd className="text-right font-medium">{fmt(data.suggestedRetail)}</dd>
            <dt className="text-ink-500">{t('catalog.detail.margin.cost')}</dt>
            <dd className="text-right">−{fmt(data.cost)}</dd>
            <dt className="text-ink-500">{t('catalog.detail.margin.shipping')}</dt>
            <dd className="text-right">−{fmt(data.shipping)}</dd>
            <dt className="text-ink-500">{t('catalog.detail.margin.commission')}</dt>
            <dd className="text-right">−{fmt(data.commission)}</dd>
            <dt className="font-medium pt-1 border-t border-ink-100">{t('catalog.detail.margin.net_profit')}</dt>
            <dd className={`text-right font-medium pt-1 border-t border-ink-100 ${marginPct < 0 ? 'text-red-700' : 'text-emerald-700'}`}>
              {fmt(data.netProfit)}
            </dd>
            <dt className="text-ink-500">{t('catalog.detail.margin.margin_pct')}</dt>
            <dd className={`text-right ${marginPct < 0 ? 'text-red-700' : 'text-emerald-700'}`}>{marginPct.toFixed(1)}%</dd>
          </dl>
          {/* Trazabilidad de los datos reales usados en el cálculo. */}
          <div className="mt-3 text-[11px] text-ink-400 space-y-0.5">
            {appliedMarginPct != null && (
              <div>{t('catalog.detail.margin.applied_rule')}: +{appliedMarginPct.toFixed(0)}%</div>
            )}
            {appliedTierMinQty != null && (
              <div>{t('catalog.detail.margin.applied_tier')}: ≥{appliedTierMinQty} {t('product.qty').toLowerCase()}</div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
