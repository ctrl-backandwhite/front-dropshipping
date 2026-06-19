import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { admin, PlanRow } from '../../api/admin'
import { useT } from '../../store/locale'
import { useCurrencyStore } from '../../store/currency'
import { SearchInput } from '../../components/SearchInput'
import { FilterBar, SelectFilter } from '../../components/FilterBar'
import { Pagination } from './AdminOrdersPage'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faPen } from '@fortawesome/free-solid-svg-icons'

const STATUSES = ['ACTIVE', 'TRIALING', 'PAST_DUE', 'PAUSED', 'CANCELLED']
const PAGE_SIZE = 25

export default function AdminBillingPage() {
  const t = useT()
  const format = useCurrencyStore((s) => s.format)
  const qc = useQueryClient()
  const { data: plans } = useQuery({ queryKey: ['admin-plans'], queryFn: admin.plans })
  const { data: subs } = useQuery({ queryKey: ['admin-subs'], queryFn: () => admin.subscriptions() })
  const [editing, setEditing] = useState<PlanRow | null>(null)
  const update = useMutation({
    mutationFn: (p: PlanRow) => admin.updatePlan(p.code, p),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-plans'] }); setEditing(null) },
  })

  // DROP-634: el periodo llega del backend en dos convenciones históricas
  // (MONTHLY/YEARLY desde el use case real, MONTH/YEAR desde el seed). Lo
  // canonicalizamos a una única clave i18n para que SIEMPRE se renderice
  // traducido y nunca el valor crudo del enum.
  const periodKey = (p?: string | null) => {
    switch ((p ?? '').toUpperCase()) {
      case 'MONTHLY':
      case 'MONTH':
        return 'admin.billing.period.monthly'
      case 'YEARLY':
      case 'YEAR':
        return 'admin.billing.period.yearly'
      case 'FREE':
        return 'admin.billing.period.free'
      case 'CUSTOM':
        return 'admin.billing.period.custom'
      default:
        return null
    }
  }
  const periodLabel = (p?: string | null) => {
    const k = periodKey(p)
    return k ? t(k) : (p ?? '—')
  }

  // DROP-634: defensa en profundidad — un plan FREE nunca debe figurar en
  // estado trial; si llega TRIALING lo mostramos como ACTIVE (el backend ya
  // lo normaliza, esto cubre datos legacy que escapen a la migración).
  const effectiveStatus = (plan: string, status: string) =>
    plan === 'FREE' && status === 'TRIALING' ? 'ACTIVE' : status

  const statusLabel = (s: string) => {
    const k = `billing.status.${s}`
    const v = t(k)
    return v === k ? s : v
  }

  // Plans without paid price get FREE (or CUSTOM for ENTERPRISE) instead of YEAR/MONTH.
  // DROP-634 (item 3): cuando el plan ofrece AMBOS ciclos (mensual y anual) no
  // tiene sentido mostrar un periodo fijo — etiquetamos "Mensual / Anual" para
  // que quede claro que el plan soporta los dos, no que esté atado a uno.
  const planPeriod = (p: PlanRow) => {
    if (p.code === 'ENTERPRISE') return 'CUSTOM'
    if (p.priceMonthlyCents === 0 && p.priceYearlyCents === 0) return 'FREE'
    if (p.priceMonthlyCents > 0 && p.priceYearlyCents > 0) return 'BOTH'
    if (p.priceYearlyCents > 0) return 'YEAR'
    return 'MONTH'
  }
  const planPeriodLabel = (period: string) =>
    period === 'BOTH'
      ? `${t('admin.billing.period.monthly')} / ${t('admin.billing.period.yearly')}`
      : periodLabel(period)

  const [q, setQ] = useState('')
  const [status, setStatus] = useState<string | null>(null)
  const [page, setPage] = useState(0)

  const filtered = useMemo(() => {
    if (!subs) return []
    const term = q.trim().toLowerCase()
    return subs.filter((s) => {
      if (status && s.status !== status) return false
      if (term && !(s.userEmail?.toLowerCase().includes(term) || s.plan.toLowerCase().includes(term))) return false
      return true
    })
  }, [subs, q, status])
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const slice = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t('admin.billing.title')}</h1>

      <section className="card overflow-hidden">
        <div className="card-header"><span>{t('admin.billing.plans')}</span></div>
        <div className="overflow-x-auto">
        <table className="table table-zebra table-sm">
          <thead className="bg-ink-50 text-ink-500 text-left text-[12px]">
            <tr>
              <th className="px-4 py-2 font-medium">{t('admin.billing.col.code')}</th>
              <th className="px-4 py-2 font-medium">{t('admin.billing.col.name')}</th>
              <th className="px-4 py-2 font-medium">{t('admin.billing.col.monthly')}</th>
              <th className="px-4 py-2 font-medium">{t('admin.billing.col.yearly')}</th>
              <th className="px-4 py-2 font-medium">{t('admin.billing.col.period')}</th>
              <th className="px-4 py-2 font-medium">{t('admin.billing.col.active')}</th>
              <th className="px-4 py-2 font-medium">{t('admin.billing.col.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {plans?.map((p) => {
              const period = planPeriod(p)
              const monthly = p.priceMonthlyCents / 100
              const yearly = p.priceYearlyCents / 100
              return (
                <tr key={p.id} className="border-t border-ink-100">
                  <td className="px-4 py-2 font-mono text-xs">{p.code}</td>
                  <td className="px-4 py-2 font-medium">{p.name}</td>
                  <td className="px-4 py-2">{monthly > 0
                    ? format(monthly, 'USD')
                    : <span className="text-ink-500 text-[12px]">{period === 'CUSTOM' ? t('admin.billing.contact_sales') : t('billing.period.FREE')}</span>}</td>
                  <td className="px-4 py-2">{yearly > 0
                    ? format(yearly, 'USD')
                    : <span className="text-ink-500 text-[12px]">{period === 'CUSTOM' ? t('admin.billing.contact_sales') : t('billing.period.FREE')}</span>}</td>
                  <td className="px-4 py-2"><span className="badge bg-ink-100 text-ink-700">{planPeriodLabel(period)}</span></td>
                  <td className="px-4 py-2">
                    <span className={`badge ${p.active ? 'bg-emerald-100 text-emerald-700' : 'bg-ink-200 text-ink-600'}`}>
                      {p.active ? t('common.yes') : t('common.no')}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    <button className="btn btn-outline btn-square text-[11px]" onClick={() => setEditing(p)} title={t('actions.edit')} aria-label={t('actions.edit')}>
                      <FontAwesomeIcon icon={faPen} />
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        </div>
      </section>

      <section className="card overflow-hidden">
        <div className="card-header"><span>{t('admin.billing.subs')}</span></div>
        <div className="p-3 border-b border-ink-100">
          <FilterBar onClear={() => { setQ(''); setStatus(null); setPage(0) }} hasActive={!!q || !!status}>
            <SearchInput value={q} onChange={(v) => { setQ(v); setPage(0) }}
                         placeholder={t('admin.billing.subs_search')} className="min-w-[280px]" />
            <SelectFilter label={t('admin.billing.col.status')}
                          value={status}
                          options={STATUSES.map((s) => ({ value: s, label: statusLabel(s) }))}
                          onChange={(v) => { setStatus(v); setPage(0) }}
                          placeholder={t('filters.all')} />
            <span className="text-[11px] text-ink-400 ml-auto">{t('pagination.showing')} <strong>{slice.length}</strong> / {filtered.length}</span>
          </FilterBar>
        </div>
        <div className="overflow-x-auto">
        <table className="table table-zebra table-sm">
          <thead className="bg-ink-50 text-ink-500 text-left text-[12px]">
            <tr>
              <th className="px-4 py-2 font-medium">{t('admin.billing.col.user')}</th>
              <th className="px-4 py-2 font-medium">{t('admin.billing.col.plan')}</th>
              <th className="px-4 py-2 font-medium">{t('admin.billing.col.status')}</th>
              <th className="px-4 py-2 font-medium">{t('admin.billing.col.period')}</th>
              <th className="px-4 py-2 font-medium">{t('admin.billing.col.start')}</th>
              <th className="px-4 py-2 font-medium">{t('admin.billing.col.end')}</th>
            </tr>
          </thead>
          <tbody>
            {slice.length ? slice.map((s) => (
              <tr key={s.id} className="border-t border-ink-100">
                <td className="px-4 py-2 text-xs">{s.userEmail}</td>
                <td className="px-4 py-2 font-medium">{s.plan}</td>
                <td className="px-4 py-2"><span className="badge bg-ink-100 text-ink-700">{statusLabel(effectiveStatus(s.plan, s.status))}</span></td>
                {/* DROP-558: el plan FREE no tiene period MONTH/YEAR — mostramos
                    "—" para que no parezca que el usuario eligió ciclo de cobro
                    cuando no lo hizo. */}
                <td className="px-4 py-2">{s.plan === 'FREE' ? '—' : periodLabel(s.billingPeriod)}</td>
                <td className="px-4 py-2 text-xs">{s.currentPeriodStart?.slice(0, 10) ?? '—'}</td>
                <td className="px-4 py-2 text-xs">{s.currentPeriodEnd?.slice(0, 10) ?? '—'}</td>
              </tr>
            )) : (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-ink-500">{t('admin.billing.empty')}</td></tr>
            )}
          </tbody>
        </table>
        </div>
        <Pagination page={page} pages={pages} onPage={setPage} />
      </section>

      {editing && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="card p-6 w-full max-w-md space-y-3">
            <h2 className="text-lg font-semibold">{t('admin.billing.edit_plan')} {editing.code}</h2>
            <div className="space-y-3 text-sm">
              <div>
                <label className="text-xs text-ink-500">{t('admin.billing.col.name')}</label>
                <input className="input" value={editing.name}
                       onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
              </div>
              <div>
                <label className="text-xs text-ink-500">{t('admin.billing.description')}</label>
                <input className="input" value={editing.description ?? ''}
                       onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
              </div>
              {/* DROP-561: el símbolo ¢ confundía cuando la lista muestra €
                  (céntimos USD = US cents). Mostramos "USD cents" explícito
                  para que el operador sepa que el campo es un entero. */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-ink-500">
                    {t('admin.billing.col.monthly')} <span className="opacity-60">(USD cents)</span>
                  </label>
                  <input type="number" className="input" value={editing.priceMonthlyCents}
                         onChange={(e) => setEditing({ ...editing, priceMonthlyCents: Number(e.target.value) })} />
                </div>
                <div>
                  <label className="text-xs text-ink-500">
                    {t('admin.billing.col.yearly')} <span className="opacity-60">(USD cents)</span>
                  </label>
                  <input type="number" className="input" value={editing.priceYearlyCents}
                         onChange={(e) => setEditing({ ...editing, priceYearlyCents: Number(e.target.value) })} />
                </div>
              </div>
              <label className="text-sm flex items-center gap-2">
                <input type="checkbox" checked={editing.active}
                       onChange={(e) => setEditing({ ...editing, active: e.target.checked })} />
                {t('admin.billing.col.active')}
              </label>
            </div>
            <div className="flex justify-end gap-2 pt-3">
              <button onClick={() => setEditing(null)} className="btn btn-outline">{t('actions.cancel')}</button>
              <button onClick={() => update.mutate(editing)} disabled={update.isPending} className="btn btn-primary">
                {update.isPending ? t('common.saving') : t('actions.save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
