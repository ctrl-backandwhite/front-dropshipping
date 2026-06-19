import { useQuery } from '@tanstack/react-query'
import { getPriceHistory } from '../api/catalog'
import { useT } from '../store/locale'
import { useCurrencyStore } from '../store/currency'

/** Lightweight SVG chart (no recharts dependency) — DROP-25 */
export function PriceHistoryChart({ productId, days = 90, height = 160 }: { productId: string; days?: number; height?: number }) {
  const t = useT()
  const format = useCurrencyStore((s) => s.format)
  const { data = [], isLoading } = useQuery({
    queryKey: ['price-history', productId, days],
    queryFn: () => getPriceHistory(productId, days),
  })

  if (isLoading) {
    return (
      <div className="card p-5">
        <h3>{t('catalog.detail.history.title')}</h3>
        <div className="mt-3 h-[160px] bg-ink-50 rounded animate-pulse" />
      </div>
    )
  }
  if (data.length === 0) return null

  const prices = data.map((p) => Number(p.price))
  const stocks = data.map((p) => p.stock)
  const minP = Math.min(...prices), maxP = Math.max(...prices)
  const maxS = Math.max(...stocks, 1)
  const w = 600 // viewBox width, scales via SVG
  const padX = 30, padY = 14
  const innerW = w - padX * 2
  const innerH = height - padY * 2

  function priceY(v: number) {
    if (maxP === minP) return padY + innerH / 2
    return padY + innerH - ((v - minP) / (maxP - minP)) * innerH
  }
  function stockY(v: number) {
    return padY + innerH - (v / maxS) * innerH
  }
  function x(i: number) { return padX + (i / Math.max(1, data.length - 1)) * innerW }

  const pricePath = data.map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${priceY(Number(p.price)).toFixed(1)}`).join(' ')
  const stockPath = data.map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${stockY(p.stock).toFixed(1)}`).join(' ')
  const last = data[data.length - 1]
  const first = data[0]
  const deltaPct = first.price > 0 ? ((Number(last.price) - Number(first.price)) / Number(first.price)) * 100 : 0

  return (
    <div className="card p-5">
      <div className="flex items-baseline justify-between mb-3">
        <h3 className="!m-0">{t('catalog.detail.history.title')}</h3>
        <div className="text-[12px] text-ink-500">
          {format(Number(first.price), 'USD')} → {format(Number(last.price), 'USD')}
          <span className={`ml-2 ${deltaPct >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
            {deltaPct >= 0 ? '+' : ''}{deltaPct.toFixed(1)}%
          </span>
        </div>
      </div>
      <svg viewBox={`0 0 ${w} ${height}`} className="w-full">
        {/* Grid lines */}
        <line x1={padX} y1={padY} x2={padX} y2={height - padY} stroke="var(--color-ink-100)" />
        <line x1={padX} y1={height - padY} x2={w - padX} y2={height - padY} stroke="var(--color-ink-100)" />
        {/* Stock area (under price) */}
        <path d={stockPath} fill="none" stroke="var(--color-ink-300)" strokeWidth={1} strokeDasharray="3 3" />
        {/* Price line */}
        <path d={pricePath} fill="none" stroke="var(--color-brand-600)" strokeWidth={1.8} />
        {/* Axis labels */}
        <text x={padX - 4} y={padY + 4} textAnchor="end" fontSize="9" fill="var(--color-ink-500)">{format(maxP, 'USD')}</text>
        <text x={padX - 4} y={height - padY} textAnchor="end" fontSize="9" fill="var(--color-ink-500)">{format(minP, 'USD')}</text>
        <text x={padX} y={height - 2} fontSize="9" fill="var(--color-ink-500)">{first.date}</text>
        <text x={w - padX} y={height - 2} textAnchor="end" fontSize="9" fill="var(--color-ink-500)">{last.date}</text>
      </svg>
      <div className="flex items-center gap-3 text-[11px] text-ink-500 mt-2">
        <span><span className="inline-block w-3 h-[2px] bg-brand-600 align-middle mr-1" />{t('catalog.detail.history.price')}</span>
        <span><span className="inline-block w-3 h-[2px] bg-ink-300 align-middle mr-1" style={{ borderTop: '1px dashed' }} />{t('catalog.detail.history.stock')}</span>
      </div>
    </div>
  )
}
