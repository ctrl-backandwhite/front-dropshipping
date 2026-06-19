import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { admin } from '../../api/admin'
import { DashboardSeriesCharts } from '../../components/DashboardSeriesCharts'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faBoxesStacked, faCircleCheck, faTruck, faUsers, faShop, faKey,
  faSackDollar, faChartLine, faArrowTrendUp, faArrowTrendDown,
} from '@fortawesome/free-solid-svg-icons'
import { useCurrencyStore } from '../../store/currency'
import { useT } from '../../store/locale'
import { useAuthStore } from '../../store/auth'
import { AnimatedCounter } from '../../components/Motion'

export default function AdminDashboardPage() {
  const t = useT()
  // DROP-153 / DROP-193: hold off until auth has initialized so KPI queries don't race the token.
  const authReady = useAuthStore((s) => s.initialized && !!s.user)
  const { data: m, isFetching: mLoading } = useQuery({
    queryKey: ['admin-metrics'],
    queryFn: admin.metrics,
    enabled: authReady,
  })
  const { data: orders } = useQuery({
    queryKey: ['admin-recent-orders'],
    queryFn: admin.recentOrders,
    enabled: authReady,
  })
  const format = useCurrencyStore((s) => s.format)

  const total = m?.totalProducts ?? 0
  const active = m?.activeProducts ?? 0
  const inactive = Math.max(0, total - active)
  const activePct = total ? Math.round((active / total) * 100) : 0

  return (
    <div className="space-y-6">
      <header>
        <h1>{t('admin.dashboard.title')}</h1>
        <p className="text-sm text-ink-500 mt-1">{t('admin.dashboard.subtitle')}</p>
      </header>

      <div className="stats stats-vertical sm:stats-horizontal shadow-pastel w-full bg-base-100">
        <StatBlock icon={faBoxesStacked} tone="primary"   label={t('admin.dashboard.kpi.total_products')} value={total} loading={!m && mLoading}
                   trend={total ? `${inactive} ${t('admin.dashboard.kpi.inactive')}` : undefined} trendUp={false} />
        <StatBlock icon={faCircleCheck}  tone="success"   label={t('admin.dashboard.kpi.active')}         value={active} loading={!m && mLoading}
                   trend={total ? `${activePct}%` : undefined} trendUp={activePct >= 80} />
        <StatBlock icon={faTruck}        tone="info"      label={t('admin.dashboard.kpi.orders')}         value={m?.totalOrders}    loading={!m && mLoading} />
        <StatBlock icon={faShop}         tone="secondary" label={t('admin.dashboard.kpi.suppliers')}      value={m?.totalSuppliers} loading={!m && mLoading} />
        <StatBlock icon={faUsers}        tone="accent"    label={t('admin.dashboard.kpi.users')}          value={m?.totalUsers}     loading={!m && mLoading} />
        <StatBlock icon={faKey}          tone="warning"   label={t('admin.dashboard.kpi.active_plans')}   value={m?.activePlans}    loading={!m && mLoading} />
      </div>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card card-border bg-base-100">
          <div className="card-body">
            <div className="flex items-center gap-2 opacity-70 text-[12px]">
              <FontAwesomeIcon icon={faSackDollar} /> {t('admin.dashboard.gmv')}
            </div>
            <div className="text-3xl font-medium">{m ? format(Number(m.gmvUsd) || 0, 'USD') : '—'}</div>
            <div className="text-[11px] opacity-50">{t('admin.dashboard.gmv.canonical')}: ${m?.gmvUsd ?? '0.00'} USD</div>
          </div>
        </div>
        <div className="card card-border bg-base-100">
          <div className="card-body">
            <div className="flex items-center gap-2 opacity-70 text-[12px]">
              <FontAwesomeIcon icon={faChartLine} /> {t('admin.dashboard.mrr')}
            </div>
            <div className="text-3xl font-medium">{m ? format(Number(m.mrrUsd) || 0, 'USD') : '—'}</div>
            <div className="text-[11px] opacity-50">{m?.totalSubscriptions ?? 0} {t('admin.dashboard.mrr.subs')}</div>
          </div>
        </div>
      </section>

      <DashboardSeriesCharts />

      <section className="card overflow-hidden">
        <div className="card-header"><span>{t('admin.dashboard.recent_orders')}</span></div>
        <div className="overflow-x-auto">
        <table className="table table-zebra table-sm w-full">
          <thead className="bg-ink-50 text-ink-500 text-left text-[12px]">
            <tr>
              <th className="px-4 py-2 font-medium">{t('admin.dashboard.col.number')}</th>
              <th className="px-4 py-2 font-medium">{t('admin.dashboard.col.status')}</th>
              <th className="px-4 py-2 font-medium text-right">{t('admin.dashboard.col.total')}</th>
              <th className="px-4 py-2 font-medium">{t('admin.dashboard.col.date')}</th>
            </tr>
          </thead>
          <tbody>
            {orders && orders.length > 0 ? (
              orders.map((o) => (
                <tr key={o.id} className="border-t border-ink-100 hover:bg-ink-50/50 cursor-pointer">
                  <td className="px-4 py-2 font-mono text-[12px]">
                    <Link to={`/admin/orders?focus=${o.id}`} className="text-brand-700 hover:underline">{o.orderNumber}</Link>
                  </td>
                  <td className="px-4 py-2"><StatusBadge status={o.status} /></td>
                  <td className="px-4 py-2 text-right font-medium">{format(o.totalCents / 100, o.currency)}</td>
                  <td className="px-4 py-2 text-ink-500 text-[12px]">{o.placedAt ? new Date(o.placedAt).toLocaleString() : '—'}</td>
                </tr>
              ))
            ) : (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-ink-500 text-[13px]">
                {t('admin.dashboard.empty')} <Link to="/admin/orders" className="text-brand-600 hover:underline">{t('admin.dashboard.empty.cta')}</Link> {t('admin.dashboard.empty.suffix')}
              </td></tr>
            )}
          </tbody>
        </table>
        </div>
      </section>
    </div>
  )
}

type KpiTone = 'primary' | 'secondary' | 'accent' | 'success' | 'info' | 'warning'
function StatBlock({ icon, label, value, trend, trendUp, loading, tone = 'primary' }: {
  icon: any; label: string; value?: number; trend?: string; trendUp?: boolean; loading?: boolean; tone?: KpiTone
}) {
  // DROP-382: icono dentro de un círculo pastel tintado con el color del KPI.
  return (
    <div className="stat">
      <div className={`stat-figure text-${tone}`}>
        <span className="kpi-icon">
          <FontAwesomeIcon icon={icon} className="text-lg" />
        </span>
      </div>
      <div className="stat-title text-[11px]">{label}</div>
      <div className="stat-value text-2xl">
        {loading ? <span className="loading loading-bars loading-md" /> : <AnimatedCounter value={value ?? 0} />}
      </div>
      {trend && (
        <div className={`stat-desc inline-flex items-center gap-1 ${trendUp ? 'text-success' : ''}`}>
          <FontAwesomeIcon icon={trendUp ? faArrowTrendUp : faArrowTrendDown} className="text-[10px]" />
          {trend}
        </div>
      )}
    </div>
  )
}

export function StatusBadge({ status }: { status: string }) {
  const t = useT()
  // DROP-295 — single mapping of order statuses to daisyUI badge variants.
  const map: Record<string, string> = {
    PENDING:          'badge-ghost',
    AWAITING_PAYMENT: 'badge-warning',
    PAID:             'badge-info',
    FORWARDED:        'badge-primary',
    SHIPPED:          'badge-warning',
    DELIVERED:        'badge-success',
    CANCELLED:        'badge-error',
    REFUNDED:         'badge-neutral',
  }
  const label = t(`orders.status.${status}`)
  return <span className={`badge ${map[status] ?? 'badge-ghost'} badge-sm`}>{label !== `orders.status.${status}` ? label : status}</span>
}
