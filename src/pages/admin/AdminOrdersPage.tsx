import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { admin } from '../../api/admin'
import { StatusBadge } from './AdminDashboardPage'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faPaperPlane, faBan, faTruck, faCircleCheck, faPlus, faRotateLeft, faEye, faFileImport, faRotateRight,
} from '@fortawesome/free-solid-svg-icons'
import { dialog } from '../../store/dialog'
import { CreateOrderModal, ImportOrdersModal } from './AdminOrderModals'
import { useT, useLocaleStore } from '../../store/locale'
import { useCurrencyStore } from '../../store/currency'
import { SearchInput } from '../../components/SearchInput'
import { FilterBar, SelectFilter } from '../../components/FilterBar'

const STATUSES = ['PENDING', 'AWAITING_PAYMENT', 'PAID', 'FORWARDED', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED']
const PAGE_SIZE = 25
// DROP-119 / DROP-169 — demo seeding is opt-in for development only.
const ALLOW_DEMO = import.meta.env.MODE === 'development' && import.meta.env.VITE_ENABLE_DEMO_ORDERS === 'true'

// DROP-120 — what state changes are allowed from each status. Keeps actions consistent.
const TRANSITIONS: Record<string, ('forward'|'ship'|'deliver'|'cancel'|'refund')[]> = {
  PENDING:          ['forward', 'cancel'],
  AWAITING_PAYMENT: ['cancel'],
  PAID:             ['forward', 'cancel'],
  FORWARDED:        ['ship', 'cancel'],
  SHIPPED:          ['deliver'],
  DELIVERED:        ['refund'],
  CANCELLED:        [],
  REFUNDED:         [],
}

function capitalize(s: string) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s
}

export default function AdminOrdersPage() {
  const t = useT()
  const format = useCurrencyStore((s) => s.format)
  const locale = useLocaleStore((s) => s.locale)
  const qc = useQueryClient()
  const [status, setStatus] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [year, setYear] = useState<string | null>(null)
  const [month, setMonth] = useState<string | null>(null)
  const [day, setDay] = useState<string | null>(null)
  const [page, setPage] = useState(0)
  const [search] = useSearchParams()
  const focusId = search.get('focus')
  const [showCreate, setShowCreate] = useState(false)
  const [showImport, setShowImport] = useState(false)

  const { data } = useQuery({
    queryKey: ['admin-orders', status, q, page, from, to],
    queryFn: () => admin.orders({ status: status ?? undefined, q: q || undefined, page, size: PAGE_SIZE }),
  })
  const rows = useMemo(() => {
    const items = data?.items ?? []
    if (!from && !to && !year && !month && !day) return items
    const fromMs = from ? new Date(from).getTime() : -Infinity
    const toMs = to ? new Date(to).getTime() + 86_400_000 : Infinity
    return items.filter((o: any) => {
      if (!o.placedAt) return false
      const d = new Date(o.placedAt)
      const ts = d.getTime()
      if (ts < fromMs || ts > toMs) return false
      if (year && String(d.getFullYear()) !== year) return false
      if (month && String(d.getMonth() + 1) !== month) return false
      if (day && String(d.getDate()) !== day) return false
      return true
    })
  }, [data, from, to, year, month, day])

  // Opciones de fecha (año de los pedidos cargados; meses traducidos por Intl según idioma activo).
  const yearOptions = useMemo(() => {
    const ys = new Set<string>()
    ;(data?.items ?? []).forEach((o: any) => { if (o.placedAt) ys.add(String(new Date(o.placedAt).getFullYear())) })
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

  const total = data?.totalElements ?? 0
  const pages = data?.totalPages ?? 1

  const invalidate = () => qc.invalidateQueries({ queryKey: ['admin-orders'] })
  function toast(msg: string) {
    const n = document.createElement('div')
    n.textContent = msg
    n.className = 'fixed bottom-4 right-4 z-[100] px-4 py-2 rounded-md bg-ink-900 text-white text-[13px] shadow-lg'
    document.body.appendChild(n); setTimeout(() => n.remove(), 2200)
  }
  const forward = useMutation({ mutationFn: (id: string) => admin.forwardOrder(id), onSuccess: () => { invalidate(); toast(t('admin.orders.toast.forwarded')) } })
  const ship    = useMutation({ mutationFn: (id: string) => admin.shipOrder(id),    onSuccess: () => { invalidate(); toast(t('admin.orders.toast.shipped')) } })
  const deliver = useMutation({ mutationFn: (id: string) => admin.deliverOrder(id), onSuccess: () => { invalidate(); toast(t('admin.orders.toast.delivered')) } })
  const cancel  = useMutation({ mutationFn: (id: string) => admin.cancelOrder(id),  onSuccess: () => { invalidate(); toast(t('admin.orders.toast.cancelled')) } })
  // DROP-584: refund real
  const refund  = useMutation({
    mutationFn: (id: string) => admin.refundOrder(id),
    onSuccess: () => { invalidate(); toast(t('admin.orders.toast.refunded') ?? 'Order refunded') },
    onError: (e: any) => dialog.alert(e?.response?.data?.message ?? 'Refund failed'),
  })
  const demo    = useMutation({ mutationFn: () => admin.createDemoOrder(), onSuccess: () => { invalidate(); toast(t('admin.orders.toast.demo_created')) } })

  // Selección + acciones masivas (sobre las filas visibles). Cada transición se aplica solo a las
  // filas seleccionadas cuyo estado la permite (según TRANSITIONS); el resto se informa como "saltadas".
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkBusy, setBulkBusy] = useState(false)
  const toggleSel = (id: string) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  const pageIds = rows.map((o: any) => o.id)
  const allSelected = pageIds.length > 0 && pageIds.every((id) => selected.has(id))
  const toggleAll = () => setSelected((s) => {
    const n = new Set(s)
    if (allSelected) pageIds.forEach((id) => n.delete(id)); else pageIds.forEach((id) => n.add(id))
    return n
  })
  const selectedRows = rows.filter((o: any) => selected.has(o.id))

  // Aplica una acción de transición en lote a las filas elegibles; confirma, informa OK/saltadas/errores.
  async function runBulk(
    action: 'forward' | 'ship' | 'deliver' | 'cancel' | 'refund',
    fn: (ids: string[]) => Promise<{ succeeded: number; failed: number; errors: string[] }>,
  ) {
    const eligible = selectedRows.filter((o: any) => (TRANSITIONS[o.status] ?? []).includes(action))
    const skipped = selectedRows.length - eligible.length
    if (!eligible.length) {
      dialog.alert({ variant: 'warning', message: t('admin.orders.bulk.none_eligible') })
      return
    }
    if (!await dialog.confirm({
      title: t(`admin.orders.bulk.${action}`),
      message: t('admin.orders.bulk.confirm').replace('{n}', String(eligible.length)),
      variant: action === 'cancel' || action === 'refund' ? 'error' : undefined,
    })) return
    setBulkBusy(true)
    try {
      const r = await fn(eligible.map((o: any) => o.id))
      setSelected(new Set())
      await invalidate()
      dialog.alert({
        variant: r.failed ? 'warning' : 'success',
        message: t('admin.orders.bulk.done')
          .replace('{ok}', String(r.succeeded)).replace('{fail}', String(r.failed)).replace('{skip}', String(skipped))
          + (r.failed ? '\n' + r.errors.slice(0, 8).join('\n') : ''),
      })
    } finally {
      setBulkBusy(false)
    }
  }

  const hasActiveFilters = !!status || !!q || !!from || !!to || !!year || !!month || !!day
  const clearFilters = () => {
    setStatus(null); setQ(''); setFrom(''); setTo(''); setYear(null); setMonth(null); setDay(null); setPage(0)
  }

  function statusOption(s: string) {
    const label = t(`orders.status.${s}`)
    return { value: s, label: label.startsWith('orders.status.') ? s : label }
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1>{t('admin.orders.title')}</h1>
          <p className="text-sm text-ink-500 mt-1">{t('admin.orders.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {selected.size > 0 && (
            <div className="flex items-center gap-1 flex-wrap mr-1">
              <span className="text-[11px] text-ink-500 mr-1">{t('admin.orders.bulk.selected').replace('{n}', String(selected.size))}</span>
              <button onClick={() => runBulk('forward', admin.bulkForwardOrders)} disabled={bulkBusy}
                      className="btn btn-outline btn-sm text-[12px]" title={t('admin.orders.bulk.forward')}>
                <FontAwesomeIcon icon={faPaperPlane} /> {t('admin.orders.actions.forward')}
              </button>
              <button onClick={() => runBulk('ship', admin.bulkShipOrders)} disabled={bulkBusy}
                      className="btn btn-outline btn-sm text-[12px]" title={t('admin.orders.bulk.ship')}>
                <FontAwesomeIcon icon={faTruck} /> {t('admin.orders.actions.ship')}
              </button>
              <button onClick={() => runBulk('deliver', admin.bulkDeliverOrders)} disabled={bulkBusy}
                      className="btn btn-outline btn-sm text-[12px]" title={t('admin.orders.bulk.deliver')}>
                <FontAwesomeIcon icon={faCircleCheck} /> {t('admin.orders.actions.deliver')}
              </button>
              <button onClick={() => runBulk('refund', admin.bulkRefundOrders)} disabled={bulkBusy}
                      className="btn btn-outline btn-sm text-[12px]" title={t('admin.orders.bulk.refund')}>
                <FontAwesomeIcon icon={faRotateLeft} /> {t('admin.orders.actions.refund')}
              </button>
              <button onClick={() => runBulk('cancel', admin.bulkCancelOrders)} disabled={bulkBusy}
                      className="btn btn-outline btn-sm text-[12px] border-red-300 text-red-700 hover:bg-red-50" title={t('admin.orders.bulk.cancel')}>
                <FontAwesomeIcon icon={bulkBusy ? faRotateRight : faBan} className={bulkBusy ? 'fa-spin' : ''} /> {t('admin.orders.actions.cancel')}
              </button>
            </div>
          )}
          <button onClick={() => setShowImport(true)} className="btn btn-outline text-[12px]">
            <FontAwesomeIcon icon={faFileImport} /> {t('admin.orders.import.title')}
          </button>
          <button onClick={() => setShowCreate(true)} className="btn btn-primary text-[12px]">
            <FontAwesomeIcon icon={faPlus} /> {t('admin.orders.create.title')}
          </button>
          {ALLOW_DEMO && (
            <button onClick={() => demo.mutate()} className="btn btn-outline text-[12px]">
              <FontAwesomeIcon icon={faPlus} /> {t('admin.orders.create_demo')}
            </button>
          )}
        </div>
      </header>

      {showCreate && <CreateOrderModal onClose={() => setShowCreate(false)} />}
      {showImport && <ImportOrdersModal onClose={() => setShowImport(false)} />}

      <FilterBar onClear={clearFilters} hasActive={hasActiveFilters}>
        <SearchInput value={q} onChange={(v) => { setQ(v); setPage(0) }}
                     placeholder={t('admin.orders.search_placeholder')} className="min-w-[280px]" />
        <SelectFilter label={t('filters.status')}
                      value={status} options={STATUSES.map(statusOption)}
                      onChange={(v) => { setStatus(v); setPage(0) }}
                      placeholder={t('filters.all')} />
        <SelectFilter label={t('orders.filter.year')} value={year} placeholder={t('orders.filter.all')}
                      options={yearOptions} onChange={(v) => { setYear(v); setPage(0) }} />
        <SelectFilter label={t('orders.filter.month')} value={month} placeholder={t('orders.filter.all')}
                      options={monthOptions} onChange={(v) => { setMonth(v); setPage(0) }} />
        <SelectFilter label={t('orders.filter.day')} value={day} placeholder={t('orders.filter.all')}
                      options={dayOptions} onChange={(v) => { setDay(v); setPage(0) }} />
        <label className="text-[11px] text-ink-500 flex items-center gap-1">
          {t('admin.orders.filter.from')}
          <input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(0) }}
                 className="border border-ink-200 rounded px-2 py-1 text-[12px]" />
        </label>
        <label className="text-[11px] text-ink-500 flex items-center gap-1">
          {t('admin.orders.filter.to')}
          <input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(0) }}
                 className="border border-ink-200 rounded px-2 py-1 text-[12px]" />
        </label>
        <span className="text-[11px] text-ink-400 ml-auto">{t('pagination.showing')} <strong>{rows.length}</strong> / {total}</span>
      </FilterBar>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
        <table className="table table-zebra table-sm">
          <thead className="bg-ink-50 text-ink-500 text-left text-[12px]">
            <tr>
              <th className="px-3 py-2 w-8">
                <input type="checkbox" className="checkbox checkbox-xs" checked={allSelected} onChange={toggleAll} aria-label={t('admin.categories.select_all')} />
              </th>
              <th className="px-4 py-2 font-medium">{t('admin.dashboard.col.number')}</th>
              <th className="px-4 py-2 font-medium">{t('admin.dashboard.col.status')}</th>
              <th className="px-4 py-2 font-medium">{t('admin.orders.col.customer')}</th>
              <th className="px-4 py-2 font-medium">{t('admin.orders.col.shop')}</th>
              <th className="px-4 py-2 font-medium">{t('admin.orders.col.supplier')}</th>
              <th className="px-4 py-2 font-medium">{t('admin.orders.col.items')}</th>
              <th className="px-4 py-2 font-medium text-right">{t('admin.dashboard.col.total')}</th>
              <th className="px-4 py-2 font-medium">{t('admin.orders.col.placed')}</th>
              <th className="px-4 py-2 font-medium w-72">{t('admin.orders.col.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.length > 0 ? rows.map((o: any) => {
              const allowed = TRANSITIONS[o.status] ?? []
              const highlight = focusId && (focusId === o.id || focusId === o.orderNumber)
              return (
                <tr key={o.id} className={`border-t border-ink-100 hover:bg-ink-50/50 ${highlight ? 'bg-brand-50/40' : ''} ${selected.has(o.id) ? 'bg-brand-50/40' : ''}`}>
                  <td className="px-3 py-2 w-8">
                    <input type="checkbox" className="checkbox checkbox-xs" checked={selected.has(o.id)} onChange={() => toggleSel(o.id)} aria-label={o.orderNumber} />
                  </td>
                  <td className="px-4 py-2 font-mono text-[12px]">
                    <Link to={`/admin/orders/${o.id}`} className="text-brand-700 hover:underline">{o.orderNumber}</Link>
                  </td>
                  <td className="px-4 py-2"><StatusBadge status={o.status} /></td>
                  <td className="px-4 py-2 text-[12px]">{o.customerEmail ?? '—'}</td>
                  <td className="px-4 py-2 text-[12px] text-ink-600">{o.shopName ?? o.shopHandle ?? '—'}</td>
                  <td className="px-4 py-2 text-[12px] text-ink-600">{o.supplierName ?? '—'}</td>
                  <td className="px-4 py-2">{o.itemCount}</td>
                  <td className="px-4 py-2 text-right font-medium">{format(o.totalCents / 100, o.currency)}</td>
                  <td className="px-4 py-2 text-[12px] text-ink-500">{o.placedAt ? new Date(o.placedAt).toLocaleString() : '—'}</td>
                  <td className="px-4 py-2">
                    <div className="flex gap-1 flex-wrap">
                      <Link to={`/admin/orders/${o.id}`} className="btn btn-outline btn-square text-[11px]" title={t('admin.orders.actions.view')} aria-label={t('admin.orders.actions.view')}>
                        <FontAwesomeIcon icon={faEye} />
                      </Link>
                      {allowed.includes('forward') && (
                        <button onClick={() => dialog.confirm(t('admin.orders.confirm.forward')).then((ok) => ok && forward.mutate(o.id))} className="btn btn-outline btn-square text-[11px]" title={t('admin.orders.actions.forward')} aria-label={t('admin.orders.actions.forward')}>
                          <FontAwesomeIcon icon={faPaperPlane} />
                        </button>
                      )}
                      {allowed.includes('ship') && (
                        <button onClick={() => dialog.confirm(t('admin.orders.confirm.ship')).then((ok) => ok && ship.mutate(o.id))} className="btn btn-outline btn-square text-[11px]" title={t('admin.orders.actions.ship')} aria-label={t('admin.orders.actions.ship')}>
                          <FontAwesomeIcon icon={faTruck} />
                        </button>
                      )}
                      {allowed.includes('deliver') && (
                        <button onClick={() => dialog.confirm(t('admin.orders.confirm.deliver')).then((ok) => ok && deliver.mutate(o.id))} className="btn btn-outline btn-square text-[11px]" title={t('admin.orders.actions.deliver')} aria-label={t('admin.orders.actions.deliver')}>
                          <FontAwesomeIcon icon={faCircleCheck} />
                        </button>
                      )}
                      {allowed.includes('refund') && (
                        <button onClick={() => dialog.confirm(t('admin.orders.confirm.refund') ?? '¿Reembolsar esta orden al wallet del comprador?').then((ok) => ok && refund.mutate(o.id))} className="btn btn-outline btn-square text-[11px]" title={t('admin.orders.actions.refund')} aria-label={t('admin.orders.actions.refund')}>
                          <FontAwesomeIcon icon={faRotateLeft} />
                        </button>
                      )}
                      {allowed.includes('cancel') && (
                        <button onClick={() => dialog.confirm(t('admin.orders.cancel_confirm')).then((ok) => ok && cancel.mutate(o.id))}
                                className="btn btn-outline btn-square text-[11px] text-red-600" title={t('admin.orders.actions.cancel')} aria-label={t('admin.orders.actions.cancel')}>
                          <FontAwesomeIcon icon={faBan} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )
            }) : (
              <tr><td colSpan={10} className="px-4 py-10 text-center text-ink-500 text-[13px]">
                {t('filters.no_results')}
              </td></tr>
            )}
          </tbody>
        </table>
        </div>
      </div>

      <Pagination page={page} pages={Math.max(1, pages)} onPage={setPage} />
    </div>
  )
}

export function Pagination({ page, pages, onPage }: { page: number; pages: number; onPage: (p: number) => void }) {
  const t = useT()
  // DROP-300 — daisyUI `join` with `btn join-item` buttons.
  const max = Math.max(1, pages)
  return (
    <div className="flex items-center justify-end gap-3 text-[12px]">
      <span className="opacity-70">{t('pagination.page')} <strong>{page + 1}</strong> {t('pagination.of')} {max}</span>
      <div className="join">
        <button onClick={() => onPage(0)} disabled={page === 0}
                className="btn btn-sm join-item">«</button>
        <button onClick={() => onPage(Math.max(0, page - 1))} disabled={page === 0}
                className="btn btn-sm join-item">{t('pagination.previous')}</button>
        <button onClick={() => onPage(Math.min(max - 1, page + 1))} disabled={page >= max - 1}
                className="btn btn-sm join-item">{t('pagination.next')}</button>
        <button onClick={() => onPage(max - 1)} disabled={page >= max - 1}
                className="btn btn-sm join-item">»</button>
      </div>
    </div>
  )
}
