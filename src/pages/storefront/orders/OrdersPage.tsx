import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { orders } from '../../../api/orders'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faBoxOpen, faTruck, faCircleCheck, faCircleXmark, faHourglassHalf, faMoneyBillTransfer,
  faRoute, faFilterCircleXmark,
} from '@fortawesome/free-solid-svg-icons'
import { useT, useLocaleStore } from '../../../store/locale'
import { SearchInput } from '../../../components/SearchInput'
import { FilterBar, SelectFilter } from '../../../components/FilterBar'

const STATUS_META: Record<string, { cls: string; icon: any }> = {
  PENDING:          { cls: 'bg-ink-100 text-ink-700',         icon: faHourglassHalf },
  AWAITING_PAYMENT: { cls: 'bg-amber-100 text-amber-700',     icon: faHourglassHalf },
  PAID:             { cls: 'bg-emerald-100 text-emerald-700', icon: faMoneyBillTransfer },
  FORWARDED:        { cls: 'bg-blue-100 text-blue-700',       icon: faBoxOpen },
  SHIPPED:          { cls: 'bg-indigo-100 text-indigo-700',   icon: faTruck },
  DELIVERED:        { cls: 'bg-emerald-100 text-emerald-700', icon: faCircleCheck },
  CANCELLED:        { cls: 'bg-red-100 text-red-700',         icon: faCircleXmark },
  REFUNDED:         { cls: 'bg-ink-200 text-ink-700',         icon: faMoneyBillTransfer },
}

// Estados con actividad de envío → mostramos acceso directo al seguimiento.
const SHIPPING_STATUSES = ['FORWARDED', 'SHIPPED', 'DELIVERED']

function capitalize(s: string) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s
}

export default function OrdersPage() {
  const t = useT()
  const locale = useLocaleStore((s) => s.locale)
  const { data, isLoading } = useQuery({ queryKey: ['orders'], queryFn: orders.list })

  const [q, setQ] = useState('')
  const [status, setStatus] = useState<string | null>(null)
  const [year, setYear] = useState<string | null>(null)
  const [month, setMonth] = useState<string | null>(null)
  const [day, setDay] = useState<string | null>(null)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  // Opciones de filtro. Los años salen de los pedidos reales; meses/días son fijos (los meses
  // traducidos por Intl según el idioma activo → no requieren claves i18n).
  const yearOptions = useMemo(() => {
    const ys = new Set<string>()
    ;(data ?? []).forEach((o) => { if (o.placedAt) ys.add(String(new Date(o.placedAt).getFullYear())) })
    return Array.from(ys).sort((a, b) => b.localeCompare(a)).map((y) => ({ value: y, label: y }))
  }, [data])
  const monthOptions = useMemo(
    () => Array.from({ length: 12 }, (_, m) => ({
      value: String(m + 1),
      label: capitalize(new Date(2000, m, 1).toLocaleString(locale, { month: 'long' })),
    })),
    [locale],
  )
  const dayOptions = useMemo(
    () => Array.from({ length: 31 }, (_, d) => ({ value: String(d + 1), label: String(d + 1) })),
    [],
  )
  const statusOptions = useMemo(
    () => Object.keys(STATUS_META).map((s) => ({ value: s, label: t(`orders.status.${s}`) })),
    [t],
  )

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return (data ?? []).filter((o) => {
      if (needle && !o.orderNumber.toLowerCase().includes(needle)) return false
      if (status && o.status !== status) return false
      if (year || month || day || from || to) {
        if (!o.placedAt) return false
        const d = new Date(o.placedAt)
        if (year && String(d.getFullYear()) !== year) return false
        if (month && String(d.getMonth() + 1) !== month) return false
        if (day && String(d.getDate()) !== day) return false
        if (from && d < new Date(from + 'T00:00:00')) return false
        if (to && d > new Date(to + 'T23:59:59')) return false
      }
      return true
    })
  }, [data, q, status, year, month, day, from, to])

  const activeCount = [q, status, year, month, day, from, to].filter(Boolean).length
  const clearAll = () => {
    setQ(''); setStatus(null); setYear(null); setMonth(null); setDay(null); setFrom(''); setTo('')
  }

  if (isLoading) return <p className="text-sm text-ink-500">{t('orders.loading')}</p>

  // Sin ningún pedido en la cuenta (distinto de "sin resultados tras filtrar").
  if (!data || data.length === 0) {
    return (
      <div className="max-w-2xl mx-auto card p-10 text-center">
        <FontAwesomeIcon icon={faBoxOpen} className="text-4xl text-ink-300 mb-3" />
        <h1>{t('orders.empty.title')}</h1>
        <p className="text-sm text-ink-500 mt-2">{t('orders.empty.desc')}</p>
        <Link to="/catalog" className="btn btn-primary inline-flex mt-5">{t('cart.see_catalog')}</Link>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <header>
        <h1>{t('orders.title')}</h1>
        <p className="text-sm text-ink-500 mt-1">{t('orders.subtitle')}</p>
      </header>

      <FilterBar onClear={clearAll} hasActive={activeCount > 0} activeCount={activeCount}>
        <SearchInput value={q} onChange={setQ} placeholder={t('orders.filter.search_ph')} className="w-full sm:min-w-[220px]" />
        <SelectFilter label={t('orders.filter.status')} value={status} placeholder={t('orders.filter.all')}
          options={statusOptions} onChange={setStatus} />
        <SelectFilter label={t('orders.filter.year')} value={year} placeholder={t('orders.filter.all')}
          options={yearOptions} onChange={setYear} />
        <SelectFilter label={t('orders.filter.month')} value={month} placeholder={t('orders.filter.all')}
          options={monthOptions} onChange={setMonth} />
        <SelectFilter label={t('orders.filter.day')} value={day} placeholder={t('orders.filter.all')}
          options={dayOptions} onChange={setDay} />
        <label className="flex items-center gap-1.5 text-xs text-ink-500">
          {t('orders.filter.from')}
          <input type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)}
            className="input input-sm w-auto" />
        </label>
        <label className="flex items-center gap-1.5 text-xs text-ink-500">
          {t('orders.filter.to')}
          <input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)}
            className="input input-sm w-auto" />
        </label>
      </FilterBar>

      <p className="text-xs text-ink-500">
        {t('orders.filter.showing')} <strong className="text-ink-700">{filtered.length}</strong> / {data.length}
      </p>

      {filtered.length === 0 ? (
        <div className="card p-10 text-center">
          <FontAwesomeIcon icon={faFilterCircleXmark} className="text-3xl text-ink-300 mb-3" />
          <p className="text-sm text-ink-500">{t('orders.no_results')}</p>
          <button onClick={clearAll} className="btn btn-ghost btn-sm mt-4">{t('filters.clear')}</button>
        </div>
      ) : (
      <div className="card overflow-hidden">
        <div className="hidden md:block">
          <table className="w-full text-sm">
            <thead className="bg-ink-50 text-ink-500 text-left">
              <tr>
                <th className="px-4 py-2">{t('orders.col.order')}</th>
                <th className="px-4 py-2">{t('orders.col.status')}</th>
                <th className="px-4 py-2">{t('orders.col.items')}</th>
                <th className="px-4 py-2 text-right">{t('orders.col.total')}</th>
                <th className="px-4 py-2">{t('orders.col.date')}</th>
                <th className="px-4 py-2 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((o) => {
                const s = STATUS_META[o.status] ?? STATUS_META.PENDING
                return (
                  <tr key={o.id} className="border-t border-ink-100 hover:bg-ink-50/50">
                    <td className="px-4 py-3 font-mono text-xs">{o.orderNumber}</td>
                    <td className="px-4 py-3">
                      <span className={`badge ${s.cls}`}>
                        <FontAwesomeIcon icon={s.icon} className="mr-1" /> {t(`orders.status.${o.status}`)}
                      </span>
                    </td>
                    <td className="px-4 py-3">{o.itemCount}</td>
                    <td className="px-4 py-3 text-right font-medium">${(o.totalCents / 100).toFixed(2)}</td>
                    <td className="px-4 py-3 text-ink-500 text-xs">
                      {o.placedAt ? new Date(o.placedAt).toLocaleString() : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-3">
                        {SHIPPING_STATUSES.includes(o.status) && (
                          <Link to={`/orders/${o.id}`} className="text-brand-700 hover:underline text-xs inline-flex items-center gap-1" title={t('orders.track')}>
                            <FontAwesomeIcon icon={faRoute} /> {t('orders.track')}
                          </Link>
                        )}
                        <Link to={`/orders/${o.id}`} className="text-brand-700 hover:underline text-xs">{t('common.view')}</Link>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <div className="md:hidden divide-y divide-ink-100">
          {filtered.map((o) => {
            const s = STATUS_META[o.status] ?? STATUS_META.PENDING
            return (
              <Link key={o.id} to={`/orders/${o.id}`} className="block p-4 hover:bg-ink-50/50">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs">{o.orderNumber}</span>
                  <span className={`badge ${s.cls} text-[10px]`}>
                    <FontAwesomeIcon icon={s.icon} className="mr-1" /> {t(`orders.status.${o.status}`)}
                  </span>
                </div>
                <div className="mt-1 flex items-center justify-between text-xs text-ink-500">
                  <span>{o.itemCount} {t('orders.items_short')}</span>
                  <span className="text-ink-900 font-medium">${(o.totalCents / 100).toFixed(2)}</span>
                </div>
                <div className="mt-1 flex items-center justify-between text-[11px] text-ink-500">
                  <span>{o.placedAt ? new Date(o.placedAt).toLocaleString() : '—'}</span>
                  {SHIPPING_STATUSES.includes(o.status) && (
                    <span className="text-brand-700 inline-flex items-center gap-1"><FontAwesomeIcon icon={faRoute} /> {t('orders.track')}</span>
                  )}
                </div>
              </Link>
            )
          })}
        </div>
      </div>
      )}
    </div>
  )
}
