import { useQuery } from '@tanstack/react-query'
import { admin } from '../api/admin'
import { useT } from '../store/locale'
import { useCurrencyStore } from '../store/currency'

/** Construye el eje de los últimos N días (claves "YYYY-MM-DD") en orden ascendente. */
function lastDays(n: number): string[] {
  const out: string[] = []
  const now = new Date()
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(now.getDate() - i)
    out.push(d.toISOString().slice(0, 10))
  }
  return out
}

/** Mini gráfica de barras SVG (sin librería externa, como PriceHistoryChart). */
function BarChart({ days, values, color, fmt }: {
  days: string[]; values: number[]; color: string; fmt: (v: number) => string
}) {
  const max = Math.max(1, ...values)
  const W = 100, H = 36, gap = 0.6
  const bw = (W - gap * (days.length - 1)) / days.length
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="w-full h-24">
      {values.map((v, i) => {
        const h = (v / max) * (H - 2)
        return (
          <rect key={i} x={i * (bw + gap)} y={H - h} width={bw} height={h} rx={0.4} fill={color}>
            <title>{`${days[i]}: ${fmt(v)}`}</title>
          </rect>
        )
      })}
    </svg>
  )
}

/** Gráficas de pedidos/día y GMV/día (últimos 30 días) sobre datos REALES del endpoint /series. */
export function DashboardSeriesCharts() {
  const t = useT()
  const format = useCurrencyStore((s) => s.format)
  const { data, isLoading } = useQuery({ queryKey: ['admin-series'], queryFn: admin.series })

  const days = lastDays(30)
  const orders = days.map((d) => data?.ordersByDay?.[d] ?? 0)
  const gmv = days.map((d) => (data?.gmvCentsByDay?.[d] ?? 0) / 100)
  const totalOrders = orders.reduce((a, b) => a + b, 0)
  const totalGmv = gmv.reduce((a, b) => a + b, 0)

  return (
    <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="card p-5">
        <div className="flex items-center justify-between">
          <h3 className="text-sm">{t('admin.dashboard.chart.orders')}</h3>
          <span className="text-xs text-ink-500">{totalOrders} · 30{t('admin.dashboard.chart.days')}</span>
        </div>
        {isLoading ? <div className="h-24 mt-3 bg-base-200 rounded animate-pulse" />
          : <div className="mt-3"><BarChart days={days} values={orders} color="#4f46e5" fmt={(v) => `${v}`} /></div>}
      </div>
      <div className="card p-5">
        <div className="flex items-center justify-between">
          <h3 className="text-sm">{t('admin.dashboard.chart.gmv')}</h3>
          <span className="text-xs text-ink-500">{format(totalGmv, 'USD')} · 30{t('admin.dashboard.chart.days')}</span>
        </div>
        {isLoading ? <div className="h-24 mt-3 bg-base-200 rounded animate-pulse" />
          : <div className="mt-3"><BarChart days={days} values={gmv} color="#10b981" fmt={(v) => format(v, 'USD')} /></div>}
      </div>
    </section>
  )
}
