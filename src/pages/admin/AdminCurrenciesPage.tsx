import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { admin, CurrencyRow } from '../../api/admin'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faRotate, faCircleCheck, faCircleXmark, faCoins } from '@fortawesome/free-solid-svg-icons'
import { useT } from '../../store/locale'
import { SearchInput } from '../../components/SearchInput'
import { FilterBar, SelectFilter } from '../../components/FilterBar'
import { dialog } from '../../store/dialog'

export default function AdminCurrenciesPage() {
  const t = useT()
  const qc = useQueryClient()
  const { data = [], isLoading } = useQuery({ queryKey: ['admin-currencies'], queryFn: admin.currencyAll })

  const [q, setQ] = useState('')
  const [status, setStatus] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['admin-currencies'] })
    qc.invalidateQueries({ queryKey: ['currencies'] }) // refresca el picker del storefront
  }

  const syncMut = useMutation({
    mutationFn: () => admin.currencySync(),
    onSuccess: (r) => { invalidate(); dialog.alert({ variant: 'success', message: t('admin.currencies.sync_done').replace('{n}', String(r.updated)) }) },
    onError: (e: any) => dialog.alert({ variant: 'error', message: e?.response?.data?.message ?? t('admin.currencies.sync_error') }),
  })
  const toggleMut = useMutation({
    mutationFn: ({ code, active }: { code: string; active: boolean }) => admin.currencySetActive(code, active),
    onSuccess: invalidate,
    onError: (e: any) => dialog.alert({ variant: 'error', message: e?.response?.data?.message ?? t('common.error') }),
  })
  const bulkMut = useMutation({
    mutationFn: ({ codes, active }: { codes: string[]; active: boolean }) => admin.currencyBulkActive(codes, active),
    onSuccess: () => { invalidate(); setSelected(new Set()) },
    onError: (e: any) => dialog.alert({ variant: 'error', message: e?.response?.data?.message ?? t('common.error') }),
  })

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return data.filter((c) => {
      if (status === 'active' && !c.active) return false
      if (status === 'inactive' && c.active) return false
      if (needle && !c.code.toLowerCase().includes(needle) && !(c.name ?? '').toLowerCase().includes(needle)) return false
      return true
    })
  }, [data, q, status])

  const activeCount = data.filter((c) => c.active).length
  const allChecked = rows.length > 0 && rows.every((c) => selected.has(c.code))
  const toggleAll = () => setSelected(allChecked ? new Set() : new Set(rows.map((c) => c.code)))
  const toggleOne = (code: string) => setSelected((prev) => {
    const next = new Set(prev); next.has(code) ? next.delete(code) : next.add(code); return next
  })
  const lastSync = data.map((c) => c.lastSyncedAt).filter(Boolean).sort().pop()

  const statusOptions = [
    { value: 'active', label: t('admin.currencies.only_active') },
    { value: 'inactive', label: t('admin.currencies.only_inactive') },
  ]

  if (isLoading) return <p className="text-sm text-ink-500">{t('common.loading')}</p>

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2"><FontAwesomeIcon icon={faCoins} className="text-primary" /> {t('admin.currencies.title')}</h1>
          <p className="text-sm text-ink-500 mt-1">{t('admin.currencies.subtitle')}</p>
          {lastSync && <p className="text-[11px] text-ink-400 mt-1">{t('admin.currencies.last_sync')}: {new Date(lastSync).toLocaleString()}</p>}
        </div>
        <button onClick={() => syncMut.mutate()} disabled={syncMut.isPending} className="btn btn-primary text-[12px]">
          <FontAwesomeIcon icon={faRotate} className={syncMut.isPending ? 'animate-spin' : ''} /> {t('admin.currencies.sync')}
        </button>
      </header>

      <FilterBar onClear={() => { setQ(''); setStatus(null) }} hasActive={!!q || !!status}>
        <SearchInput value={q} onChange={setQ} placeholder={t('admin.currencies.search_ph')} className="w-full sm:min-w-[220px]" />
        <SelectFilter label={t('orders.filter.status')} value={status} placeholder={t('orders.filter.all')}
          options={statusOptions} onChange={setStatus} />
        <span className="text-[11px] text-ink-400 ml-auto">
          {t('admin.currencies.active_count').replace('{a}', String(activeCount)).replace('{t}', String(data.length))}
        </span>
      </FilterBar>

      {selected.size > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2">
          <span className="text-xs font-medium">{t('admin.currencies.selected').replace('{n}', String(selected.size))}</span>
          <button onClick={() => bulkMut.mutate({ codes: [...selected], active: true })} className="btn btn-success btn-xs">
            <FontAwesomeIcon icon={faCircleCheck} /> {t('admin.currencies.activate_selected')}
          </button>
          <button onClick={() => bulkMut.mutate({ codes: [...selected], active: false })} className="btn btn-outline btn-xs">
            <FontAwesomeIcon icon={faCircleXmark} /> {t('admin.currencies.deactivate_selected')}
          </button>
        </div>
      )}

      <div className="card overflow-x-auto">
        <table className="table table-zebra text-sm">
          <thead>
            <tr>
              <th className="w-8"><input type="checkbox" className="checkbox checkbox-sm" checked={allChecked} onChange={toggleAll} /></th>
              <th>{t('admin.currencies.col.code')}</th>
              <th>{t('admin.currencies.col.name')}</th>
              <th className="text-right">{t('admin.currencies.col.rate')}</th>
              <th>{t('admin.currencies.col.status')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c: CurrencyRow) => (
              <tr key={c.code}>
                <td><input type="checkbox" className="checkbox checkbox-sm" checked={selected.has(c.code)} onChange={() => toggleOne(c.code)} /></td>
                <td className="font-mono font-medium">{c.flagEmoji ? c.flagEmoji + ' ' : ''}{c.code} <span className="text-ink-400">{c.symbol}</span></td>
                <td className="text-ink-600">{c.name}</td>
                <td className="text-right font-variant-numeric tabular-nums">{c.rateVsUsd}</td>
                <td>
                  <button onClick={() => toggleMut.mutate({ code: c.code, active: !c.active })}
                    className={`badge cursor-pointer ${c.active ? 'bg-emerald-100 text-emerald-700' : 'bg-ink-100 text-ink-500'}`}
                    title={t('admin.currencies.toggle_hint')}>
                    <FontAwesomeIcon icon={c.active ? faCircleCheck : faCircleXmark} className="mr-1" />
                    {c.active ? t('admin.currencies.active') : t('admin.currencies.inactive')}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
